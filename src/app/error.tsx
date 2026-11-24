'use client';

/**
 * Pantalla de error de toda la aplicación. Reemplaza la genérica de Next.
 */

import { PantallaError } from '@/componentes/pantalla-error';

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <PantallaError error={error} retry={retry} />;
}
