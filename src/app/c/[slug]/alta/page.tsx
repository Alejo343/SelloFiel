/**
 * Alta al club: /c/[slug]/alta
 *
 * Llega por dos caminos: el enlace de la pantalla del tap (con ?t=token) o el
 * QR impreso del local (sin token). El token solo sirve para registrar de
 * dónde vino el cliente y sumarle el sello de esta visita.
 *
 * Es el único momento en que el cliente escribe algo, así que la pantalla
 * tiene que verse confiable: es la marca de SU restaurante pidiéndole datos,
 * no un formulario genérico.
 */

import { notFound } from 'next/navigation';

import { MarcoLocal } from '@/componentes/marca-local';
import { resolverLocalPorSlug } from '@/servicios/tags';

import { FormularioAlta } from './formulario';

export default async function PaginaAlta({ params, searchParams }: PageProps<'/c/[slug]/alta'>) {
  const { slug } = await params;
  const { t } = await searchParams;

  const local = await resolverLocalPorSlug(slug);
  if (!local) notFound();

  const token = typeof t === 'string' ? t : undefined;

  return (
    <MarcoLocal local={local} titulo={`Club de ${local.localNombre}`}>
      <div className="hoja">
        <p>
          Suma un sello por visita. Al llegar a {local.sellosObjetivo}:{' '}
          <strong>{local.premio}</strong>.
        </p>

        {local.beneficioBienvenida && (
          <p className="aviso aviso--exito">Por unirte hoy: {local.beneficioBienvenida}</p>
        )}
      </div>

      <FormularioAlta slug={local.localSlug} localNombre={local.localNombre} token={token} />
    </MarcoLocal>
  );
}

export async function generateMetadata({ params }: PageProps<'/c/[slug]/alta'>) {
  const { slug } = await params;
  const local = await resolverLocalPorSlug(slug);
  return { title: local ? `Unirme al club de ${local.localNombre}` : 'Sello Fiel' };
}
