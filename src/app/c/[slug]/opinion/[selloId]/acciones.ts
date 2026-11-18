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

  if (calificacion === 'buena' && resultado.googleMapsUrl) {
    redirect(resultado.googleMapsUrl);
  }

  redirect(`/c/${slug}/opinion/${selloId}?gracias=${calificacion}`);
}
