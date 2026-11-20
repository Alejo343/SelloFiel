/**
 * El cliente escanea el código de la pantalla: /s/[codigo]
 *
 * Cada código vale UNA vez y caduca a los pocos segundos. Las dos cosas hacen
 * falta: un solo uso impide reutilizarlo, y la caducidad impide usarlo más
 * tarde si el cliente lo fotografió y nadie más lo usó.
 *
 * Es la versión en software de lo que hace el chip NTAG 424 DNA, que "emite
 * una señal única cada vez que se escanea".
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { mensajeCodigoInvalido } from '@/dominio/fraude';
import { mensajeDelTap, type ResultadoTap } from '@/dominio/sellos';
import { clienteDeLaCookie } from '@/lib/cookies-cliente';
import { sincronizarWalletPronto } from '@/lib/sincronizar-wallet';
import { consumirCodigo, revisarSello } from '@/servicios/antifraude';
import { obtenerCliente } from '@/servicios/clientes';
import { sumarSello } from '@/servicios/sellos';
import { resolverLocalPorId } from '@/servicios/tags';

import { Tarjeta } from '../../c/[slug]/tarjeta/tarjeta';

export default async function PaginaCodigo({ params }: PageProps<'/s/[codigo]'>) {
  const { codigo } = await params;

  /**
   * Primero se mira el código SIN consumirlo, para saber de qué local es y
   * poder reconocer al cliente. Consumirlo antes de saber quién lo escanea
   * quemaría el código de un cliente que todavía no está en el club.
   */
  const previo = await consumirCodigoConCliente(codigo);

  if (!previo.ok) {
    return (
      <main>
        <h1>No pudimos sumar tu sello</h1>
        <p>{mensajeCodigoInvalido(previo.motivo)}</p>
      </main>
    );
  }

  const { local, cliente, resultado } = previo;

  return (
    <main>
      <h1>{local.localNombre}</h1>
      <p>
        Hola, {cliente.nombre}. {mensajeDelTap(resultado)}
      </p>

      {'estado' in resultado && (
        <Tarjeta
          estado={resultado.estado}
          premio={local.premio}
          localSlug={local.localSlug}
          localNombre={local.localNombre}
        />
      )}

      <p>
        <Link href={`/c/${local.localSlug}/tarjeta`}>Ver mi tarjeta</Link>
      </p>
    </main>
  );
}

type Previo =
  | { ok: false; motivo: 'inexistente' | 'usado' | 'expirado' }
  | {
      ok: true;
      local: NonNullable<Awaited<ReturnType<typeof resolverLocalPorId>>>;
      cliente: NonNullable<Awaited<ReturnType<typeof obtenerCliente>>>;
      resultado: ResultadoTap;
    };

async function consumirCodigoConCliente(codigo: string): Promise<Previo> {
  // Se consume con cliente desconocido: lo importante es que nadie más pueda
  // usar este código, aunque luego resulte que quien lo escaneó no está en
  // el club. Un código quemado se reemplaza en segundos; uno reutilizable es
  // un agujero permanente.
  const consumo = await consumirCodigo(codigo, null);
  if (!consumo.ok) return { ok: false, motivo: consumo.motivo };

  const local = await resolverLocalPorId(consumo.localId);
  if (!local) notFound();

  const clienteId = await clienteDeLaCookie(local.localSlug, local.localId);
  const cliente = clienteId ? await obtenerCliente(local.localId, clienteId) : null;

  if (!cliente) {
    // No está en el club: se le manda al alta. Pierde este código, pero el
    // siguiente lo tiene en pantalla.
    return { ok: false, motivo: 'inexistente' };
  }

  const resultado = await sumarSello({
    localId: local.localId,
    clienteId: cliente.id,
    sellosObjetivo: local.sellosObjetivo,
    zonaHoraria: local.zonaHoraria,
    origen: 'qr',
    tagId: consumo.tagId,
  });

  if (resultado.resultado === 'sumado') {
    sincronizarWalletPronto(local.localId);

    const horaLocal = Number(
      new Intl.DateTimeFormat('es-CO', {
        timeZone: local.zonaHoraria,
        hour: '2-digit',
        hour12: false,
      }).format(new Date()),
    );

    await revisarSello({
      localId: local.localId,
      clienteId: cliente.id,
      horaLocal,
    }).catch(() => {
      // Una alerta que falla nunca puede impedir un sello ya guardado.
    });

    return { ok: true, local, cliente, resultado: { tipo: 'sello_sumado', estado: resultado.estado } };
  }

  return {
    ok: true,
    local,
    cliente,
    resultado:
      resultado.motivo === 'ya_sumo_hoy'
        ? { tipo: 'ya_sumo_hoy', estado: resultado.estado }
        : { tipo: 'rechazado', motivo: resultado.motivo },
  };
}

export const dynamic = 'force-dynamic';
