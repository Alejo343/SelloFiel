/**
 * Marco del panel de administrador. Azul oscuro con la etiqueta "Admin" en
 * coral, para que nunca se confunda con el panel de un dueño.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

export function MarcoAdmin({
  volver,
  children,
}: {
  volver?: { href: string; texto: string };
  children: ReactNode;
}) {
  return (
    <>
      <div className="panel-barra" style={{ background: 'var(--navy-deep)' }}>
        <div className="panel-barra__interior">
          <Link href="/admin" className="panel-barra__marca">
            Sello <em>Fiel</em>
          </Link>
          <span className="etiqueta etiqueta--coral">Admin</span>
        </div>
      </div>
      <main className="pagina pagina--ancha">
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
