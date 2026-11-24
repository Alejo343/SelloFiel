/**
 * Todos los locales: /admin
 */

import Link from 'next/link';

import { MarcoAdmin } from '@/componentes/marco-admin';
import { exigirAdmin } from '@/lib/cookies-admin';
import { listarLocales } from '@/servicios/admin';

import { accionSalirAdmin } from './acciones';

export default async function PaginaAdmin() {
  await exigirAdmin();

  const locales = await listarLocales();

  return (
    <MarcoAdmin>
      <h1>Locales</h1>

      <Link href="/admin/locales/nuevo" className="boton">
        Crear un local
      </Link>

      {locales.length === 0 ? (
        <p className="vacio">Todavía no hay locales.</p>
      ) : (
        <ul className="lista">
          {locales.map((l) => (
            <li key={l.id} className="fila">
              <span className="fila__titulo">
                <Link href={`/admin/locales/${l.id}`}>{l.nombre}</Link>
              </span>
              <span className="fila__meta">
                /c/{l.slug} · {l.clientes} cliente{l.clientes === 1 ? '' : 's'} · {l.sellosDelMes}{' '}
                sellos este mes · {l.duenoEmail ?? 'sin dueño'}
              </span>
              <div className="acciones" style={{ gap: '0.4rem' }}>
                {!l.activo && <span className="etiqueta etiqueta--coral">Pausado</span>}
                {!l.emitePases && <span className="etiqueta">Sin Google Wallet</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={accionSalirAdmin}>
        <button type="submit" className="boton--texto">Salir</button>
      </form>
    </MarcoAdmin>
  );
}

export const metadata = { title: 'Locales · Admin Sello Fiel' };
export const dynamic = 'force-dynamic';
