/**
 * La bandeja de pendientes: /panel/mensajes (RF-26)
 *
 * Es el corazón de lo que el local usa a diario. Cada fila es un cliente al
 * que hay que escribirle hoy, con el texto ya armado y un botón que abre
 * WhatsApp. El local solo tiene que darle a enviar y volver a marcarlo.
 *
 * El flujo tiene un hueco conocido: marcar como enviado es manual, así que el
 * local puede abrir WhatsApp y olvidarse de volver. Se resuelve solo cuando
 * entre la API de Meta en la Fase 9; mientras tanto, es el precio de no pagar
 * por mensaje ni pedirle aprobaciones a Meta.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatearParaMostrar } from '@/dominio/telefono';
import { MarcoPanel } from '@/componentes/marco-panel';
import { exigirSesion } from '@/lib/cookies-panel';
import { bandejaPendientes } from '@/servicios/mensajes';
import { quejasSinRevisar } from '@/servicios/opiniones';
import { obtenerLocalDelPanel } from '@/servicios/panel';

import { accionDescartar, accionMarcarEnviado, accionQuejaRevisada } from './acciones';

export default async function PaginaMensajes() {
  const sesion = await exigirSesion();

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const [pendientes, quejas] = await Promise.all([
    bandejaPendientes(sesion.localId),
    quejasSinRevisar(sesion.localId),
  ]);

  return (
    <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>
      <h1>Mensajes por enviar</h1>

      {quejas.length > 0 && (
        <section className="pila">
          <h2>Clientes que no quedaron contentos ({quejas.length})</h2>
          <p className="ayuda">
            Estas quejas llegaron aquí y <strong>no a Google</strong>. Vale la pena responderlas:
            un cliente molesto al que atienden suele volver.
          </p>
          <ul className="lista">
            {quejas.map((queja) => (
              <li key={queja.id} className="fila">
                <span className="fila__titulo">
                  <strong>{queja.clienteNombre}</strong>
                </span>
                <span className="fila__meta">{formatearParaMostrar(queja.telefono)}</span>
                <p className="fila__cita">
                  {queja.comentario ? `«${queja.comentario}»` : 'Sin comentario'}
                </p>
                <div className="acciones">
                  <a
                    className="boton boton--chico"
                    href={`https://wa.me/${queja.telefono}?text=${encodeURIComponent(
                      `Hola ${queja.clienteNombre}, soy de ${local.nombre}. Vi que tu última visita no estuvo bien y quiero arreglarlo.`,
                    )}`}
                  >
                    Escribirle
                  </a>
                  <form action={accionQuejaRevisada}>
                    <input type="hidden" name="opinionId" value={queja.id} />
                    <button type="submit" className="boton--secundario boton--chico">
                      Ya la atendí
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pila">
        <h2>Pendientes ({pendientes.length})</h2>

        {pendientes.length === 0 ? (
          <p className="vacio">
            Nada por enviar hoy. Los mensajes aparecen solos cuando un cliente cumple años, deja
            de venir o acaba de visitarte.
          </p>
        ) : (
          <ul className="lista">
            {pendientes.map((item) => (
              <li key={item.id} className="fila">
                <span className="etiqueta etiqueta--coral">{item.motivo}</span>
                <span className="fila__titulo">
                  <strong>{item.clienteNombre}</strong>
                </span>
                <span className="fila__meta">{formatearParaMostrar(item.telefono)}</span>
                <p className="fila__cita">«{item.texto}»</p>

                {/* El flujo es: abrir WhatsApp, enviar, volver y marcarlo. */}
                <a className="boton" href={item.enlace} target="_blank" rel="noreferrer">
                  Abrir en WhatsApp
                </a>
                <div className="acciones">
                  <form action={accionMarcarEnviado}>
                    <input type="hidden" name="mensajeId" value={item.id} />
                    <button type="submit" className="boton--secundario boton--chico">
                      Ya lo envié
                    </button>
                  </form>
                  <form action={accionDescartar}>
                    <input type="hidden" name="mensajeId" value={item.id} />
                    <button type="submit" className="boton--texto boton--chico">
                      No enviar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/panel/plantillas" className="boton boton--secundario">
        Cambiar los textos de los mensajes
      </Link>
    </MarcoPanel>
  );
}

export const metadata = { title: 'Mensajes · Sello Fiel' };
export const dynamic = 'force-dynamic';
