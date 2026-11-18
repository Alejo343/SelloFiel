'use server';

import { redirect } from 'next/navigation';

import { exigirSesion } from '@/lib/cookies-panel';
import { descartarMensaje, marcarEnviado } from '@/servicios/mensajes';
import { marcarQuejaRevisada } from '@/servicios/opiniones';

export async function accionMarcarEnviado(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  await marcarEnviado(sesion.localId, String(datos.get('mensajeId') ?? ''));
  redirect('/panel/mensajes');
}

export async function accionDescartar(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  await descartarMensaje(sesion.localId, String(datos.get('mensajeId') ?? ''));
  redirect('/panel/mensajes');
}

export async function accionQuejaRevisada(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  await marcarQuejaRevisada(sesion.localId, String(datos.get('opinionId') ?? ''));
  redirect('/panel/mensajes');
}
