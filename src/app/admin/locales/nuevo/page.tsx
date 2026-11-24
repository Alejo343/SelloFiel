import { MarcoAdmin } from '@/componentes/marco-admin';
import { exigirAdmin } from '@/lib/cookies-admin';

import { FormularioNuevoLocal } from './formulario';

export default async function PaginaNuevoLocal() {
  await exigirAdmin();
  return (
    <MarcoAdmin volver={{ href: '/admin', texto: 'Volver a los locales' }}>
      <h1>Crear un local</h1>
      <FormularioNuevoLocal urlPublica={process.env.URL_PUBLICA ?? 'http://localhost:3011'} />
    </MarcoAdmin>
  );
}

export const metadata = { title: 'Nuevo local · Admin Sello Fiel' };
export const dynamic = 'force-dynamic';
