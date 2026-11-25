/**
 * Operaciones del administrador de Sello Fiel: crear locales, darles un dueño,
 * pausarlos y ver cómo van.
 *
 * A diferencia del resto de servicios, estos NO filtran por local: el
 * administrador ve todos. Por eso solo se llaman desde pantallas protegidas
 * por `exigirAdmin()`, nunca desde el panel de un dueño.
 */

import { and, count, eq, gte, sql } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { esViolacionUnica } from '../db/errores';
import {
  administradores,
  clientes,
  locales,
  programas,
  sellos,
  sucursales,
  tarjetas,
  usuariosLocal,
} from '../db/schema';
import { validarDisenoTarjeta } from '../dominio/wallet';
import { normalizarColor } from '../dominio/color';
import { validarSlug } from '../dominio/slug';
import { normalizarTelefono } from '../dominio/telefono';
import { hashearContrasena, verificarContrasena } from '../lib/contrasena';
import { contrasenaTemporal } from '../lib/contrasena-temporal';
import type { BaseDeDatos } from './tipos';
import { encolar } from './wallet/cola';

/* ------------------------------------------------------- autenticación */

/** Mismo cuidado que el login de dueños: no revela si el correo existe. */
export async function autenticarAdmin(
  email: string,
  contrasena: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<{ adminId: string; nombre: string } | null> {
  const [admin] = await db
    .select()
    .from(administradores)
    .where(eq(administradores.email, email.trim().toLowerCase()))
    .limit(1);

  if (!admin) {
    await verificarContrasena(contrasena, 'scrypt$16384$8$1$c2FsZmFsc2E$aGFzaGZhbHNv');
    return null;
  }
  if (!admin.activo) return null;
  if (!(await verificarContrasena(contrasena, admin.hashContrasena))) return null;

  return { adminId: admin.id, nombre: admin.nombre };
}

export async function obtenerAdmin(adminId: string, db: BaseDeDatos = dbPorDefecto) {
  const [admin] = await db
    .select({ id: administradores.id, nombre: administradores.nombre, activo: administradores.activo })
    .from(administradores)
    .where(eq(administradores.id, adminId))
    .limit(1);
  return admin?.activo ? admin : null;
}

/** Lo usa el script `npm run admin:crear`. Devuelve la contraseña generada. */
export async function crearAdmin(
  datos: { email: string; nombre: string },
  db: BaseDeDatos = dbPorDefecto,
): Promise<string> {
  const contrasena = contrasenaTemporal();
  await db
    .insert(administradores)
    .values({
      email: datos.email.trim().toLowerCase(),
      nombre: datos.nombre.trim(),
      hashContrasena: await hashearContrasena(contrasena),
    })
    .onConflictDoUpdate({
      target: administradores.email,
      set: { hashContrasena: await hashearContrasena(contrasena), activo: true },
    });
  return contrasena;
}

/* ------------------------------------------------------------ locales */

export interface LocalDelAdmin {
  id: string;
  slug: string;
  nombre: string;
  activo: boolean;
  emitePases: boolean;
  clientes: number;
  sellosDelMes: number;
  duenoEmail: string | null;
  logoAnchoUrl: string | null;
  plantillaImagenUrl: string | null;
  creadoEn: Date;
}

export async function listarLocales(
  db: BaseDeDatos = dbPorDefecto,
  ahora: Date = new Date(),
): Promise<LocalDelAdmin[]> {
  const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));

  const [filas, conteoClientes, conteoSellos, duenos] = await Promise.all([
    db.select().from(locales).orderBy(sql`${locales.creadoEn} desc`),
    db.select({ localId: clientes.localId, n: count() }).from(clientes).groupBy(clientes.localId),
    db
      .select({ localId: sellos.localId, n: count() })
      .from(sellos)
      .where(gte(sellos.creadoEn, inicioMes))
      .groupBy(sellos.localId),
    db
      .select({ localId: usuariosLocal.localId, email: usuariosLocal.email })
      .from(usuariosLocal)
      .orderBy(usuariosLocal.creadoEn),
  ]);

  const porLocal = <T extends { localId: string }>(lista: T[]) =>
    new Map(lista.map((x) => [x.localId, x]));
  const c = porLocal(conteoClientes);
  const s = porLocal(conteoSellos);
  const d = porLocal(duenos);

  return filas.map((l) => ({
    id: l.id,
    slug: l.slug,
    nombre: l.nombre,
    activo: l.activo,
    emitePases: l.emitePases,
    clientes: c.get(l.id)?.n ?? 0,
    sellosDelMes: s.get(l.id)?.n ?? 0,
    duenoEmail: d.get(l.id)?.email ?? null,
    logoAnchoUrl: l.logoAnchoUrl,
    plantillaImagenUrl: l.plantillaImagenUrl,
    creadoEn: l.creadoEn,
  }));
}

export async function obtenerLocalAdmin(localId: string, db: BaseDeDatos = dbPorDefecto) {
  return (await listarLocales(db)).find((l) => l.id === localId) ?? null;
}

export interface DatosNuevoLocal {
  nombre: string;
  slug: string;
  premio: string;
  sellosObjetivo: number;
  colorPrimario?: string;
  logoUrl?: string | null;
  whatsapp?: string | null;
  emitePases: boolean;
  duenoNombre: string;
  duenoEmail: string;
}

export type ResultadoNuevoLocal =
  | { ok: true; localId: string; contrasenaTemporal: string }
  | { ok: false; campo: string; motivo: string };

/**
 * Crea el local, su programa y el usuario del dueño, todo o nada.
 *
 * En una transacción a propósito: un local sin programa rompe el tap, y uno
 * sin dueño no lo puede administrar nadie. Si algo falla a mitad, no queda
 * ninguno de los tres a medias.
 *
 * La contraseña del dueño se genera y se devuelve UNA vez, para que el
 * administrador se la pase. No se guarda en claro en ningún lado, y el dueño
 * tendrá que cambiarla al entrar.
 */
export async function crearLocalConDueno(
  datos: DatosNuevoLocal,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResultadoNuevoLocal> {
  const slug = datos.slug.trim().toLowerCase();
  const validacion = validarSlug(slug);
  if (!validacion.valido) return { ok: false, campo: 'slug', motivo: validacion.motivo };

  let whatsapp: string | null = null;
  if (datos.whatsapp?.trim()) {
    const t = normalizarTelefono(datos.whatsapp);
    if (!t.valido) return { ok: false, campo: 'whatsapp', motivo: 'Ese WhatsApp no parece válido' };
    whatsapp = t.telefono;
  }

  const contrasena = contrasenaTemporal();
  const hash = await hashearContrasena(contrasena);

  try {
    const localId = await db.transaction(async (tx) => {
      const [local] = await tx
        .insert(locales)
        .values({
          slug,
          nombre: datos.nombre.trim(),
          colorPrimario: normalizarColor(datos.colorPrimario),
          logoUrl: datos.logoUrl?.trim() || null,
          whatsapp,
          emitePases: datos.emitePases,
        })
        .returning({ id: locales.id });

      // Todo local nace con una sede. Si después abre otra, la agrega desde
      // su panel; mientras tenga una sola, nunca tiene que elegir sede.
      await tx.insert(sucursales).values({ localId: local.id, nombre: 'Principal' });

      await tx.insert(programas).values({
        localId: local.id,
        premio: datos.premio.trim(),
        sellosObjetivo: datos.sellosObjetivo,
      });

      await tx.insert(usuariosLocal).values({
        localId: local.id,
        email: datos.duenoEmail.trim().toLowerCase(),
        nombre: datos.duenoNombre.trim(),
        hashContrasena: hash,
        debeCambiarContrasena: true,
      });

      return local.id;
    });

    return { ok: true, localId, contrasenaTemporal: contrasena };
  } catch (error) {
    if (esViolacionUnica(error, 'locales_slug_unique')) {
      return { ok: false, campo: 'slug', motivo: 'Ya hay un local con esa dirección' };
    }
    if (esViolacionUnica(error, 'usuarios_local_email_unique')) {
      return { ok: false, campo: 'duenoEmail', motivo: 'Ese correo ya tiene un usuario' };
    }
    throw error;
  }
}

/** Pausar un local: su tap, su tarjeta y su panel dejan de funcionar. */
export async function cambiarActivoLocal(
  localId: string,
  activo: boolean,
  db: BaseDeDatos = dbPorDefecto,
): Promise<void> {
  await db.update(locales).set({ activo }).where(eq(locales.id, localId));
}

export async function cambiarEmitePases(
  localId: string,
  emitePases: boolean,
  db: BaseDeDatos = dbPorDefecto,
): Promise<void> {
  await db.update(locales).set({ emitePases }).where(eq(locales.id, localId));
}

/**
 * Nueva contraseña temporal para el dueño de un local, cuando la olvidó.
 * Devuelve null si el local no tiene dueño.
 */
export async function restablecerContrasenaDueno(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<{ email: string; contrasenaTemporal: string } | null> {
  const [dueno] = await db
    .select({ id: usuariosLocal.id, email: usuariosLocal.email })
    .from(usuariosLocal)
    .where(eq(usuariosLocal.localId, localId))
    .orderBy(usuariosLocal.creadoEn)
    .limit(1);

  if (!dueno) return null;

  const contrasena = contrasenaTemporal();
  await db
    .update(usuariosLocal)
    .set({ hashContrasena: await hashearContrasena(contrasena), debeCambiarContrasena: true })
    .where(and(eq(usuariosLocal.id, dueno.id), eq(usuariosLocal.localId, localId)));

  return { email: dueno.email, contrasenaTemporal: contrasena };
}

/* ---------------------------------------- contraseña del propio dueño */

export async function cambiarContrasenaDueno(
  usuarioId: string,
  actual: string,
  nueva: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (nueva.length < 10) return { ok: false, motivo: 'La nueva contraseña necesita al menos 10 caracteres' };

  const [usuario] = await db
    .select()
    .from(usuariosLocal)
    .where(eq(usuariosLocal.id, usuarioId))
    .limit(1);

  if (!usuario || !(await verificarContrasena(actual, usuario.hashContrasena))) {
    return { ok: false, motivo: 'La contraseña actual no es correcta' };
  }
  if (actual === nueva) return { ok: false, motivo: 'La nueva tiene que ser distinta de la actual' };

  await db
    .update(usuariosLocal)
    .set({ hashContrasena: await hashearContrasena(nueva), debeCambiarContrasena: false })
    .where(eq(usuariosLocal.id, usuarioId));

  return { ok: true };
}

export async function debeCambiarContrasena(
  usuarioId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<boolean> {
  const [u] = await db
    .select({ debe: usuariosLocal.debeCambiarContrasena })
    .from(usuariosLocal)
    .where(eq(usuariosLocal.id, usuarioId))
    .limit(1);
  return u?.debe ?? false;
}

/* ---------------------------------------------- diseño de la tarjeta */

/**
 * Guarda el diseño a medida de la tarjeta de un local y lo lleva a todas las
 * tarjetas ya emitidas.
 *
 * Lo hace el administrador: el diseño es un servicio, no algo que el dueño
 * configure solo (decisión del 2026-11-25). Las imágenes se publican antes en
 * `sellofiel.app/tarjetas/<local>/<versión>/` con `scripts/generar-tarjeta.mjs`.
 *
 * Se encola la plantilla (por el logo ancho) y una actualización por cada
 * cliente que ya guardó la tarjeta, para que cambie su imagen sin esperar a
 * su próximo sello.
 */
export async function guardarDisenoTarjeta(
  localId: string,
  datos: { logoAnchoUrl?: string | null; plantillaImagenUrl?: string | null },
  db: BaseDeDatos = dbPorDefecto,
): Promise<{ ok: true; tarjetasPorActualizar: number } | { ok: false; motivo: string }> {
  const limpio = {
    logoAnchoUrl: datos.logoAnchoUrl?.trim() || null,
    plantillaImagenUrl: datos.plantillaImagenUrl?.trim() || null,
  };
  const validacion = validarDisenoTarjeta(limpio);
  if (!validacion.ok) return validacion;

  const filas = await db.update(locales).set(limpio).where(eq(locales.id, localId)).returning({ id: locales.id });
  if (filas.length === 0) return { ok: false, motivo: 'No se encontró el local' };

  await encolar({ localId, tipo: 'crear_clase' }, db);

  const conTarjeta = await db
    .select({ clienteId: tarjetas.clienteId })
    .from(tarjetas)
    .innerJoin(clientes, eq(tarjetas.clienteId, clientes.id))
    .where(and(eq(clientes.localId, localId), eq(tarjetas.plataforma, 'google')));

  for (const { clienteId } of conTarjeta) {
    await encolar({ localId, clienteId, tipo: 'actualizar_sellos' }, db);
  }

  return { ok: true, tarjetasPorActualizar: conTarjeta.length };
}

/** Cuántos sellos pide el local: define cuántas imágenes necesita su diseño. */
export async function sellosObjetivoDe(localId: string, db: BaseDeDatos = dbPorDefecto): Promise<number | null> {
  const [p] = await db
    .select({ n: programas.sellosObjetivo })
    .from(programas)
    .where(eq(programas.localId, localId))
    .limit(1);
  return p?.n ?? null;
}
