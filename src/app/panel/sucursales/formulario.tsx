'use client';

import { useActionState } from 'react';

import type { Sucursal } from '@/servicios/sucursales';

import { accionGuardarSucursal, type EstadoSucursal } from './acciones';

/**
 * Alta y edición de una sede.
 *
 * React vacía el formulario después de cada acción, así que si hubo un error
 * se vuelve a pintar con lo que se había escrito: la acción lo devuelve y la
 * `key` fuerza a rehacer los campos con esos valores. Tras guardar bien, la
 * `key` cambia con los datos nuevos: si no, quedaban los campos de antes.
 */
export function FormularioSucursal({ sucursal }: { sucursal?: Sucursal }) {
  const [estado, accion, pendiente] = useActionState<EstadoSucursal, FormData>(accionGuardarSucursal, {});
  const v = (campo: keyof Sucursal) =>
    estado.valores?.[campo] ?? ((sucursal?.[campo] as string | null | undefined) ?? '');

  return (
    <form action={accion} className="hoja" key={JSON.stringify(estado.valores ?? sucursal ?? {})}>
      {!sucursal && <h2>Agregar una sucursal</h2>}
      {estado.error && <p className="error">{estado.error}</p>}
      {sucursal && <input type="hidden" name="sucursalId" value={sucursal.id} />}

      <div className="campo">
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" required maxLength={60} placeholder="Norte" defaultValue={v('nombre')} />
        <small>Corto: así aparece en tu panel. Por ejemplo «Centro» o «Unicentro».</small>
      </div>

      <div className="campo">
        <label htmlFor="direccion">Dirección (opcional)</label>
        <input id="direccion" name="direccion" placeholder="Calle 10 # 5-20" defaultValue={v('direccion')} />
      </div>

      <div className="campo">
        <label htmlFor="googleMapsUrl">Enlace para dejar reseñas en Google Maps</label>
        <input id="googleMapsUrl" name="googleMapsUrl" type="url" defaultValue={v('googleMapsUrl')} />
        <small>
          El de ESTA sede. Cuando un cliente diga que su visita estuvo bien, se le invita a dejar la
          reseña en la sede donde estuvo.
        </small>
      </div>

      <div className="campo">
        <label htmlFor="lat">Latitud</label>
        <input id="lat" name="lat" inputMode="decimal" placeholder="4.6533" defaultValue={v('lat')} />
      </div>
      <div className="campo">
        <label htmlFor="lng">Longitud</label>
        <input id="lng" name="lng" inputMode="decimal" placeholder="-74.0836" defaultValue={v('lng')} />
        <small>
          Con la ubicación, la tarjeta aparece en el celular del cliente cuando pasa cerca. En Google
          Maps, mantén presionado el punto y copia los dos números.
        </small>
      </div>

      <button type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : sucursal ? 'Guardar cambios' : 'Agregar sucursal'}
      </button>
    </form>
  );
}
