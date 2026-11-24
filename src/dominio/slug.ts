/**
 * La parte de la dirección que identifica a un local: club.sellofiel.app/c/el-barril
 *
 * La ven los clientes y va impresa en los QR, así que tiene que ser legible,
 * corta y estable: cambiarla después rompe todos los QR ya impresos.
 */

export const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LARGO_MAXIMO_SLUG = 40;

/** Rutas que no puede tomar un local porque chocarían con las del sistema. */
const RESERVADOS = new Set(['admin', 'panel', 'api', 'nuevo', 'c', 't', 's']);

/** "Café del Parque" -> "cafe-del-parque". */
export function slugDesde(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes: é -> e, ñ -> n
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LARGO_MAXIMO_SLUG)
    .replace(/-+$/g, '');
}

export type ResultadoSlug = { valido: true } | { valido: false; motivo: string };

export function validarSlug(slug: string): ResultadoSlug {
  if (slug.length < 3) return { valido: false, motivo: 'Tiene que tener al menos 3 caracteres' };
  if (slug.length > LARGO_MAXIMO_SLUG) {
    return { valido: false, motivo: `Máximo ${LARGO_MAXIMO_SLUG} caracteres` };
  }
  if (!SLUG_VALIDO.test(slug)) {
    return {
      valido: false,
      motivo: 'Solo minúsculas, números y guiones, sin espacios ni tildes',
    };
  }
  if (RESERVADOS.has(slug)) return { valido: false, motivo: 'Esa dirección está reservada' };
  return { valido: true };
}
