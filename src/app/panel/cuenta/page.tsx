/**
 * Cambiar la contraseña del dueño: /panel/cuenta
 *
 * Obligatoria la primera vez, porque la temporal la creó un administrador.
 */

import { MarcoPanel } from '@/componentes/marco-panel';
import { exigirSesion } from '@/lib/cookies-panel';
import { debeCambiarContrasena } from '@/servicios/admin';

import { accionCambiarContrasena } from './acciones';

export default async function PaginaCuenta({ searchParams }: PageProps<'/panel/cuenta'>) {
  const sesion = await exigirSesion({ permitirContrasenaTemporal: true });
  const { error } = await searchParams;
  const obligatoria = await debeCambiarContrasena(sesion.usuarioId);

  return (
    <MarcoPanel volver={obligatoria ? undefined : { href: '/panel', texto: 'Volver al panel' }}>
      <h1>{obligatoria ? 'Elige tu contraseña' : 'Cambiar contraseña'}</h1>

      {obligatoria && (
        <p className="aviso">
          Estás entrando con una contraseña temporal. Elige una tuya para empezar a usar el panel.
        </p>
      )}

      {typeof error === 'string' && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form action={accionCambiarContrasena} className="hoja">
        <div className="campo">
          <label htmlFor="actual">{obligatoria ? 'Contraseña temporal' : 'Contraseña actual'}</label>
          <input id="actual" name="actual" type="password" autoComplete="current-password" required />
        </div>
        <div className="campo">
          <label htmlFor="nueva">Nueva contraseña</label>
          <input id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={10} required />
          <small>Al menos 10 caracteres.</small>
        </div>
        <div className="campo">
          <label htmlFor="repetir">Repite la nueva contraseña</label>
          <input id="repetir" name="repetir" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        <button type="submit">Guardar contraseña</button>
      </form>
    </MarcoPanel>
  );
}

export const metadata = { title: 'Mi contraseña · Sello Fiel' };
export const dynamic = 'force-dynamic';
