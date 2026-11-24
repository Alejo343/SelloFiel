'use server';

import { redirect } from 'next/navigation';

import { exigirSesion } from '@/lib/cookies-panel';
import { cancelarPendientes, crearCampana } from '@/servicios/campanas';

export interface EstadoCampana {
  error?: string;
}

export async function accionCrearCampana(_previo: EstadoCampana, datos: FormData): Promise<EstadoCampana> {
  const sesion = await exigirSesion();
  const r = await crearCampana({
    localId: sesion.localId,
    usuarioLocalId: sesion.usuarioId,
    nombre: String(datos.get('nombre') ?? ''),
    segmento: String(datos.get('segmento') ?? ''),
    texto: String(datos.get('texto') ?? ''),
  });
  if (!r.ok) return { error: r.motivo };
  redirect(`/panel/campanas?creada=${r.destinatarios}`);
}

export async function accionCancelarCampana(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  await cancelarPendientes(sesion.localId, String(datos.get('campanaId') ?? ''));
  redirect('/panel/campanas');
}
