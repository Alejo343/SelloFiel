'use client';

import { useActionState } from 'react';

import { BotonCopiar } from '@/app/panel/chips/copiar';

import { accionRestablecerClave, type EstadoRestablecer } from '../../acciones';

/** La nueva contraseña se muestra una vez y nunca pasa por la URL. */
export function RestablecerClave({ localId }: { localId: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoRestablecer, FormData>(accionRestablecerClave, {});

  if (estado.clave) {
    return (
      <div className="pila">
        <p className="aviso aviso--exito">
          Nueva contraseña temporal para {estado.email}. Se muestra solo esta vez.
        </p>
        <p className="fila__cita"><code>{estado.clave}</code></p>
        <BotonCopiar texto={estado.clave} />
      </div>
    );
  }

  return (
    <form action={accion}>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <input type="hidden" name="localId" value={localId} />
      <p className="ayuda">Si el dueño olvidó su contraseña. La anterior deja de funcionar.</p>
      <button type="submit" className="boton--secundario" disabled={pendiente}>
        Generar contraseña nueva
      </button>
    </form>
  );
}
