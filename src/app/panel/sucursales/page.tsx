/**
 * Las sedes del local: /panel/sucursales (RF-32)
 *
 * Una sola tarjeta para todas: el cliente junta sellos en cualquiera. Cada
 * sede tiene su ubicación y su ficha de Google Maps.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoPanel } from '@/componentes/marco-panel';
import { diaEnZona } from '@/dominio/fechas';
import { exigirSesion } from '@/lib/cookies-panel';
import { obtenerLocalDelPanel } from '@/servicios/panel';
import { resumenPorSucursal } from '@/servicios/sucursales';

import { FormularioSucursal } from './formulario';

export default async function PaginaSucursales({ searchParams }: PageProps<'/panel/sucursales'>) {
  const sesion = await exigirSesion();
  const { creada } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const inicioMes = `${diaEnZona(new Date(), local.zonaHoraria).slice(0, 7)}-01`;
  const sedes = await resumenPorSucursal(sesion.localId, inicioMes);

  return (
    <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>
      <h1>Sucursales</h1>
      <p className="ayuda">
        Tus clientes tienen una sola tarjeta y suman sellos en cualquier sucursal. Igual que en una
        sola, se suma un sello por día: ir a dos sedes el mismo día no da dos.
      </p>

      {creada && <p className="aviso aviso--exito">Sucursal agregada. Ahora registra sus chips.</p>}

      <ul className="lista">
        {sedes.map((s) => (
          <li key={s.id} className="fila">
            <span className="fila__titulo">
              <Link href={`/panel/sucursales/${s.id}`}>{s.nombre}</Link>
            </span>
            <span className="fila__meta">
              {s.sellosDelPeriodo} {s.sellosDelPeriodo === 1 ? 'sello' : 'sellos'} este mes · {s.chips}{' '}
              {s.chips === 1 ? 'chip o código' : 'chips o códigos'}
            </span>
            {!s.activa && <span className="etiqueta">Cerrada</span>}
          </li>
        ))}
      </ul>

      <FormularioSucursal />
    </MarcoPanel>
  );
}

export const metadata = { title: 'Sucursales · Sello Fiel' };
export const dynamic = 'force-dynamic';
