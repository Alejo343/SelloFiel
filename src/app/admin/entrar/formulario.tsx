'use client';

import { useActionState } from 'react';

import { accionEntrarAdmin, type EstadoEntrarAdmin } from '../acciones';

export function FormularioEntrarAdmin() {
  const [estado, accion, pendiente] = useActionState<EstadoEntrarAdmin, FormData>(accionEntrarAdmin, {});
  return (
    <form action={accion}>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <div className="campo">
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="campo">
        <label htmlFor="contrasena">Contraseña</label>
        <input id="contrasena" name="contrasena" type="password" autoComplete="current-password" required />
      </div>
      <button type="submit" disabled={pendiente}>{pendiente ? 'Entrando...' : 'Entrar'}</button>
    </form>
  );
}
