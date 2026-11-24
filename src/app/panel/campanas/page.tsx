/**
 * Campañas masivas: /panel/campanas (RF-31)
 *
 * El dueño elige a quién (todos, los frecuentes, los que se perdieron...) y
 * escribe el mensaje una vez. Se crea un mensaje por cliente en la bandeja.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoPanel } from '@/componentes/marco-panel';
import { esSegmento, SEGMENTOS } from '@/dominio/segmentos';
import { exigirSesion } from '@/lib/cookies-panel';
import { contarPorSegmento, listarCampanas } from '@/servicios/campanas';
import { obtenerLocalDelPanel } from '@/servicios/panel';

import { accionCancelarCampana } from './acciones';
import { FormularioCampana } from './formulario';

const fecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });

export default async function PaginaCampanas({ searchParams }: PageProps<'/panel/campanas'>) {
  const sesion = await exigirSesion();
  const { creada } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const [conteo, lista] = await Promise.all([
    contarPorSegmento(sesion.localId),
    listarCampanas(sesion.localId),
  ]);

  return (
    <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>
      <h1>Campañas</h1>
      <p className="ayuda">
        Un mensaje para muchos clientes a la vez: una promo, un plato nuevo, un evento.
      </p>

      {typeof creada === 'string' && (
        <div className="aviso aviso--exito">
          <p>Campaña creada: {creada} mensajes esperan en tu bandeja.</p>
          <Link href="/panel/mensajes">Ir a enviarlos</Link>
        </div>
      )}

      <FormularioCampana conteo={conteo} />

      <section className="pila">
        <h2>Campañas anteriores</h2>
        {lista.length === 0 ? (
          <p className="vacio">Todavía no has lanzado ninguna.</p>
        ) : (
          <ul className="lista">
            {lista.map((c) => (
              <li key={c.id} className="fila">
                <span className="fila__titulo">
                  <strong>{c.nombre}</strong>
                </span>
                <span className="fila__meta">
                  {fecha.format(c.creadoEn)} ·{' '}
                  {esSegmento(c.segmento) ? SEGMENTOS[c.segmento].nombre : c.segmento} · {c.enviados} de{' '}
                  {c.destinatarios} enviados
                  {c.pendientes > 0 && ` · ${c.pendientes} por enviar`}
                </span>
                <p className="fila__cita">«{c.texto}»</p>
                {c.pendientes > 0 && (
                  <form action={accionCancelarCampana}>
                    <input type="hidden" name="campanaId" value={c.id} />
                    <button type="submit" className="boton--texto boton--chico">
                      Quitar de la bandeja los {c.pendientes} sin enviar
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </MarcoPanel>
  );
}

export const metadata = { title: 'Campañas · Sello Fiel' };
export const dynamic = 'force-dynamic';
