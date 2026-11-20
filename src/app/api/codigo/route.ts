/**
 * Emite un código de un solo uso para la pantalla del local.
 *
 * Es un Route Handler y no una acción de servidor a propósito: la pantalla lo
 * llama cada pocos segundos desde el navegador, y una URL estable aguanta los
 * despliegues mejor que una acción, cuyo identificador cambia al recompilar.
 */

import { NextResponse } from 'next/server';

import { SEGUNDOS_DE_VIDA_CODIGO } from '@/dominio/fraude';
import { exigirSesion } from '@/lib/cookies-panel';
import { emitirCodigo } from '@/servicios/antifraude';
import { listarTags } from '@/servicios/panel';

export async function POST(peticion: Request) {
  // Solo el local autenticado puede pedir códigos: si no, cualquiera
  // generaría los suyos y se sumaría sellos desde casa.
  const sesion = await exigirSesion();

  const { tagId } = (await peticion.json().catch(() => ({}))) as { tagId?: string };

  // El tag tiene que ser de ESTE local, aunque el id venga del navegador.
  const tags = await listarTags(sesion.localId);
  const tag = tags.find((t) => t.id === tagId && t.activo && t.tipo === 'pantalla');

  if (!tag) {
    return NextResponse.json({ error: 'Pantalla no encontrada' }, { status: 404 });
  }

  const { codigo, expiraEn } = await emitirCodigo(tag.id, sesion.localId);

  return NextResponse.json({
    codigo,
    expiraEn: expiraEn.toISOString(),
    vidaSegundos: SEGUNDOS_DE_VIDA_CODIGO,
  });
}
