/**
 * Capturas de pantalla para revisar el diseño en un celular simulado.
 *
 *   node scripts/capturas.mjs [carpeta-de-salida]
 *   COLOR_LOCAL=#ffe066 node scripts/capturas.mjs /tmp/amarillo
 *
 * Con COLOR_LOCAL se pinta La Esquina de otro color, para ver cómo queda la
 * marca de un local con un color difícil (claro, saturado, casi negro).
 *
 * Levanta su propio servidor en el puerto 3013 contra la base de PRUEBAS y sin
 * credenciales de Google, así que no toca los datos reales ni crea nada en la
 * cuenta de emisor. Siembra esa base, recorre las pantallas y guarda una
 * imagen de cada una.
 *
 * Existe porque en diseño lo que no se mira se equivoca: las pruebas verifican
 * que las cosas funcionen, no que se vean bien.
 */

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setTimeout as esperar } from 'node:timers/promises';

import 'dotenv/config';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('@playwright/test');

const PUERTO = 3013;
const BASE = `http://127.0.0.1:${PUERTO}`;
const SALIDA = process.argv[2] ?? '/tmp/capturas-sellofiel';
const URL_BD = process.env.DATABASE_URL_TEST;

if (!URL_BD || !URL_BD.split('?')[0].endsWith('_test')) {
  console.error('DATABASE_URL_TEST tiene que apuntar a una base *_test. Abortando.');
  process.exit(1);
}

const entorno = {
  ...process.env,
  DATABASE_URL: URL_BD,
  WALLET_ISSUER_ID: '',
  WALLET_CREDENCIALES_ARCHIVO: '',
  WALLET_CUENTA_SERVICIO_EMAIL: '',
  WALLET_CLAVE_PRIVADA: '',
};

mkdirSync(SALIDA, { recursive: true });

console.log('Sembrando la base de pruebas...');
execFileSync('npm', ['run', 'db:seed'], { env: entorno, stdio: 'ignore' });

if (process.env.COLOR_LOCAL) {
  const nombreBd = URL_BD.split('?')[0].split('/').pop();
  execFileSync('psql', [
    '-d', nombreBd, '-c',
    `update locales set color_primario = '${process.env.COLOR_LOCAL.replace(/[^#0-9a-fA-F]/g, '')}' where slug = 'la-esquina'`,
  ], { stdio: 'ignore' });
}

// Mensajes pendientes, para ver la bandeja como la ve el dueño un día normal.
execFileSync('npx', ['tsx', 'scripts/generar-mensajes.ts'], { env: entorno, stdio: 'ignore' });

console.log('Levantando el servidor...');
const servidor = spawn('npx', ['next', 'dev', '--port', String(PUERTO)], {
  env: entorno,
  stdio: 'ignore',
  detached: true,
});

async function esperarServidor() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(BASE);
      if (r.status < 500) return;
    } catch {
      // todavía no arranca
    }
    await esperar(1000);
  }
  throw new Error('El servidor no arrancó');
}

const PANTALLAS_CLIENTE = [
  ['01-tap-cliente-nuevo', '/t/tag-esquina-caja'],
  ['02-alta', '/c/la-esquina/alta'],
  ['03-politica', '/c/la-esquina/politica'],
];

try {
  await esperarServidor();

  const navegador = await chromium.launch({
    executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1148/chrome-linux/chrome`,
  });
  const contexto = await navegador.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1 });
  const pagina = await contexto.newPage();

  for (const [nombre, ruta] of PANTALLAS_CLIENTE) {
    await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: true });
    console.log(`  ${nombre}`);
  }

  // Alta real, para ver la tarjeta con su primer sello.
  await pagina.goto(`${BASE}/t/tag-esquina-caja`, { waitUntil: 'networkidle' });
  await pagina.getByRole('link', { name: /unirme al club/i }).click();
  await pagina.getByLabel('Tu nombre').fill('Marta Prueba');
  await pagina.getByLabel('Tu WhatsApp').fill('3005551234');
  await pagina.getByRole('checkbox').check();
  await pagina.getByRole('button', { name: /unirme al club/i }).click();
  await pagina.waitForURL(/tarjeta$/);
  await pagina.screenshot({ path: `${SALIDA}/04-tarjeta-primer-sello.png`, fullPage: true });
  console.log('  04-tarjeta-primer-sello');

  await pagina.goto(`${BASE}/t/tag-esquina-caja`, { waitUntil: 'networkidle' });
  await pagina.screenshot({ path: `${SALIDA}/05-tap-ya-sumo-hoy.png`, fullPage: true });
  console.log('  05-tap-ya-sumo-hoy');

  // El panel.
  await pagina.goto(`${BASE}/panel/entrar`, { waitUntil: 'networkidle' });
  await pagina.screenshot({ path: `${SALIDA}/10-panel-entrar.png`, fullPage: true });
  await pagina.getByLabel('Correo').fill('dueno@laesquina.test');
  await pagina.getByLabel('Contraseña').fill('sellofiel2026');
  await pagina.getByRole('button', { name: /entrar/i }).click();
  await pagina.waitForURL(/\/panel$/);

  for (const [nombre, ruta] of [
    ['11-panel-inicio', '/panel'],
    ['12-panel-clientes', '/panel/clientes'],
    ['13-panel-mensajes', '/panel/mensajes'],
    ['14-panel-programa', '/panel/programa'],
    ['15-panel-pantalla', '/panel/pantalla'],
  ]) {
    await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: true });
    console.log(`  ${nombre}`);
  }

  // La opinión necesita una visita real: se toma una de la base de pruebas.
  const nombreBd = URL_BD.split('?')[0].split('/').pop();
  const selloId = execFileSync('psql', [
    '-d', nombreBd, '-tAc',
    "select s.id from sellos s join locales l on l.id = s.local_id where l.slug = 'la-esquina' limit 1",
  ]).toString().trim();

  for (const [nombre, ruta] of [
    ['06-opinion', `/c/la-esquina/opinion/${selloId}`],
    ['07-opinion-gracias', `/c/la-esquina/opinion/${selloId}?gracias=buena`],
    ['08-codigo-invalido', '/s/codigo-inventado'],
  ]) {
    await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: true });
    console.log(`  ${nombre}`);
  }

  await navegador.close();
  console.log(`\nCapturas en ${SALIDA}`);
} finally {
  // Se mata el grupo entero: next dev deja procesos hijos.
  try {
    process.kill(-servidor.pid, 'SIGTERM');
  } catch {
    // ya había terminado
  }
}
