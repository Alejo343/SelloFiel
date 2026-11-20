/**
 * Dibuja el QR de un código. Devuelve SVG para que la pantalla del local no
 * necesite una librería de códigos QR en el navegador.
 */

import QRCode from 'qrcode';

import { exigirSesion } from '@/lib/cookies-panel';

const BASE_PUBLICA = () => process.env.URL_PUBLICA ?? 'http://localhost:3011';

export async function GET(peticion: Request) {
  // Solo el local autenticado: el QR lleva dentro un código consumible.
  await exigirSesion();

  const codigo = new URL(peticion.url).searchParams.get('c');
  if (!codigo) return new Response('Falta el código', { status: 400 });

  const svg = await QRCode.toString(`${BASE_PUBLICA()}/s/${encodeURIComponent(codigo)}`, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    width: 280,
  });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      // Nunca se cachea: cada código es distinto y vive unos segundos.
      'Cache-Control': 'no-store',
    },
  });
}
