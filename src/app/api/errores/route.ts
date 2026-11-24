/**
 * Recibe los errores que ocurren en el navegador del cliente.
 *
 * Existe porque un error en el navegador NO deja rastro en el servidor: el
 * 2026-11-24 David vio la pantalla de error genérica de Next al enviar el alta,
 * y en los registros no había nada. Sin esto, cada fallo así es invisible.
 *
 * Se escribe en el registro de la aplicación (pm2 logs sellofiel), con el
 * prefijo [cliente] para encontrarlo. Es una ruta pública, así que no se confía
 * en lo que llega: se recorta todo y se limita cuántos se aceptan por minuto,
 * para que nadie pueda llenar el registro a propósito.
 */

import { NextResponse } from 'next/server';

const MAXIMO_POR_MINUTO = 30;
let ventanaInicio = Date.now();
let enVentana = 0;

function recortar(valor: unknown, largo: number): string {
  return String(valor ?? '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, largo);
}

export async function POST(peticion: Request) {
  const ahora = Date.now();
  if (ahora - ventanaInicio > 60_000) {
    ventanaInicio = ahora;
    enVentana = 0;
  }
  enVentana += 1;
  if (enVentana > MAXIMO_POR_MINUTO) return new NextResponse(null, { status: 429 });

  const texto = await peticion.text();
  if (texto.length > 8_000) return new NextResponse(null, { status: 413 });

  let datos: Record<string, unknown> = {};
  try {
    datos = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  console.error(
    `[cliente] ${recortar(datos.ruta, 200)} | ${recortar(datos.mensaje, 500)}` +
      (datos.digest ? ` | digest=${recortar(datos.digest, 60)}` : '') +
      ` | ${recortar(datos.navegador, 200)}` +
      (datos.pila ? `\n  ${recortar(datos.pila, 1500)}` : ''),
  );

  return new NextResponse(null, { status: 204 });
}
