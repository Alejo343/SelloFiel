/**
 * Portada del panel: /panel
 *
 * Lo primero que ve el dueño. La métrica estrella es la tasa de retorno, y va
 * explicada en una frase, no como un número suelto: si no entiende de dónde
 * sale, no confía en ella (RF-20).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoPanel } from '@/componentes/marco-panel';
import { diaEnZona } from '@/dominio/fechas';
import { fraseRetorno } from '@/dominio/metricas';
import { exigirSesion } from '@/lib/cookies-panel';
import { contarAlertas } from '@/servicios/antifraude';
import { contarPendientes } from '@/servicios/mensajes';
import { cumpleanosProximos, obtenerLocalDelPanel, resumenDelLocal } from '@/servicios/panel';
import { resumenPorSucursal } from '@/servicios/sucursales';

import { accionSalir } from './acciones';

export default async function PaginaPanel() {
  const sesion = await exigirSesion();

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const hoy = diaEnZona(new Date(), local.zonaHoraria);
  const inicioDelMes = `${hoy.slice(0, 7)}-01`;

  const [resumen, cumples, pendientes, alertas, sedes] = await Promise.all([
    resumenDelLocal(sesion.localId, { desde: inicioDelMes, hasta: hoy }),
    cumpleanosProximos(sesion.localId, hoy, local.diasAntesCumple),
    contarPendientes(sesion.localId),
    contarAlertas(sesion.localId),
    resumenPorSucursal(sesion.localId, inicioDelMes),
  ]);
  const sedesAbiertas = sedes.filter((s) => s.activa);

  return (
    <MarcoPanel>
      <h1>{local.nombre}</h1>

      {/* La métrica estrella, explicada en una frase: si el dueño no entiende
          de dónde sale el número, no confía en él (RF-20). */}
      <section className="destacado">
        <p className="destacado__titulo">Retorno de clientes · este mes</p>
        <p>{fraseRetorno(resumen.retorno)}</p>
      </section>

      {/* Lo que hay que hacer hoy va antes que los números. */}
      {pendientes > 0 && (
        <Link href="/panel/mensajes" className="boton">
          Tienes {pendientes} {pendientes === 1 ? 'mensaje' : 'mensajes'} por enviar
        </Link>
      )}

      {alertas > 0 && (
        <Link href="/panel/alertas" className="aviso aviso--error">
          Hay {alertas} {alertas === 1 ? 'cosa' : 'cosas'} que conviene que mires
        </Link>
      )}

      <section className="pila">
        <h2>Este mes</h2>
        <div className="metricas">
          <Metrica etiqueta="Clientes en el club" valor={resumen.clientesTotales} />
          <Metrica etiqueta="Nuevos este mes" valor={resumen.clientesNuevosEnPeriodo} />
          <Metrica etiqueta="Sellos sumados" valor={resumen.sellosEnPeriodo} />
          <Metrica etiqueta="Premios entregados" valor={resumen.canjesEnPeriodo} />
        </div>
        {sedesAbiertas.length > 1 && (
          <ul className="lista" aria-label="Sellos por sucursal">
            {sedesAbiertas.map((s) => (
              <li key={s.id} className="fila">
                <span className="fila__titulo">{s.nombre}</span>
                <span className="fila__meta">
                  {s.sellosDelPeriodo} {s.sellosDelPeriodo === 1 ? 'sello' : 'sellos'} este mes
                </span>
              </li>
            ))}
          </ul>
        )}
        {resumen.sellosPorCanje !== null && (
          <p className="ayuda">Sellos por premio entregado: {resumen.sellosPorCanje}</p>
        )}
      </section>

      <section className="pila">
        <h2>Cumpleaños en los próximos {local.diasAntesCumple} días</h2>
        {cumples.length === 0 ? (
          <p className="vacio">Ninguno por ahora.</p>
        ) : (
          <ul className="lista">
            {cumples.map((c) => (
              <li key={c.id} className="fila">
                <span className="fila__titulo">
                  <Link href={`/panel/clientes/${c.id}`}>{c.nombre}</Link>
                </span>
                <span className="fila__meta">
                  {c.faltan === 0 ? '¡Es hoy!' : `En ${c.faltan} día${c.faltan === 1 ? '' : 's'}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="pila" aria-label="Gestión">
        <h2>Gestión</h2>
        <ul className="menu-panel">
          <li>
            <Link href="/panel/clientes">Mis clientes ({resumen.clientesTotales})</Link>
          </li>
          <li>
            <Link href="/panel/mensajes">Mensajes por enviar ({pendientes})</Link>
          </li>
          <li>
            <Link href="/panel/campanas">Campañas: un mensaje para muchos</Link>
          </li>
          <li>
            <Link href="/panel/sucursales">Sucursales ({sedesAbiertas.length})</Link>
          </li>
          <li>
            <Link href="/panel/chips">Chips y códigos</Link>
          </li>
          <li>
            <Link href="/panel/pantalla">Código para sumar sellos en la caja</Link>
          </li>
          <li>
            <Link href="/panel/programa">Configurar el club</Link>
          </li>
          <li>
            <Link href="/panel/qr">Códigos QR para imprimir</Link>
          </li>
          <li>
            <Link href="/panel/alertas">Cosas para revisar ({alertas})</Link>
          </li>
          <li>
            <Link href="/panel/cuenta">Cambiar mi contraseña</Link>
          </li>
        </ul>
      </nav>

      <form action={accionSalir}>
        <button type="submit" className="boton--texto">
          Salir
        </button>
      </form>
    </MarcoPanel>
  );
}

/**
 * Una métrica: número grande y etiqueta.
 *
 * El grupo lleva como nombre accesible la frase completa ("Clientes en el
 * club: 6"), para que un lector de pantalla la lea entera en vez de soltar un
 * número suelto y después su etiqueta.
 */
function Metrica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="metrica" role="group" aria-label={`${etiqueta}: ${valor}`}>
      <span className="metrica__valor">{valor}</span>
      <span className="metrica__etiqueta">{etiqueta}</span>
    </div>
  );
}

export const metadata = { title: 'Panel · Sello Fiel' };
export const dynamic = 'force-dynamic';
