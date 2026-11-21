/**
 * Login del panel: /panel/entrar
 *
 * Email y contraseña, sin más. Los usuarios son dueños de locales, van a ser
 * decenas y no miles, así que un servicio de autenticación externo sería
 * complejidad sin beneficio (RNF-11).
 */

import { redirect } from 'next/navigation';

import { sesionActual } from '@/lib/cookies-panel';

import { FormularioEntrar } from './formulario';

export default async function PaginaEntrar() {
  // Quien ya tiene sesión no necesita volver a entrar.
  if (await sesionActual()) redirect('/panel');

  return (
    <>
      <div className="panel-barra">
        <div className="panel-barra__interior">
          <span className="panel-barra__marca">
            Sello <em>Fiel</em>
          </span>
        </div>
      </div>

      <main className="pagina">
        <div className="pila">
          <h1>Panel de Sello Fiel</h1>
          <p className="texto-suave">Entra para ver tus clientes y tus métricas.</p>
        </div>

        <div className="hoja">
          <FormularioEntrar />
        </div>
      </main>
    </>
  );
}

export const metadata = { title: 'Entrar al panel · Sello Fiel' };
