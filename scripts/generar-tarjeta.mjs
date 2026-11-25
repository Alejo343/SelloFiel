/**
 * Genera las imágenes del diseño a medida de un local: una por cantidad de
 * sellos, de 0 al objetivo, en 1032×812 (el tamaño de Google Wallet).
 *
 *   node scripts/generar-tarjeta.mjs '<url con {n}>' <objetivo> <carpeta>
 *
 * Ejemplo:
 *   node scripts/generar-tarjeta.mjs \
 *     'https://sellofiel.app/muestras/tarjetas/market/?diseno=1&n={n}' 10 \
 *     /var/www/sellofiel/tarjetas/market/v1
 *
 * La página del diseño tiene que mostrar SOLO la imagen, en un elemento
 * `.hero`, para el número de sellos que llega en la URL. Las imágenes quedan
 * como `sellos-0.jpg` … `sellos-<objetivo>.jpg`, y en el panel de
 * administrador se pone la plantilla `https://…/v1/sellos-{sellos}.jpg`.
 *
 * Para cambiar un diseño ya publicado, generar en una carpeta NUEVA (v2):
 * Google guarda las imágenes en caché por dirección.
 */

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
const sharp = require('sharp');

const [plantilla, objetivoTexto, salida] = process.argv.slice(2);
const objetivo = Number(objetivoTexto);
if (!plantilla?.includes('{n}') || !Number.isInteger(objetivo) || objetivo < 1 || !salida) {
  console.error("Uso: node scripts/generar-tarjeta.mjs '<url con {n}>' <objetivo> <carpeta>");
  process.exit(1);
}

mkdirSync(salida, { recursive: true });
// Mismo Chromium que las pruebas y las capturas (ver playwright.config.ts).
const navegador = await chromium.launch({
  executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1148/chrome-linux/chrome`,
});
try {
  // Ancho de 516 px a escala 2 = 1032 px reales.
  const pagina = await navegador.newPage({ viewport: { width: 516, height: 406 }, deviceScaleFactor: 2 });
  for (let n = 0; n <= objetivo; n += 1) {
    await pagina.goto(plantilla.replaceAll('{n}', String(n)), { waitUntil: 'networkidle' });
    await pagina.evaluate(() => document.fonts.ready);
    const captura = await pagina.locator('.hero').first().screenshot();
    await sharp(captura)
      .resize(1032, 812, { fit: 'cover' })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(`${salida}/sellos-${n}.jpg`);
    console.log(`sellos-${n}.jpg`);
  }
} finally {
  await navegador.close();
}
