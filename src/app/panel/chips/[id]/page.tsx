/**
 * Ficha de un chip: /panel/chips/[id]
 *
 * Aquí el dueño copia la dirección para grabarla, con las instrucciones paso a
 * paso, y da de baja el chip si se pierde.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoPanel } from '@/componentes/marco-panel';
import { exigirSesion } from '@/lib/cookies-panel';
import { direccionDelChip, obtenerChip } from '@/servicios/chips';
import { obtenerLocalDelPanel } from '@/servicios/panel';

import { accionCambiarEstado, accionRenombrar } from '../acciones';
import { BotonCopiar } from '../copiar';
import { NOMBRE_TIPO } from '../tipos';

export default async function PaginaChip({
  params,
  searchParams,
}: PageProps<'/panel/chips/[id]'>) {
  const sesion = await exigirSesion();
  const { id } = await params;
  const { nuevo } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  // Exigiendo el local de la sesión: el id de un chip ajeno da 404.
  const chip = await obtenerChip(sesion.localId, id);
  if (!chip) notFound();

  const direccion = direccionDelChip(chip.token);

  return (
    <MarcoPanel
      localNombre={local.nombre}
      volver={{ href: '/panel/chips', texto: 'Volver a chips y códigos' }}
    >
      <div className="pila">
        <h1>{chip.objeto ?? 'Sin nombre'}</h1>
        <span className="etiqueta">{NOMBRE_TIPO[chip.tipo]}</span>
        {!chip.activo && <span className="etiqueta etiqueta--coral">Dado de baja</span>}
      </div>

      {nuevo && <p className="aviso aviso--exito">Registrado. Ahora toca grabarlo.</p>}

      {chip.tipo === 'pantalla' ? (
        <section className="hoja">
          <h2>Cómo se usa</h2>
          <p>
            No se graba nada: abre <Link href="/panel/pantalla">la pantalla de la caja</Link> en
            un celular o tablet y déjala a la vista. El código cambia solo.
          </p>
        </section>
      ) : (
        <section className="hoja">
          <h2>{chip.tipo === 'nfc' ? 'Grabarlo en el chip' : 'Imprimirlo'}</h2>
          <p className="ayuda">Esta es su dirección:</p>
          <p className="fila__cita" style={{ wordBreak: 'break-all' }}>
            <code>{direccion}</code>
          </p>
          <BotonCopiar texto={direccion} />

          {chip.tipo === 'nfc' ? (
            <ol className="pila" style={{ paddingLeft: '1.2rem', margin: 0 }}>
              <li>
                Instala <strong>NFC Tools</strong> (gratis, Android y iPhone).
              </li>
              <li>
                Entra a <strong>Escribir</strong> → <strong>Añadir un registro</strong> →{' '}
                <strong>URL / URI</strong> y pega la dirección.
              </li>
              <li>
                Toca <strong>Escribir</strong> y acerca el chip a la parte de atrás del celular.
              </li>
              <li>
                Pruébalo apoyándolo en un Android y en un iPhone. En iPhone aparece una
                notificación que hay que tocar: es normal.
              </li>
              <li>
                <strong>Bloquéalo</strong> en NFC Tools (Otros → Bloquear etiqueta). Sin bloquear,
                cualquiera con el celular podría reescribirlo y mandar a tus clientes a otra
                página. Es irreversible: hazlo solo cuando ya funcione.
              </li>
            </ol>
          ) : (
            <p className="ayuda">
              Este código sirve para que el cliente se una al club, no para sumar sellos. Lo
              encuentras listo para imprimir en <Link href="/panel/qr">Códigos QR</Link>.
            </p>
          )}
        </section>
      )}

      <section className="hoja">
        <h2>Uso</h2>
        <p>
          {chip.ultimoUso
            ? `Último sello sumado: ${chip.ultimoUso.toISOString().slice(0, 16).replace('T', ' ')}`
            : 'Todavía no ha sumado ningún sello.'}
        </p>
        {chip.ultimoContador !== null && (
          <p className="ayuda">Contador de lecturas del chip: {chip.ultimoContador}</p>
        )}
      </section>

      <form action={accionRenombrar} className="hoja">
        <div className="campo">
          <label htmlFor="objeto">Nombre</label>
          <input id="objeto" name="objeto" defaultValue={chip.objeto ?? ''} required />
        </div>
        <input type="hidden" name="chipId" value={chip.id} />
        <button type="submit" className="boton--secundario">
          Cambiar nombre
        </button>
      </form>

      <form action={accionCambiarEstado} className="hoja">
        <input type="hidden" name="chipId" value={chip.id} />
        {chip.activo ? (
          <>
            <p className="ayuda">
              Si el chip se perdió o te lo robaron, dalo de baja: deja de sumar sellos al
              instante.
            </p>
            <input type="hidden" name="activo" value="no" />
            <button type="submit" className="boton--secundario">
              Dar de baja
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="activo" value="si" />
            <button type="submit">Volver a activarlo</button>
          </>
        )}
      </form>
    </MarcoPanel>
  );
}

export const dynamic = 'force-dynamic';
