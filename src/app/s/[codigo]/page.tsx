/**
 * El cliente escanea el código de la pantalla de la caja: /s/[codigo]
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

import { MarcoLocal } from '@/componentes/marca-local';
import { mensajeCodigoInvalido } from '@/dominio/fraude';
import { mensajeDelTap, type ResultadoTap } from '@/dominio/sellos';
import { clienteDeLaCookie } from '@/lib/cookies-cliente';
import { sincronizarWalletPronto } from '@/lib/sincronizar-wallet';
import { consumirCodigo, revisarSello } from '@/servicios/antifraude';
import { obtenerCliente } from '@/servicios/clientes';
import { sumarSello } from '@/servicios/sellos';
import { resolverLocalPorId } from '@/servicios/tags';

import { Tarjeta } from '../../c/[slug]/tarjeta/tarjeta';

type Local = NonNullable<Awaited<ReturnType<typeof resolverLocalPorId>>>;

type Resultado =
  | { tipo: 'codigo_invalido'; motivo: 'inexistente' | 'usado' | 'expirado' }
  | { tipo: 'no_es_socio'; local: Local }
  | {
      tipo: 'procesado';
      local: Local;
      clienteNombre: string;
      resultado: ResultadoTap;
    };

export default async function PaginaCodigo({ params }: PageProps<'/s/[codigo]'>) {
  const { codigo } = await params;
  const r = await procesarCodigo(codigo);

  if (r.tipo === 'codigo_invalido') {
    // No se sabe de qué local es: el código no existe o ya no sirve.
    return (
      <main className="pagina">
        <h1>No pudimos sumar tu sello</h1>
        <p className="aviso aviso--error">{mensajeCodigoInvalido(r.motivo)}</p>
      </main>
    );
  }

  if (r.tipo === 'no_es_socio') {
    // Antes este caso decía "ese código no es válido", que era falso y dejaba
    // al cliente sin saber qué hacer. Lo que le falta es unirse al club.
    return (
      <MarcoLocal local={r.local}>
        <p className="aviso">
          Para sumar sellos primero tienes que unirte al club. Es rápido, y después le pides al
          personal que te muestre el código otra vez.
        </p>
        <Link className="boton boton--local" href={`/c/${r.local.localSlug}/alta`}>
          Unirme al club
        </Link>
      </MarcoLocal>
    );
  }

  const { local, clienteNombre, resultado } = r;
  const claseAviso =
    resultado.tipo === 'rechazado'
      ? 'aviso aviso--error'
      : resultado.tipo === 'sello_sumado'
        ? 'aviso aviso--exito'
        : 'aviso';

  return (
    <MarcoLocal local={local}>
      <p className={claseAviso} role="status">
        Hola, {clienteNombre}. {mensajeDelTap(resultado)}
      </p>

      {'estado' in resultado && (
        <Tarjeta
          estado={resultado.estado}
          premio={local.premio}
          localSlug={local.localSlug}
          localNombre={local.localNombre}
        />
      )}
    </MarcoLocal>
  );
}

/**
 * Se consume el código ANTES de saber quién lo escanea, a propósito: lo que
 * importa es que nadie más pueda usarlo. Si quien lo escaneó todavía no está
 * en el club, pierde ese código; pero el siguiente ya está en pantalla, y un
 * código quemado se reemplaza en segundos, mientras que uno reutilizable sería
 * un agujero permanente.
 */
async function procesarCodigo(codigo: string): Promise<Resultado> {
  const consumo = await consumirCodigo(codigo, null);
  if (!consumo.ok) return { tipo: 'codigo_invalido', motivo: consumo.motivo };

  const local = await resolverLocalPorId(consumo.localId);
  if (!local) notFound();

  const clienteId = await clienteDeLaCookie(local.localSlug, local.localId);
  const cliente = clienteId ? await obtenerCliente(local.localId, clienteId) : null;
  if (!cliente) return { tipo: 'no_es_socio', local };

  const sumado = await sumarSello({
    localId: local.localId,
    clienteId: cliente.id,
    sellosObjetivo: local.sellosObjetivo,
    zonaHoraria: local.zonaHoraria,
    origen: 'qr',
    tagId: consumo.tagId,
  });

  if (sumado.resultado === 'sumado') {
    sincronizarWalletPronto(local.localId);

    const horaLocal = Number(
      new Intl.DateTimeFormat('es-CO', {
        timeZone: local.zonaHoraria,
        hour: '2-digit',
        hour12: false,
      }).format(new Date()),
    );

    // Una alerta que falla nunca puede impedir un sello ya guardado.
    await revisarSello({ localId: local.localId, clienteId: cliente.id, horaLocal }).catch(
      () => undefined,
    );

    return {
      tipo: 'procesado',
      local,
      clienteNombre: cliente.nombre,
      resultado: { tipo: 'sello_sumado', estado: sumado.estado },
    };
  }

  return {
    tipo: 'procesado',
    local,
    clienteNombre: cliente.nombre,
    resultado:
      sumado.motivo === 'ya_sumo_hoy'
        ? { tipo: 'ya_sumo_hoy', estado: sumado.estado }
        : { tipo: 'rechazado', motivo: sumado.motivo },
  };
}

export const dynamic = 'force-dynamic';
