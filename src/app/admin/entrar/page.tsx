import { redirect } from 'next/navigation';

import { MarcoAdmin } from '@/componentes/marco-admin';
import { sesionAdminActual } from '@/lib/cookies-admin';

import { FormularioEntrarAdmin } from './formulario';

export default async function PaginaEntrarAdmin() {
  if (await sesionAdminActual()) redirect('/admin');
  return (
    <MarcoAdmin>
      <h1>Administración</h1>
      <div className="hoja">
        <FormularioEntrarAdmin />
      </div>
    </MarcoAdmin>
  );
}

export const metadata = { title: 'Administración · Sello Fiel' };
