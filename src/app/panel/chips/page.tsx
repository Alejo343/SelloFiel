/**
 * Chips y códigos del local: /panel/chips (RF-30)
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoPanel } from '@/componentes/marco-panel';
import { SelectorSucursal } from '@/componentes/selector-sucursal';
import { exigirSesion } from '@/lib/cookies-panel';
import { listarChips } from '@/servicios/chips';
import { obtenerLocalDelPanel } from '@/servicios/panel';
import { listarSucursales } from '@/servicios/sucursales';

import { accionCrearChip } from './acciones';
import { NOMBRE_TIPO } from './tipos';

export default async function PaginaChips({ searchParams }: PageProps<'/panel/chips'>) {
  const sesion = await exigirSesion();
  const { error } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const [chips, sedes] = await Promise.all([
    listarChips(sesion.localId),
    listarSucursales(sesion.localId),
  ]);
  const variasSedes = sedes.length > 1;

  return (
    <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>
      <h1>Chips y códigos</h1>

      {typeof error === 'string' && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form action={accionCrearChip} className="hoja">
        <h2>Registrar uno nuevo</h2>
        <div className="campo">
          <label htmlFor="objeto">¿Dónde va?</label>
          <input id="objeto" name="objeto" placeholder="Media luna de la caja" required />
        </div>
        <div className="campo">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue="nfc">
            <option value="nfc">Chip NFC: suma sellos al apoyarlo</option>
            <option value="qr_impreso">QR impreso: solo para unirse al club</option>
            <option value="pantalla">Pantalla de caja: código que cambia solo</option>
          </select>
        </div>
        <SelectorSucursal sucursales={sedes} etiqueta="¿En qué sucursal?" />
        <button type="submit">Registrar</button>
      </form>

      {chips.length === 0 ? (
        <p className="vacio">Todavía no hay chips ni códigos registrados.</p>
      ) : (
        <ul className="lista">
          {chips.map((chip) => (
            <li key={chip.id} className="fila">
              <span className="fila__titulo">
                <Link href={`/panel/chips/${chip.id}`}>{chip.objeto ?? 'Sin nombre'}</Link>
              </span>
              <span className="fila__meta">
                {variasSedes && `${chip.sucursalNombre} · `}
                {NOMBRE_TIPO[chip.tipo]} ·{' '}
                {chip.ultimoUso
                  ? `último sello: ${chip.ultimoUso.toISOString().slice(0, 10)}`
                  : 'nunca usado'}
              </span>
              {!chip.activo && <span className="etiqueta">Dado de baja</span>}
            </li>
          ))}
        </ul>
      )}
    </MarcoPanel>
  );
}

export const metadata = { title: 'Chips y códigos · Sello Fiel' };
export const dynamic = 'force-dynamic';
