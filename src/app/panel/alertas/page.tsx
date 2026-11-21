/**
 * Alertas de posible fraude: /panel/alertas (RF-29)
 *
 * RN-09: **avisan, no bloquean**. Un falso positivo que impida sumar un sello
 * delante del cliente hace más daño que el fraude que evitaría. Por eso aquí
 * solo se informa, con el contexto suficiente para que el dueño decida.
 */

import { notFound } from 'next/navigation';

import { explicarAlerta } from '@/dominio/fraude';
import { MarcoPanel } from '@/componentes/marco-panel';
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
    <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>

      <h1>Cosas para revisar</h1>

      {alertas.length === 0 ? (
        <p className="vacio">Nada raro por ahora.</p>
      ) : (
        <>
          <p className="ayuda">
            Esto no bloquea nada: los sellos se sumaron igual. Son avisos para que les eches un
            ojo y decidas tú.
          </p>
          <ul className="lista">
            {alertas.map((alerta) => (
              <li key={alerta.id} className="fila">
                <span className="fila__titulo">
                  {alerta.clienteNombre ?? 'Sin cliente identificado'}
                </span>
                <span className="fila__meta">
                  {alerta.creadoEn.toISOString().slice(0, 16).replace('T', ' ')}
                </span>
                <p className="fila__cita">{alerta.detalle}</p>
                <p className="ayuda">{explicarAlerta(alerta.motivo as never)}</p>

                <div className="acciones">
                  <form action={accionRevisarAlerta}>
                    <input type="hidden" name="alertaId" value={alerta.id} />
                    <input type="hidden" name="estado" value="revisada" />
                    <button type="submit" className="boton--chico">
                      Ya lo revisé
                    </button>
                  </form>
                  <form action={accionRevisarAlerta}>
                    <input type="hidden" name="alertaId" value={alerta.id} />
                    <input type="hidden" name="estado" value="descartada" />
                    <button type="submit" className="boton--texto boton--chico">
                      Falsa alarma
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </MarcoPanel>
  );
}

export const metadata = { title: 'Revisar · Sello Fiel' };
export const dynamic = 'force-dynamic';
