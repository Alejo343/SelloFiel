/**
 * El marco del panel del dueño.
 *
 * Aquí sí va la marca Sello Fiel: el panel es nuestro producto y la
 * herramienta del local, no la cara que ve su cliente. La barra azul de arriba
 * es la misma identidad que sellofiel.app.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

export function MarcoPanel({
  localNombre,
  volver,
  ancho = false,
  children,
}: {
  /** Se muestra en la barra como referencia, NO como encabezado. */
  localNombre?: string;
  /** Enlace para volver, cuando la pantalla no es la portada. */
  volver?: { href: string; texto: string };
  ancho?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <div className="panel-barra">
        <div className="panel-barra__interior">
          <Link href="/panel" className="panel-barra__marca">
            Sello <em>Fiel</em>
          </Link>
          {localNombre && <p className="panel-barra__local">{localNombre}</p>}
        </div>
      </div>

      <main className={ancho ? 'pagina pagina--ancha' : 'pagina'}>
        {volver && (
          <Link href={volver.href} className="volver">
            ← {volver.texto}
          </Link>
        )}
        {children}
      </main>
    </>
  );
}
