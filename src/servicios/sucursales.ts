/**
 * Las sedes de un local (RF-32).
 *
 * El local es la marca: un solo club, una sola tarjeta y un solo panel. Cada
 * sucursal aporta su ubicación (aviso por cercanía del wallet) y su ficha de
 * Google Maps (la reseña va a la sede que el cliente visitó).
 *
 * Todo filtra por el local de la sesión: un dueño no ve ni toca sedes ajenas.
 */

import { and, asc, count, eq, gte, sql } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { esViolacionUnica } from '../db/errores';
import { sellos, sucursales, tags } from '../db/schema';
import type { BaseDeDatos } from './tipos';
import { encolar } from './wallet/cola';

export interface Sucursal {
  id: string;
  nombre: string;
  direccion: string | null;
  lat: string | null;
  lng: string | null;
  googleMapsUrl: string | null;
  activa: boolean;
}

export async function listarSucursales(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
  opciones: { soloActivas?: boolean } = {},
): Promise<Sucursal[]> {
  return db
    .select({
      id: sucursales.id,
      nombre: sucursales.nombre,
      direccion: sucursales.direccion,
      lat: sucursales.lat,
      lng: sucursales.lng,
      googleMapsUrl: sucursales.googleMapsUrl,
      activa: sucursales.activa,
    })
    .from(sucursales)
    .where(
      opciones.soloActivas
        ? and(eq(sucursales.localId, localId), eq(sucursales.activa, true))
        : eq(sucursales.localId, localId),
    )
    .orderBy(sql`${sucursales.activa} desc`, asc(sucursales.creadoEn));
}

export async function obtenerSucursal(
  localId: string,
  sucursalId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<Sucursal | null> {
  // Un id que no es UUID haría fallar la consulta: se trata como inexistente.
  if (!/^[0-9a-f-]{36}$/i.test(sucursalId)) return null;
  const todas = await listarSucursales(localId, db);
  return todas.find((s) => s.id === sucursalId) ?? null;
}

/** La sede activa con ese id, si es de este local. Para validar formularios. */
export async function sucursalActivaDelLocal(
  localId: string,
  sucursalId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<boolean> {
  const s = await obtenerSucursal(localId, sucursalId, db);
  return s?.activa ?? false;
}

export interface DatosSucursal {
  nombre: string;
  direccion?: string | null;
  lat?: string | null;
  lng?: string | null;
  googleMapsUrl?: string | null;
}

export type ResultadoSucursal = { ok: true; id: string } | { ok: false; motivo: string };

function limpiar(datos: DatosSucursal) {
  const vacio = (v?: string | null) => (v?.trim() ? v.trim() : null);
  return {
    nombre: datos.nombre.trim(),
    direccion: vacio(datos.direccion),
    lat: vacio(datos.lat),
    lng: vacio(datos.lng),
    googleMapsUrl: vacio(datos.googleMapsUrl),
  };
}

function validar(d: ReturnType<typeof limpiar>): string | null {
  if (!d.nombre) return 'Ponle un nombre a la sucursal';
  if (d.nombre.length > 60) return 'El nombre es muy largo (máximo 60 caracteres)';
  if ((d.lat === null) !== (d.lng === null)) return 'Para la ubicación hacen falta latitud y longitud';
  if (d.lat !== null && d.lng !== null) {
    const lat = Number(d.lat);
    const lng = Number(d.lng);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
      return 'La latitud y la longitud tienen que ser números, como 4.6533 y -74.0836';
    }
  }
  if (d.googleMapsUrl !== null) {
    try {
      const url = new URL(d.googleMapsUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    } catch {
      return 'El enlace de Google Maps no parece válido';
    }
  }
  return null;
}

/**
 * La ubicación va dentro de la plantilla de Google Wallet del local, así que
 * todo cambio de sedes se encola para actualizarla.
 */
async function avisarAlWallet(localId: string, db: BaseDeDatos) {
  await encolar({ localId, tipo: 'crear_clase' }, db);
}

export async function crearSucursal(
  localId: string,
  datos: DatosSucursal,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResultadoSucursal> {
  const d = limpiar(datos);
  const error = validar(d);
  if (error) return { ok: false, motivo: error };

  try {
    const [fila] = await db
      .insert(sucursales)
      .values({ localId, ...d })
      .returning({ id: sucursales.id });
    await avisarAlWallet(localId, db);
    return { ok: true, id: fila.id };
  } catch (e) {
    if (esViolacionUnica(e, 'sucursales_local_nombre_unico')) {
      return { ok: false, motivo: 'Ya tienes una sucursal con ese nombre' };
    }
    throw e;
  }
}

export async function actualizarSucursal(
  localId: string,
  sucursalId: string,
  datos: DatosSucursal,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResultadoSucursal> {
  if (!(await obtenerSucursal(localId, sucursalId, db))) return { ok: false, motivo: 'No se encontró la sucursal' };
  const d = limpiar(datos);
  const error = validar(d);
  if (error) return { ok: false, motivo: error };

  try {
    await db
      .update(sucursales)
      .set(d)
      .where(and(eq(sucursales.id, sucursalId), eq(sucursales.localId, localId)));
    await avisarAlWallet(localId, db);
    return { ok: true, id: sucursalId };
  } catch (e) {
    if (esViolacionUnica(e, 'sucursales_local_nombre_unico')) {
      return { ok: false, motivo: 'Ya tienes una sucursal con ese nombre' };
    }
    throw e;
  }
}

/**
 * Cerrar o reabrir una sede. Cerrada, sus chips y su pantalla dejan de sumar
 * sellos y desaparece del aviso por cercanía; su historial se conserva.
 *
 * La última sede activa no se puede cerrar: un local sin sedes no tendría
 * dónde sumar sellos. Para eso está pausar el local entero.
 */
export async function cambiarActivaSucursal(
  localId: string,
  sucursalId: string,
  activa: boolean,
  db: BaseDeDatos = dbPorDefecto,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const sucursal = await obtenerSucursal(localId, sucursalId, db);
  if (!sucursal) return { ok: false, motivo: 'No se encontró la sucursal' };

  if (!activa) {
    const activas = (await listarSucursales(localId, db, { soloActivas: true })).length;
    if (sucursal.activa && activas <= 1) {
      return { ok: false, motivo: 'Es tu única sucursal abierta: no se puede cerrar' };
    }
  }

  await db
    .update(sucursales)
    .set({ activa })
    .where(and(eq(sucursales.id, sucursalId), eq(sucursales.localId, localId)));
  await avisarAlWallet(localId, db);
  return { ok: true };
}

export interface ResumenSucursal {
  id: string;
  nombre: string;
  activa: boolean;
  sellosDelPeriodo: number;
  chips: number;
}

/** Sellos de cada sede desde una fecha, para comparar en la portada del panel. */
export async function resumenPorSucursal(
  localId: string,
  desde: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResumenSucursal[]> {
  const [lista, conteoSellos, conteoChips] = await Promise.all([
    listarSucursales(localId, db),
    db
      .select({ id: sellos.sucursalId, n: count() })
      .from(sellos)
      .where(and(eq(sellos.localId, localId), gte(sellos.fecha, desde)))
      .groupBy(sellos.sucursalId),
    db
      .select({ id: tags.sucursalId, n: count() })
      .from(tags)
      .where(and(eq(tags.localId, localId), eq(tags.activo, true)))
      .groupBy(tags.sucursalId),
  ]);

  const s = new Map(conteoSellos.map((f) => [f.id, f.n]));
  const c = new Map(conteoChips.map((f) => [f.id, f.n]));
  return lista.map((x) => ({
    id: x.id,
    nombre: x.nombre,
    activa: x.activa,
    sellosDelPeriodo: s.get(x.id) ?? 0,
    chips: c.get(x.id) ?? 0,
  }));
}

/**
 * La sede a usar cuando no se eligió ninguna: la primera abierta. En un local
 * de una sola sede, que es lo normal, el dueño nunca tiene que elegir.
 */
export async function sucursalPorDefecto(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<string | null> {
  const [primera] = await listarSucursales(localId, db, { soloActivas: true });
  return primera?.id ?? null;
}

/** La elegida en el formulario si es una sede abierta de este local; si no, la de por defecto. */
export async function resolverSucursalElegida(
  localId: string,
  elegida: string | null | undefined,
  db: BaseDeDatos = dbPorDefecto,
): Promise<string | null> {
  if (elegida && (await sucursalActivaDelLocal(localId, elegida, db))) return elegida;
  return sucursalPorDefecto(localId, db);
}
