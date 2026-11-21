/**
 * Base de clientes del local: /panel/clientes (RF-19)
 *
 * Ordenada por última visita, que es el orden en que al dueño le interesa
 * mirarla: arriba quien acaba de venir, abajo quien se está perdiendo.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoPanel } from '@/componentes/marco-panel';
import { formatearParaMostrar } from '@/dominio/telefono';
import { exigirSesion } from '@/lib/cookies-panel';
import { listarClientes, obtenerLocalDelPanel } from '@/servicios/panel';

export default async function PaginaClientes({ searchParams }: PageProps<'/panel/clientes'>) {
  const sesion = await exigirSesion();
  const { q } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const busqueda = typeof q === 'string' ? q : undefined;
  const clientes = await listarClientes(sesion.localId, { busqueda });

  return (
    <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>
      <h1>Mis clientes</h1>

      <form method="get" className="hoja">
        <div className="campo">
          <label htmlFor="q">Buscar por nombre o teléfono</label>
          <input id="q" name="q" type="search" defaultValue={busqueda ?? ''} />
        </div>
        <button type="submit">Buscar</button>
      </form>

      {busqueda && (
        <p className="texto-suave">
          {clientes.length} resultado{clientes.length === 1 ? '' : 's'} para «{busqueda}».{' '}
          <Link href="/panel/clientes">Ver todos</Link>
        </p>
      )}

      {clientes.length === 0 ? (
        <p className="vacio">
          {busqueda
            ? 'Ningún cliente coincide con esa búsqueda.'
            : 'Todavía no hay clientes en el club. Imprime tu QR y empieza a sumarlos.'}
        </p>
      ) : (
        <ul className="lista">
          {clientes.map((cliente) => (
            <li key={cliente.id} className="fila">
              <span className="fila__titulo">
                <Link href={`/panel/clientes/${cliente.id}`}>{cliente.nombre}</Link>
              </span>
              <span className="fila__meta">
                {formatearParaMostrar(cliente.telefono)} · {cliente.sellosDisponibles}/
                {local.sellosObjetivo} sellos · {cliente.visitasTotales} visita
                {cliente.visitasTotales === 1 ? '' : 's'} ·{' '}
                {cliente.ultimoSello ? `última: ${cliente.ultimoSello}` : 'sin visitas'}
              </span>
              {cliente.sellosDisponibles >= local.sellosObjetivo && (
                <span className="etiqueta etiqueta--verde">Premio disponible</span>
              )}
              {cliente.dadoDeBaja && <span className="etiqueta">Pidió la baja</span>}
            </li>
          ))}
        </ul>
      )}
    </MarcoPanel>
  );
}

export const metadata = { title: 'Mis clientes · Sello Fiel' };
export const dynamic = 'force-dynamic';
