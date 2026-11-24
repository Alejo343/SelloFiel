'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { exigirSesion } from '@/lib/cookies-panel';
import { cambiarEstadoChip, crearChip, moverChip, renombrarChip } from '@/servicios/chips';
import { resolverSucursalElegida } from '@/servicios/sucursales';

const esquemaAlta = z.object({
  objeto: z
    .string()
    .trim()
    .min(2, 'Ponle un nombre para reconocerlo, por ejemplo "media luna de la caja"')
    .max(80),
  tipo: z.enum(['nfc', 'qr_impreso', 'pantalla']),
  sucursalId: z.string().optional(),
});

export async function accionCrearChip(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const v = esquemaAlta.safeParse(Object.fromEntries(datos));

  if (!v.success) {
    redirect(`/panel/chips?error=${encodeURIComponent(v.error.issues[0].message)}`);
  }

  const sucursalId = await resolverSucursalElegida(sesion.localId, v.data.sucursalId);
  if (!sucursalId) redirect('/panel/chips?error=Primero+abre+una+sucursal');

  const chip = await crearChip({
    localId: sesion.localId,
    sucursalId,
    objeto: v.data.objeto,
    tipo: v.data.tipo,
  });
  // Directo a la ficha: lo siguiente que hace el dueño es copiar la dirección.
  redirect(`/panel/chips/${chip.id}?nuevo=1`);
}

export async function accionCambiarEstado(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const chipId = String(datos.get('chipId') ?? '');
  await cambiarEstadoChip(sesion.localId, chipId, datos.get('activo') === 'si');
  redirect(`/panel/chips/${chipId}`);
}

export async function accionRenombrar(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const chipId = String(datos.get('chipId') ?? '');
  const objeto = String(datos.get('objeto') ?? '').trim();
  if (objeto.length >= 2) await renombrarChip(sesion.localId, chipId, objeto);
  redirect(`/panel/chips/${chipId}`);
}

export async function accionMoverChip(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const chipId = String(datos.get('chipId') ?? '');
  await moverChip(sesion.localId, chipId, String(datos.get('sucursalId') ?? ''));
  redirect(`/panel/chips/${chipId}`);
}
