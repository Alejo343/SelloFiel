'use server';

import { redirect } from 'next/navigation';

import { exigirSesion } from '@/lib/cookies-panel';
import { cambiarContrasenaDueno } from '@/servicios/admin';

export async function accionCambiarContrasena(datos: FormData): Promise<void> {
  const sesion = await exigirSesion({ permitirContrasenaTemporal: true });
  const nueva = String(datos.get('nueva') ?? '');

  if (nueva !== String(datos.get('repetir') ?? '')) {
    redirect('/panel/cuenta?error=' + encodeURIComponent('Las dos contraseñas nuevas no coinciden'));
  }

  const r = await cambiarContrasenaDueno(sesion.usuarioId, String(datos.get('actual') ?? ''), nueva);
  if (!r.ok) redirect('/panel/cuenta?error=' + encodeURIComponent(r.motivo));

  redirect('/panel?contrasena=1');
}
