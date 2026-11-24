/**
 * Ficha de una sede: /panel/sucursales/[id]
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoPanel } from '@/componentes/marco-panel';
import { exigirSesion } from '@/lib/cookies-panel';
import { obtenerLocalDelPanel } from '@/servicios/panel';
import { obtenerSucursal } from '@/servicios/sucursales';

import { accionCambiarActiva } from '../acciones';
import { FormularioSucursal } from '../formulario';

export default async function PaginaSucursal({ params, searchParams }: PageProps<'/panel/sucursales/[id]'>) {
  const sesion = await exigirSesion();
  const { id } = await params;
  const { guardado, error } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  // Con el local de la sesión: la sede de otro local da 404.
  const sucursal = await obtenerSucursal(sesion.localId, id);
  if (!sucursal) notFound();

  return (
    <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel/sucursales', texto: 'Volver a sucursales' }}>
      <div className="pila">
        <h1>{sucursal.nombre}</h1>
        {!sucursal.activa && <span className="etiqueta">Cerrada</span>}
      </div>

      {guardado && <p className="aviso aviso--exito">Cambios guardados.</p>}
      {typeof error === 'string' && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <FormularioSucursal sucursal={sucursal} />

      <p className="ayuda">
        Sus chips y su pantalla de caja se registran en <Link href="/panel/chips">Chips y códigos</Link>.
      </p>

      <form action={accionCambiarActiva} className="hoja">
        <input type="hidden" name="sucursalId" value={sucursal.id} />
        {sucursal.activa ? (
          <>
            <p className="ayuda">
              Si la sede cierra, sus chips dejan de sumar sellos y deja de aparecer en el aviso por
              cercanía. Los clientes conservan sus sellos y el historial queda.
            </p>
            <input type="hidden" name="activa" value="no" />
            <button type="submit" className="boton--secundario">
              Cerrar esta sucursal
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="activa" value="si" />
            <button type="submit">Volver a abrirla</button>
          </>
        )}
      </form>
    </MarcoPanel>
  );
}

export const metadata = { title: 'Sucursal · Sello Fiel' };
export const dynamic = 'force-dynamic';
