'use server';

import { redirect } from 'next/navigation';

import { exigirSesion } from '@/lib/cookies-panel';
import { marcarAlerta } from '@/servicios/antifraude';

export async function accionRevisarAlerta(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const estado = datos.get('estado') === 'descartada' ? 'descartada' : 'revisada';
  await marcarAlerta(sesion.localId, String(datos.get('alertaId') ?? ''), estado);
  redirect('/panel/alertas');
}
