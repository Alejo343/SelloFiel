/**
 * Elegir la sede en un formulario del panel.
 *
 * Con una sola sede abierta, que es lo normal, no se muestra nada: va un
 * campo oculto y el dueño ni se entera de que existen las sucursales.
 */

import type { Sucursal } from '@/servicios/sucursales';

export function SelectorSucursal({
  sucursales,
  etiqueta = 'Sucursal',
  id = 'sucursalId',
  valor,
}: {
  sucursales: Sucursal[];
  etiqueta?: string;
  id?: string;
  valor?: string | null;
}) {
  const abiertas = sucursales.filter((s) => s.activa);
  if (abiertas.length === 0) return null;
  if (abiertas.length === 1) return <input type="hidden" name="sucursalId" value={abiertas[0].id} />;

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} name="sucursalId" defaultValue={valor ?? abiertas[0].id}>
        {abiertas.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
