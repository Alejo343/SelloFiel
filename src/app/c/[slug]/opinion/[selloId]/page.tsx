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

import { MarcoLocal } from '@/componentes/marca-local';
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
      <MarcoLocal local={visita} titulo="Gracias por contarnos">
        <p className="hoja">
          Lo sentimos. Le avisamos al equipo de {visita.localNombre} y van a querer arreglarlo.
        </p>
        <Link className="boton boton--secundario" href={`/c/${slug}/tarjeta`}>
          Ver mis sellos
        </Link>
      </MarcoLocal>
    );
  }

  if (gracias === 'buena') {
    return (
      <MarcoLocal local={visita} titulo={`¡Gracias, ${visita.clienteNombre}!`}>
        <p className="texto-suave">Nos alegra. Te esperamos pronto en {visita.localNombre}.</p>

        {visita.googleMapsUrl && (
          <section className="hoja">
            <p>
              ¿Nos ayudas con una reseña? A {visita.localNombre} le sirve muchísimo y te toma
              un minuto.
            </p>
            {/* Un enlace normal, no una redirección desde el formulario: así
                volver atrás nunca deja la página inservible. */}
            <a
              className="boton boton--local"
              href={visita.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Dejar mi reseña en Google
            </a>
          </section>
        )}

        <Link className="boton boton--secundario" href={`/c/${slug}/tarjeta`}>
          Ver mis sellos
        </Link>
      </MarcoLocal>
    );
  }

  return (
    <MarcoLocal local={visita}>
      <p className="hoja">
        Hola, {visita.clienteNombre}. ¿Cómo estuvo tu visita?
      </p>

      {visita.yaOpino && (
        <p className="ayuda">Ya nos contaste, pero puedes cambiar tu respuesta.</p>
      )}

      <form action={accionOpinar}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="selloId" value={selloId} />
        <input type="hidden" name="calificacion" value="buena" />
        <button type="submit">Estuvo bien</button>
      </form>

      <form action={accionOpinar} className="hoja">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="selloId" value={selloId} />
        <input type="hidden" name="calificacion" value="mala" />

        <div className="campo">
          <label htmlFor="comentario">Algo no estuvo bien. ¿Qué pasó?</label>
          <textarea id="comentario" name="comentario" rows={3} />
          <small>Esto lo lee el dueño del local, no se publica en ningún lado.</small>
        </div>

        <button type="submit" className="boton--secundario">
          Enviar mi comentario
        </button>
      </form>
    </MarcoLocal>
  );
}

export const dynamic = 'force-dynamic';
