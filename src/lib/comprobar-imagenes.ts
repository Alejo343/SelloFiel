/**
 * Comprueba que las imágenes de un diseño estén publicadas de verdad.
 *
 * Google descarga las imágenes por su cuenta. Si falta una (la de 7 sellos,
 * digamos), la tarjeta de quien llegue a 7 se queda sin imagen y nadie se
 * entera. Mejor detectarlo al guardar el diseño.
 */
export async function imagenesQueFallan(urls: string[]): Promise<string[]> {
  const fallan: string[] = [];
  // De a pocas: son de nuestro propio servidor y no hay prisa.
  for (let i = 0; i < urls.length; i += 4) {
    const tanda = urls.slice(i, i + 4);
    const resultados = await Promise.all(
      tanda.map(async (url) => {
        try {
          const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
          return r.ok && (r.headers.get('content-type') ?? '').startsWith('image/');
        } catch {
          return false;
        }
      }),
    );
    resultados.forEach((ok, j) => {
      if (!ok) fallan.push(tanda[j]);
    });
  }
  return fallan;
}
