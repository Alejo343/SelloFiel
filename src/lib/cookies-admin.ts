import { cookies } from 'next/headers';

import { obtenerAdmin } from '@/servicios/admin';
import { redirect } from 'next/navigation';

import {
  crearTokenAdmin,
  leerTokenAdmin,
  NOMBRE_COOKIE_ADMIN,
  OPCIONES_COOKIE_ADMIN,
  type SesionAdmin,
} from './sesion-admin';

export async function sesionAdminActual(): Promise<SesionAdmin | null> {
  return leerTokenAdmin((await cookies()).get(NOMBRE_COOKIE_ADMIN)?.value);
}

/**
 * Toda pantalla y acción de administración empieza por aquí.
 *
 * Además de la cookie, comprueba que el administrador siga activo: si se le
 * quita el acceso, lo pierde al instante y no cuando caduque su sesión.
 */
export async function exigirAdmin(): Promise<SesionAdmin> {
  const sesion = await sesionAdminActual();
  if (!sesion || !(await obtenerAdmin(sesion.adminId))) redirect('/admin/entrar');
  return sesion;
}

export async function iniciarSesionAdmin(adminId: string): Promise<void> {
  (await cookies()).set(
    NOMBRE_COOKIE_ADMIN,
    crearTokenAdmin({ adminId, creadaEn: Date.now() }),
    OPCIONES_COOKIE_ADMIN,
  );
}

export async function cerrarSesionAdmin(): Promise<void> {
  (await cookies()).delete(NOMBRE_COOKIE_ADMIN);
}
