'use server';

import { redirect } from 'next/navigation';

import { registrarOpinion } from '@/servicios/opiniones';

/**
 * El filtro de reseñas (RF-28), que es la parte más vendible del producto.
 *
 * Si la visita estuvo bien, se lleva al cliente directo a dejar la reseña en
 * Google Maps, donde más vale. Si estuvo mal, la queja se queda con el dueño y
 * NO llega a Google. De los reels: "está bueno las quejas, porque las quejas
 * no llevan al cliente, nos llevan a nosotros directamente".
 */
export async function accionOpinar(datos: FormData): Promise<void> {
  const slug = String(datos.get('slug') ?? '');
  const selloId = String(datos.get('selloId') ?? '');
  const calificacion = datos.get('calificacion') === 'buena' ? 'buena' : 'mala';
  const comentario = String(datos.get('comentario') ?? '');

  const resultado = await registrarOpinion({
    localSlug: slug,
    selloId,
    calificacion,
    comentario: calificacion === 'mala' ? comentario : null,
  });

  if (!resultado.ok) redirect(`/c/${slug}/tarjeta`);

  /**
   * Nunca se redirige a Google desde aquí, aunque la visita haya estado bien.
   *
   * Sacar al cliente a otro dominio desde dentro de una acción de servidor
   * resultó frágil: al volver atrás, el navegador restaura la página desde su
   * memoria y los botones quedan muertos, sin ningún error visible. Reportado
   * en un celular real el 2026-11-19.
   *
   * Ahora se le lleva a una pantalla nuestra con un botón hacia Google. Es más
   * robusto y además es mejor: el cliente entiende lo que va a pasar en vez de
   * aparecer de golpe en Google Maps.
   */
  redirect(`/c/${slug}/opinion/${selloId}?gracias=${calificacion}`);
}
