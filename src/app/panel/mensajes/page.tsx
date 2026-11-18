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
    <main>
      <p>
        <Link href="/panel">← Volver al panel</Link>
      </p>

      <h1>Mensajes por enviar</h1>

      {quejas.length > 0 && (
        <section>
          <h2>Clientes que no quedaron contentos ({quejas.length})</h2>
          <p>
            Estas quejas llegaron aquí y <strong>no a Google</strong>. Vale la pena responderlas:
            un cliente molesto al que atienden suele volver.
          </p>
          <ul>
            {quejas.map((queja) => (
              <li key={queja.id}>
                <strong>{queja.clienteNombre}</strong> — {formatearParaMostrar(queja.telefono)}
                <br />
                {queja.comentario ? <em>«{queja.comentario}»</em> : <em>Sin comentario</em>}
                <br />
                <a
                  href={`https://wa.me/${queja.telefono}?text=${encodeURIComponent(
                    `Hola ${queja.clienteNombre}, soy de ${local.nombre}. Vi que tu última visita no estuvo bien y quiero arreglarlo.`,
                  )}`}
                >
                  Escribirle
                </a>{' '}
                <form action={accionQuejaRevisada} style={{ display: 'inline' }}>
                  <input type="hidden" name="opinionId" value={queja.id} />
                  <button type="submit">Ya la atendí</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Pendientes ({pendientes.length})</h2>

        {pendientes.length === 0 ? (
          <p>
            Nada por enviar hoy. Los mensajes aparecen solos cuando un cliente cumple años, deja
            de venir o acaba de visitarte.
          </p>
        ) : (
          <ul>
            {pendientes.map((item) => (
              <li key={item.id}>
                <strong>{item.clienteNombre}</strong> — {formatearParaMostrar(item.telefono)}
                <br />
                <small>{item.motivo}</small>
                <br />
                <em>«{item.texto}»</em>
                <br />
                {/* Abre WhatsApp con el texto ya escrito. */}
                <a href={item.enlace} target="_blank" rel="noreferrer">
                  Abrir en WhatsApp
                </a>
                <form action={accionMarcarEnviado}>
                  <input type="hidden" name="mensajeId" value={item.id} />
                  <button type="submit">Ya lo envié</button>
                </form>
                <form action={accionDescartar}>
                  <input type="hidden" name="mensajeId" value={item.id} />
                  <button type="submit">No enviar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p>
        <Link href="/panel/plantillas">Cambiar los textos de los mensajes</Link>
      </p>
    </main>
  );
}

export const metadata = { title: 'Mensajes · Sello Fiel' };
export const dynamic = 'force-dynamic';
