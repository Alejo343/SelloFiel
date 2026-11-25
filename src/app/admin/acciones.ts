'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { imagenesNecesarias, validarDisenoTarjeta } from '@/dominio/wallet';
import { imagenesQueFallan } from '@/lib/comprobar-imagenes';
import { cerrarSesionAdmin, exigirAdmin, iniciarSesionAdmin } from '@/lib/cookies-admin';
import { sincronizarWalletPronto } from '@/lib/sincronizar-wallet';
import {
  autenticarAdmin,
  cambiarActivoLocal,
  cambiarEmitePases,
  crearLocalConDueno,
  guardarDisenoTarjeta,
  restablecerContrasenaDueno,
  sellosObjetivoDe,
} from '@/servicios/admin';
import { cambiarEstadoChip, crearChip } from '@/servicios/chips';
import { resolverSucursalElegida } from '@/servicios/sucursales';

export interface EstadoEntrarAdmin {
  error?: string;
}

export async function accionEntrarAdmin(
  _anterior: EstadoEntrarAdmin,
  datos: FormData,
): Promise<EstadoEntrarAdmin> {
  const admin = await autenticarAdmin(
    String(datos.get('email') ?? ''),
    String(datos.get('contrasena') ?? ''),
  );
  if (!admin) return { error: 'Correo o contraseña incorrectos.' };
  await iniciarSesionAdmin(admin.adminId);
  redirect('/admin');
}

export async function accionSalirAdmin(): Promise<void> {
  await cerrarSesionAdmin();
  redirect('/admin/entrar');
}

const esquemaLocal = z.object({
  nombre: z.string().trim().min(2, 'El nombre del local es obligatorio').max(80),
  slug: z.string().trim().min(1, 'La dirección es obligatoria'),
  premio: z.string().trim().min(3, 'Describe el premio').max(200),
  sellosObjetivo: z.coerce.number().int().min(1).max(50),
  colorPrimario: z.string().trim().optional(),
  logoUrl: z.string().trim().url('El logo tiene que ser un enlace https').optional().or(z.literal('')),
  whatsapp: z.string().trim().optional(),
  emitePases: z.string().optional(),
  duenoNombre: z.string().trim().min(2, 'Falta el nombre del dueño').max(80),
  duenoEmail: z.string().trim().email('Ese correo no parece válido'),
});

/**
 * La contraseña temporal vuelve en el ESTADO de la acción, nunca en la URL.
 * En la URL quedaría en el historial del navegador y en los registros del
 * servidor web. Así se muestra una vez en pantalla y desaparece.
 */
export interface EstadoCrearLocal {
  error?: string;
  creado?: { localId: string; slug: string; email: string; clave: string };
}

export async function accionCrearLocal(
  _anterior: EstadoCrearLocal,
  datos: FormData,
): Promise<EstadoCrearLocal> {
  await exigirAdmin();
  const v = esquemaLocal.safeParse(Object.fromEntries(datos));
  if (!v.success) return { error: v.error.issues[0].message };

  const r = await crearLocalConDueno({ ...v.data, emitePases: v.data.emitePases === 'si' });
  if (!r.ok) return { error: r.motivo };

  return {
    creado: {
      localId: r.localId,
      slug: v.data.slug.trim().toLowerCase(),
      email: v.data.duenoEmail.trim().toLowerCase(),
      clave: r.contrasenaTemporal,
    },
  };
}

export async function accionCambiarActivo(datos: FormData): Promise<void> {
  await exigirAdmin();
  const id = String(datos.get('localId') ?? '');
  await cambiarActivoLocal(id, datos.get('activo') === 'si');
  redirect(`/admin/locales/${id}`);
}

export async function accionCambiarEmitePases(datos: FormData): Promise<void> {
  await exigirAdmin();
  const id = String(datos.get('localId') ?? '');
  await cambiarEmitePases(id, datos.get('emitePases') === 'si');
  redirect(`/admin/locales/${id}`);
}

export interface EstadoRestablecer {
  clave?: string;
  email?: string;
  error?: string;
}

export async function accionRestablecerClave(
  _anterior: EstadoRestablecer,
  datos: FormData,
): Promise<EstadoRestablecer> {
  await exigirAdmin();
  const r = await restablecerContrasenaDueno(String(datos.get('localId') ?? ''));
  if (!r) return { error: 'Este local no tiene dueño.' };
  return { clave: r.contrasenaTemporal, email: r.email };
}

/** El administrador registra los chips del local al instalarlos. */
export async function accionCrearChipAdmin(datos: FormData): Promise<void> {
  await exigirAdmin();
  const localId = String(datos.get('localId') ?? '');
  const objeto = String(datos.get('objeto') ?? '').trim();
  const tipo = String(datos.get('tipo') ?? 'nfc');
  if (objeto.length >= 2 && (tipo === 'nfc' || tipo === 'qr_impreso' || tipo === 'pantalla')) {
    const sucursalId = await resolverSucursalElegida(localId, String(datos.get('sucursalId') ?? ''));
    if (sucursalId) await crearChip({ localId, sucursalId, objeto, tipo });
  }
  // Sin "#chips" al final: con solo el ancla distinta, Next lo toma como
  // un salto dentro de la misma página y no vuelve a pedir los datos, así que
  // el chip recién creado no aparecía en la lista.
  redirect(`/admin/locales/${localId}`);
}

export async function accionBajaChipAdmin(datos: FormData): Promise<void> {
  await exigirAdmin();
  const localId = String(datos.get('localId') ?? '');
  await cambiarEstadoChip(localId, String(datos.get('chipId') ?? ''), datos.get('activo') === 'si');
  // Sin "#chips" al final: con solo el ancla distinta, Next lo toma como
  // un salto dentro de la misma página y no vuelve a pedir los datos, así que
  // el chip recién creado no aparecía en la lista.
  redirect(`/admin/locales/${localId}`);
}

export interface EstadoDiseno {
  ok?: string;
  error?: string;
  /** Lo escrito, para no perderlo si hubo error */
  valores?: { logoAnchoUrl: string; plantillaImagenUrl: string };
}

/**
 * Guarda el diseño a medida de la tarjeta de un local. Antes comprueba que
 * TODAS las imágenes estén publicadas: una que falte deja sin imagen la
 * tarjeta de quien llegue a esa cantidad de sellos.
 */
export async function accionGuardarDiseno(_previo: EstadoDiseno, datos: FormData): Promise<EstadoDiseno> {
  await exigirAdmin();
  const localId = String(datos.get('localId') ?? '');
  const valores = {
    logoAnchoUrl: String(datos.get('logoAnchoUrl') ?? '').trim(),
    plantillaImagenUrl: String(datos.get('plantillaImagenUrl') ?? '').trim(),
  };

  const validacion = validarDisenoTarjeta(valores);
  if (!validacion.ok) return { error: validacion.motivo, valores };

  const objetivo = await sellosObjetivoDe(localId);
  if (objetivo === null) return { error: 'No se encontró el local', valores };

  const urls = [
    ...(valores.logoAnchoUrl ? [valores.logoAnchoUrl] : []),
    ...(valores.plantillaImagenUrl ? imagenesNecesarias(valores.plantillaImagenUrl, objetivo) : []),
  ];
  const fallan = await imagenesQueFallan(urls);
  if (fallan.length > 0) {
    return {
      error: `No se encontraron ${fallan.length} ${fallan.length === 1 ? 'imagen' : 'imágenes'}: ${fallan.slice(0, 3).join(', ')}${fallan.length > 3 ? '…' : ''}`,
      valores,
    };
  }

  const r = await guardarDisenoTarjeta(localId, valores);
  if (!r.ok) return { error: r.motivo, valores };
  sincronizarWalletPronto(localId);
  return {
    ok: `Diseño guardado. Se actualizarán ${r.tarjetasPorActualizar} ${r.tarjetasPorActualizar === 1 ? 'tarjeta' : 'tarjetas'} ya emitidas.`,
    valores,
  };
}
