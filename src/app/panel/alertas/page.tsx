/**
 * Alertas de posible fraude: /panel/alertas (RF-29)
 *
 * RN-09: **avisan, no bloquean**. Un falso positivo que impida sumar un sello
 * delante del cliente hace más daño que el fraude que evitaría. Por eso aquí
 * solo se informa, con el contexto suficiente para que el dueño decida.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { explicarAlerta } from '@/dominio/fraude';
import { exigirSesion } from '@/lib/cookies-panel';
import { alertasSinRevisar } from '@/servicios/antifraude';
import { obtenerLocalDelPanel } from '@/servicios/panel';

import { accionRevisarAlerta } from './acciones';

export default async function PaginaAlertas() {
  const sesion = await exigirSesion();

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const alertas = await alertasSinRevisar(sesion.localId);

  return (
    <main>
      <p>
        <Link href="/panel">← Volver al panel</Link>
      </p>

      <h1>Cosas para revisar</h1>

      {alertas.length === 0 ? (
        <p>Nada raro por ahora.</p>
      ) : (
        <>
          <p>
            Esto no bloquea nada: los sellos se sumaron igual. Son avisos para que les eches un
            ojo y decidas tú.
          </p>
          <ul>
            {alertas.map((alerta) => (
              <li key={alerta.id}>
                <strong>{alerta.clienteNombre ?? 'Sin cliente identificado'}</strong>
                <br />
                {alerta.detalle}
                <br />
                <small>{explicarAlerta(alerta.motivo as never)}</small>
                <br />
                <small>{alerta.creadoEn.toISOString().slice(0, 16).replace('T', ' ')}</small>

                <form action={accionRevisarAlerta}>
                  <input type="hidden" name="alertaId" value={alerta.id} />
                  <input type="hidden" name="estado" value="revisada" />
                  <button type="submit">Ya lo revisé</button>
                </form>
                <form action={accionRevisarAlerta}>
                  <input type="hidden" name="alertaId" value={alerta.id} />
                  <input type="hidden" name="estado" value="descartada" />
                  <button type="submit">Falsa alarma</button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

export const metadata = { title: 'Revisar · Sello Fiel' };
export const dynamic = 'force-dynamic';
