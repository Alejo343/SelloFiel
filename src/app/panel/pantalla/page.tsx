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

import { exigirSesion } from '@/lib/cookies-panel';
import { emitirCodigo } from '@/servicios/antifraude';
import { listarTags, obtenerLocalDelPanel } from '@/servicios/panel';

import { PantallaRotativa } from './pantalla-rotativa';

export default async function PaginaPantalla() {
  const sesion = await exigirSesion();

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const tags = await listarTags(sesion.localId);
  const pantallas = tags.filter((t) => t.tipo === 'pantalla' && t.activo);

  if (pantallas.length === 0) {
    return (
      <main>
        <p>
          <Link href="/panel">← Volver al panel</Link>
        </p>
        <h1>Código para sumar sellos</h1>
        <p>
          Este local todavía no tiene una pantalla configurada. El alta de pantallas y chips
          llega con la Fase 7.
        </p>
      </main>
    );
  }

  // El primer código se emite acá, para que el QR aparezca ya dibujado.
  const { codigo } = await emitirCodigo(pantallas[0].id, sesion.localId);

  return (
    <main>
      <p className="sin-imprimir">
        <Link href="/panel">← Volver al panel</Link>
      </p>

      <h1>{local.nombre}</h1>
      <p>Escanea este código para sumar tu sello</p>

      <PantallaRotativa
        tagId={pantallas[0].id}
        urlQr="/api/codigo/qr"
        codigoInicial={codigo}
      />

      <p>
        <small>
          Deja esta página abierta en la caja. El código cambia solo y cada uno vale una sola
          vez, así que una foto no le sirve a nadie.
        </small>
      </p>
    </main>
  );
}

export const metadata = { title: 'Código para sellos · Sello Fiel' };
export const dynamic = 'force-dynamic';
