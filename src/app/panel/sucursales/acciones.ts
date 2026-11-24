'use server';

import { redirect } from 'next/navigation';

import { exigirSesion } from '@/lib/cookies-panel';
import { sincronizarWalletPronto } from '@/lib/sincronizar-wallet';
import { actualizarSucursal, cambiarActivaSucursal, crearSucursal } from '@/servicios/sucursales';

export interface EstadoSucursal {
  error?: string;
  /** Lo que se envió, para volver a pintarlo si hubo error */
  valores?: Record<string, string>;
}

const leer = (datos: FormData) => ({
  nombre: String(datos.get('nombre') ?? ''),
  direccion: String(datos.get('direccion') ?? ''),
  lat: String(datos.get('lat') ?? ''),
  lng: String(datos.get('lng') ?? ''),
  googleMapsUrl: String(datos.get('googleMapsUrl') ?? ''),
});

export async function accionGuardarSucursal(
  _previo: EstadoSucursal,
  datos: FormData,
): Promise<EstadoSucursal> {
  const sesion = await exigirSesion();
  const id = String(datos.get('sucursalId') ?? '');
  const r = id
    ? await actualizarSucursal(sesion.localId, id, leer(datos))
    : await crearSucursal(sesion.localId, leer(datos));
  if (!r.ok) return { error: r.motivo, valores: leer(datos) };

  // La ubicación va en la plantilla del wallet.
  sincronizarWalletPronto(sesion.localId);
  redirect(id ? `/panel/sucursales/${id}?guardado=1` : '/panel/sucursales?creada=1');
}

export async function accionCambiarActiva(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const id = String(datos.get('sucursalId') ?? '');
  const r = await cambiarActivaSucursal(sesion.localId, id, datos.get('activa') === 'si');
  if (!r.ok) redirect(`/panel/sucursales/${id}?error=${encodeURIComponent(r.motivo)}`);
  sincronizarWalletPronto(sesion.localId);
  redirect(`/panel/sucursales/${id}`);
}
