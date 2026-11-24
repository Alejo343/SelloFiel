/**
 * Sesión del administrador de Sello Fiel.
 *
 * Misma técnica que la del panel —HMAC, comparación en tiempo constante,
 * caducidad— pero con otra cookie y otro prefijo en la firma. El prefijo es lo
 * que impide que un token de dueño sirva como token de administrador, aunque
 * los dos usen el mismo secreto.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SesionAdmin {
  adminId: string;
  creadaEn: number;
}

export const NOMBRE_COOKIE_ADMIN = 'sf_admin';

/** Cuatro horas: menos que el panel, porque da acceso a todos los locales. */
export const DURACION_SESION_ADMIN_MS = 4 * 60 * 60 * 1000;

function secreto(): string {
  const valor = process.env.SECRETO_SESION;
  if (!valor || valor.length < 32) throw new Error('Falta SECRETO_SESION en el .env.');
  return valor;
}

function firmar(cuerpo: string, clave: string): string {
  return createHmac('sha256', clave).update(`admin:${cuerpo}`).digest('base64url');
}

export function crearTokenAdmin(sesion: SesionAdmin, clave: string = secreto()): string {
  const cuerpo = Buffer.from(JSON.stringify(sesion), 'utf8').toString('base64url');
  return `${cuerpo}.${firmar(cuerpo, clave)}`;
}

export function leerTokenAdmin(
  token: string | undefined | null,
  clave: string = secreto(),
  ahora: number = Date.now(),
): SesionAdmin | null {
  if (!token) return null;
  const partes = token.split('.');
  if (partes.length !== 2) return null;

  const [cuerpo, firmaRecibida] = partes;
  const recibida = Buffer.from(firmaRecibida);
  const esperada = Buffer.from(firmar(cuerpo, clave));
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;

  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as SesionAdmin;
    if (typeof datos?.adminId !== 'string' || typeof datos?.creadaEn !== 'number') return null;
    if (ahora - datos.creadaEn > DURACION_SESION_ADMIN_MS) return null;
    if (datos.creadaEn > ahora + 60_000) return null;
    return datos;
  } catch {
    return null;
  }
}

export const OPCIONES_COOKIE_ADMIN = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DURACION_SESION_ADMIN_MS / 1000,
} as const;
