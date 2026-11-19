import 'dotenv/config';

import { defineConfig, devices } from '@playwright/test';

/**
 * Las pruebas de punta a punta usan su PROPIA base de datos.
 *
 * Antes usaban la misma que la aplicación en vivo, y como la siembra borra
 * todas las tablas, cada corrida destruía los datos reales. Pasó de verdad el
 * 2026-11-19: una corrida borró el cliente con el que David estaba probando
 * el sistema a mano.
 *
 * Se asigna aquí, en la configuración, porque este archivo lo cargan tanto la
 * preparación como cada proceso de prueba y el servidor que se levanta.
 */
const URL_BASE_E2E =
  process.env.DATABASE_URL_E2E ??
  process.env.DATABASE_URL_TEST ??
  'postgres:///fidelizacion_test?host=/var/run/postgresql';

process.env.DATABASE_URL = URL_BASE_E2E;

/**
 * Pruebas de punta a punta.
 *
 * Se corren en un móvil simulado a propósito: el 100% de los clientes finales
 * entra desde el teléfono (RNF-02), así que probar en escritorio daría una
 * confianza falsa.
 */
/**
 * Puerto propio, DISTINTO del de producción (3011).
 *
 * Antes compartían el 3011 y Playwright reutilizaba el servidor de
 * producción: las pruebas corrían contra la aplicación en vivo y con la
 * compilación que estuviera desplegada, no con el código recién escrito.
 */
const PUERTO = 3012;

export default defineConfig({
  testDir: './tests/e2e',
  // Siembra la base antes de correr, para arrancar siempre del mismo estado.
  globalSetup: './tests/e2e/preparar.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    // Grabar la traza de cada prueba consume mucha CPU. Se activa a mano
    // cuando hay que depurar una falla: npm run test:e2e -- --trace on
    trace: 'off',
    launchOptions: {
      /**
       * El VPS ya tiene un Chromium de Playwright descargado. Apuntarlo evita
       * bajar otro navegador de ~150 MB cada vez que Playwright se actualiza.
       * Si algún día no está, se sobreescribe con la variable CHROMIUM_PATH.
       */
      executablePath:
        process.env.CHROMIUM_PATH ??
        `${process.env.HOME}/.cache/ms-playwright/chromium-1148/chrome-linux/chrome`,
    },
  },
  projects: [
    {
      name: 'movil',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `npx next dev --port ${PUERTO}`,
    env: { ...process.env, DATABASE_URL: URL_BASE_E2E },
    url: `http://127.0.0.1:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
