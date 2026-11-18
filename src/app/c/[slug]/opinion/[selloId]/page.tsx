/**
 * «¿Cómo estuvo tu visita?»: /c/[slug]/opinion/[selloId]
 *
 * Llega por el mensaje de WhatsApp que se manda unas horas después de la
 * visita. El identificador del sello hace de credencial: es un UUID aleatorio
 * que solo conoce quien recibió el mensaje.
 *
 * Dos caminos a propósito. Si estuvo bien, se le lleva a Google Maps, donde la
 * reseña vale. Si estuvo mal, se le pide que cuente qué pasó y eso llega al
 * dueño, no a Google.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { visitaParaOpinar } from '@/servicios/opiniones';

import { accionOpinar } from './acciones';

export default async function PaginaOpinion({
  params,
  searchParams,
}: PageProps<'/c/[slug]/opinion/[selloId]'>) {
  const { slug, selloId } = await params;
  const { gracias } = await searchParams;

  const visita = await visitaParaOpinar(slug, selloId);
  if (!visita) notFound();

  if (gracias === 'mala') {
    return (
      <main>
        <h1>Gracias por contarnos</h1>
        <p>
          Lo sentimos. Le avisamos al equipo de {visita.localNombre} y van a querer arreglarlo.
        </p>
        <p>
          <Link href={`/c/${slug}/tarjeta`}>Ver mis sellos</Link>
        </p>
      </main>
    );
  }

  if (gracias === 'buena') {
    return (
      <main>
        <h1>¡Gracias, {visita.clienteNombre}!</h1>
        <p>Nos alegra. Te esperamos pronto en {visita.localNombre}.</p>
        <p>
          <Link href={`/c/${slug}/tarjeta`}>Ver mis sellos</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>{visita.localNombre}</h1>
      <p>
        Hola, {visita.clienteNombre}. ¿Cómo estuvo tu visita?
      </p>

      {visita.yaOpino && <p><small>Ya nos contaste, pero puedes cambiar tu respuesta.</small></p>}

      <form action={accionOpinar}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="selloId" value={selloId} />
        <input type="hidden" name="calificacion" value="buena" />
        <button type="submit">Estuvo bien</button>
      </form>

      <form action={accionOpinar}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="selloId" value={selloId} />
        <input type="hidden" name="calificacion" value="mala" />

        <div className="campo">
          <label htmlFor="comentario">Algo no estuvo bien. ¿Qué pasó?</label>
          <textarea id="comentario" name="comentario" rows={3} />
          <small>Esto lo lee el dueño del local, no se publica en ningún lado.</small>
        </div>

        <button type="submit">Enviar mi comentario</button>
      </form>
    </main>
  );
}

export const dynamic = 'force-dynamic';
