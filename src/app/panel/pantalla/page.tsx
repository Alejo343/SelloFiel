/**
 * La pantalla de la caja: /panel/pantalla
 *
 * El local deja esto abierto en un celular o tablet junto a la caja. Muestra
 * un QR que se renueva solo y que vale una sola vez.
 *
 * Es la alternativa al chip NFC para locales que no compren los chips buenos:
 * misma protección, sin hardware, a cambio de que el cliente tenga que
 * escanear en vez de apoyar el teléfono.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoPanel } from '@/componentes/marco-panel';
import { exigirSesion } from '@/lib/cookies-panel';
import { emitirCodigo } from '@/servicios/antifraude';
import { listarChips } from '@/servicios/chips';
import { obtenerLocalDelPanel } from '@/servicios/panel';
import { listarSucursales } from '@/servicios/sucursales';

import { PantallaRotativa } from './pantalla-rotativa';

export default async function PaginaPantalla({ searchParams }: PageProps<'/panel/pantalla'>) {
  const sesion = await exigirSesion();
  const { tag } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const [chips, sedes] = await Promise.all([
    listarChips(sesion.localId),
    listarSucursales(sesion.localId, undefined, { soloActivas: true }),
  ]);
  const abiertas = new Set(sedes.map((s) => s.id));
  // Solo pantallas activas de sedes abiertas: las demás no suman.
  const pantallas = chips.filter((t) => t.tipo === 'pantalla' && t.activo && abiertas.has(t.sucursalId));
  const elegida = pantallas.find((p) => p.id === tag) ?? (pantallas.length === 1 ? pantallas[0] : null);

  if (pantallas.length === 0) {
    return (
      <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>
        <h1>Código para sumar sellos</h1>
        <p className="vacio">
          Todavía no tienes una pantalla de caja. Regístrala en{' '}
          <Link href="/panel/chips">Chips y códigos</Link> con el tipo «Pantalla de caja».
        </p>
      </MarcoPanel>
    );
  }

  // Con varias sedes (o varias cajas), cada pantalla es de una: se elige cuál.
  if (!elegida) {
    return (
      <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>
        <h1>¿Qué caja es esta?</h1>
        <p className="ayuda">Los sellos que se sumen con esta pantalla cuentan para esa sucursal.</p>
        <ul className="menu-panel">
          {pantallas.map((p) => (
            <li key={p.id}>
              <Link href={`/panel/pantalla?tag=${p.id}`}>
                {p.sucursalNombre} · {p.objeto ?? 'Pantalla'}
              </Link>
            </li>
          ))}
        </ul>
      </MarcoPanel>
    );
  }

  // El primer código se emite acá, para que el QR aparezca ya dibujado.
  const { codigo } = await emitirCodigo(elegida.id, sesion.localId);

  return (
    <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>

      <div className="pila centrado">
        <h1>{local.nombre}</h1>
        {sedes.length > 1 && <p className="texto-suave">Sucursal {elegida.sucursalNombre}</p>}
        <p className="texto-suave">Escanea este código para sumar tu sello</p>
      </div>

      <div className="pantalla-qr">
        <PantallaRotativa
          tagId={elegida.id}
          urlQr="/api/codigo/qr"
          codigoInicial={codigo}
        />
      </div>

      <p className="ayuda centrado sin-imprimir">
        Deja esta página abierta en la caja. El código cambia solo y cada uno vale una sola vez,
        así que una foto no le sirve a nadie.
      </p>
    </MarcoPanel>
  );
}

export const metadata = { title: 'Código para sellos · Sello Fiel' };
export const dynamic = 'force-dynamic';
