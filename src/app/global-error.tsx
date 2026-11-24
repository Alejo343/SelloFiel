'use client';

/**
 * Último recurso: cuando falla incluso el layout raíz. Tiene que pintar su
 * propio <html> y <body>, porque el layout que los pondría es lo que falló.
 */

import { PantallaError } from '@/componentes/pantalla-error';

import './globals.css';

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body>
        <PantallaError error={error} retry={retry} />
      </body>
    </html>
  );
}
