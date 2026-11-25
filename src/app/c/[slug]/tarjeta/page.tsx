/**
 * La tarjeta del cliente: /c/[slug]/tarjeta
 *
 * Es donde el cliente vuelve a mirar cuántos sellos tiene, sin que eso sume
 * nada. A diferencia del tap, esta pantalla NO muta: entrar diez veces no
 * cambia nada.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoLocal } from '@/componentes/marca-local';
import { clienteDeLaCookie } from '@/lib/cookies-cliente';
import { obtenerCliente } from '@/servicios/clientes';
import { estadoDelClub } from '@/servicios/sellos';
import { resolverLocalPorSlug } from '@/servicios/tags';
import { enlaceDeTarjeta } from '@/servicios/wallet/cola';
import { urlImagenDelEstado } from '@/dominio/wallet';

import { Tarjeta } from './tarjeta';

export default async function PaginaTarjeta({ params }: PageProps<'/c/[slug]/tarjeta'>) {
  const { slug } = await params;

  const local = await resolverLocalPorSlug(slug);
  if (!local) notFound();

  const clienteId = await clienteDeLaCookie(local.localSlug, local.localId);
  const cliente = clienteId ? await obtenerCliente(local.localId, clienteId) : null;

  if (!cliente) {
    return (
      <MarcoLocal local={local} titulo={`Club de ${local.localNombre}`}>
        <p className="aviso">No reconocimos tu tarjeta en este celular.</p>
        <Link className="boton boton--local" href={`/c/${local.localSlug}/alta`}>
          Unirme al club
        </Link>
      </MarcoLocal>
    );
  }

  const [estado, enlaceWallet] = await Promise.all([
    estadoDelClub(cliente.id, local.sellosObjetivo),
    enlaceDeTarjeta(cliente.id),
  ]);

  return (
    <MarcoLocal local={local} titulo={`Club de ${local.localNombre}`}>
      <p className="texto-suave">Hola, {cliente.nombre}.</p>

      <Tarjeta
        estado={estado}
        premio={local.premio}
        localSlug={local.localSlug}
        localNombre={local.localNombre}
        whatsappLocal={local.whatsapp}
        enlaceWallet={enlaceWallet}
        imagenDiseno={urlImagenDelEstado(local.plantillaImagenUrl, estado)}
      />
    </MarcoLocal>
  );
}

export const dynamic = 'force-dynamic';
