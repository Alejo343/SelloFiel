'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { exigirSesion } from '@/lib/cookies-panel';
import { cambiarEstadoChip, crearChip, renombrarChip } from '@/servicios/chips';

const esquemaAlta = z.object({
  objeto: z
    .string()
    .trim()
    .min(2, 'Ponle un nombre para reconocerlo, por ejemplo "media luna de la caja"')
    .max(80),
  tipo: z.enum(['nfc', 'qr_impreso', 'pantalla']),
});

export async function accionCrearChip(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const v = esquemaAlta.safeParse(Object.fromEntries(datos));

  if (!v.success) {
    redirect(`/panel/chips?error=${encodeURIComponent(v.error.issues[0].message)}`);
  }

  const chip = await crearChip({ localId: sesion.localId, ...v.data });
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
