/**
 * Portada del panel: /panel
 *
 * Lo primero que ve el dueño. La métrica estrella es la tasa de retorno, y va
 * explicada en una frase, no como un número suelto: si no entiende de dónde
 * sale, no confía en ella (RF-20).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { diaEnZona } from '@/dominio/fechas';
import { fraseRetorno } from '@/dominio/metricas';
import { exigirSesion } from '@/lib/cookies-panel';
import { contarAlertas } from '@/servicios/antifraude';
import { contarPendientes } from '@/servicios/mensajes';
import { cumpleanosProximos, obtenerLocalDelPanel, resumenDelLocal } from '@/servicios/panel';

import { accionSalir } from './acciones';

export default async function PaginaPanel() {
  const sesion = await exigirSesion();

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const hoy = diaEnZona(new Date(), local.zonaHoraria);
  const inicioDelMes = `${hoy.slice(0, 7)}-01`;

  const [resumen, cumples, pendientes, alertas] = await Promise.all([
    resumenDelLocal(sesion.localId, { desde: inicioDelMes, hasta: hoy }),
    cumpleanosProximos(sesion.localId, hoy, local.diasAntesCumple),
    contarPendientes(sesion.localId),
    contarAlertas(sesion.localId),
  ]);

  return (
    <main>
      <h1>{local.nombre}</h1>

      <section>
        <h2>Este mes</h2>
        <p>
          <strong>Retorno de clientes:</strong> {fraseRetorno(resumen.retorno)}
        </p>
        <ul>
          <li>Clientes en el club: {resumen.clientesTotales}</li>
          <li>Nuevos este mes: {resumen.clientesNuevosEnPeriodo}</li>
          <li>Sellos sumados este mes: {resumen.sellosEnPeriodo}</li>
          <li>Premios entregados este mes: {resumen.canjesEnPeriodo}</li>
          {resumen.sellosPorCanje !== null && (
            <li>Sellos por premio entregado: {resumen.sellosPorCanje}</li>
          )}
        </ul>
      </section>

      {alertas > 0 && (
        <section>
          <h2>Para revisar</h2>
          <p>
            <Link href="/panel/alertas">
              Hay {alertas} {alertas === 1 ? 'cosa' : 'cosas'} que conviene que mires
            </Link>
          </p>
        </section>
      )}

      <section>
        <h2>Mensajes por enviar</h2>
        {pendientes === 0 ? (
          <p>Nada pendiente por ahora.</p>
        ) : (
          <p>
            <strong>
              <Link href="/panel/mensajes">
                Tienes {pendientes} {pendientes === 1 ? 'mensaje' : 'mensajes'} por enviar
              </Link>
            </strong>
          </p>
        )}
      </section>

      <section>
        <h2>Cumpleaños en los próximos {local.diasAntesCumple} días</h2>
        {cumples.length === 0 ? (
          <p>Ninguno por ahora.</p>
        ) : (
          <ul>
            {cumples.map((c) => (
              <li key={c.id}>
                <Link href={`/panel/clientes/${c.id}`}>{c.nombre}</Link>{' '}
                {c.faltan === 0 ? '— ¡hoy!' : `— en ${c.faltan} día${c.faltan === 1 ? '' : 's'}`}
              </li>
            ))}
          </ul>
        )}

      </section>

      <nav>
        <h2>Gestión</h2>
        <ul>
          <li>
            <Link href="/panel/clientes">Mis clientes ({resumen.clientesTotales})</Link>
          </li>
          <li>
            <Link href="/panel/mensajes">Mensajes por enviar ({pendientes})</Link>
          </li>
          <li>
            <Link href="/panel/programa">Configurar el club</Link>
          </li>
          <li>
            <Link href="/panel/pantalla">Código para sumar sellos en la caja</Link>
          </li>
          <li>
            <Link href="/panel/qr">Códigos QR para imprimir</Link>
          </li>
          <li>
            <Link href="/panel/alertas">Cosas para revisar ({alertas})</Link>
          </li>
        </ul>
      </nav>

      <form action={accionSalir}>
        <button type="submit">Salir</button>
      </form>
    </main>
  );
}

export const metadata = { title: 'Panel · Sello Fiel' };
export const dynamic = 'force-dynamic';
