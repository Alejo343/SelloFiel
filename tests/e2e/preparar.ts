/**
 * Preparación de las pruebas de punta a punta.
 *
 * Vuelve a sembrar antes de cada corrida, para arrancar siempre del mismo
 * estado conocido. La base la fija `playwright.config.ts`, y NUNCA es la de la
 * aplicación en vivo: la siembra borra todas las tablas.
 */

import { execFileSync } from 'node:child_process';

export default function preparar() {
  const url = process.env.DATABASE_URL;

  /**
   * Salvaguarda: la siembra BORRA todas las tablas. Si por un error de
   * configuración esto apuntara a la base de la aplicación en vivo, se
   * perderían los datos reales. Ya pasó una vez.
   */
  if (!url || !url.split('?')[0].endsWith('_test')) {
    throw new Error(
      `Las pruebas de punta a punta no pueden sembrar "${url}": ` +
        'solo se permite una base que termine en _test. Revisa playwright.config.ts.',
    );
  }

  execFileSync('npm', ['run', 'db:seed'], { stdio: 'inherit', env: process.env });
}
