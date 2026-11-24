/**
 * Configuración del club: /panel/programa (RF-22, RF-23)
 *
 * Un formulario plano, sin componente de cliente: no necesita estado
 * interactivo, así que una Server Action basta y funciona incluso si el
 * JavaScript no cargó.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarcoPanel } from '@/componentes/marco-panel';
import { VistaPreviaLogo } from '@/componentes/vista-previa-logo';
import { exigirSesion } from '@/lib/cookies-panel';
import { obtenerLocalDelPanel } from '@/servicios/panel';

import { accionGuardarPrograma } from './acciones';

export default async function PaginaPrograma({ searchParams }: PageProps<'/panel/programa'>) {
  const sesion = await exigirSesion();
  const { guardado, error } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  return (
    <MarcoPanel localNombre={local.nombre} volver={{ href: '/panel', texto: 'Volver al panel' }}>

      <h1>Configurar el club</h1>

      {guardado && <p className="aviso aviso--exito">Cambios guardados.</p>}
      {typeof error === 'string' && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form action={accionGuardarPrograma}>
        <section className="hoja">
          <h2>El local</h2>

          <div className="campo">
            <label htmlFor="nombre">Nombre del local</label>
            <input id="nombre" name="nombre" defaultValue={local.nombre} required />
            <small>
              Es el nombre que el cliente ve en el formulario y en la autorización de sus datos.
            </small>
          </div>

          <div className="campo">
            <label htmlFor="logoUrl">Logo del local</label>
            <input
              id="logoUrl"
              name="logoUrl"
              type="url"
              placeholder="https://tu-sitio.com/logo.png"
              defaultValue={local.logoUrl ?? ''}
            />
            <small>
              Es el logo que tus clientes ven en su tarjeta del celular. Imagen cuadrada, de 640 a
              1024 píxeles, en un enlace público que empiece por https. <strong>Importante:</strong>{' '}
              ese enlace no se puede cambiar de sitio después, porque las tarjetas ya emitidas
              quedarían con el logo roto. Si lo dejas vacío, se usa el logo de Sello Fiel.
            </small>
            {local.logoUrl && <VistaPreviaLogo url={local.logoUrl} nombre={local.nombre} />}
          </div>

          <div className="campo">
            <label htmlFor="colorPrimario">Color de la tarjeta</label>
            <input
              id="colorPrimario"
              name="colorPrimario"
              type="color"
              defaultValue={local.colorPrimario}
            />
            <small>El fondo de la tarjeta en el celular de tus clientes.</small>
          </div>

          <div className="campo">
            <label htmlFor="whatsapp">WhatsApp del local</label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              placeholder="300 123 4567"
              defaultValue={local.whatsapp ?? ''}
            />
            <small>Para el botón de pedir o reservar que ve el cliente en su tarjeta.</small>
          </div>

          <p className="ayuda">
            La ubicación y el enlace de reseñas de Google se configuran por sede, en{' '}
            <Link href="/panel/sucursales">Sucursales</Link>.
          </p>
        </section>

        <section className="hoja">
          <h2>El premio</h2>

          <div className="campo">
            <label htmlFor="sellosObjetivo">Sellos para el premio</label>
            <input
              id="sellosObjetivo"
              name="sellosObjetivo"
              type="number"
              min={1}
              max={50}
              defaultValue={local.sellosObjetivo}
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="premio">Qué se gana</label>
            <input id="premio" name="premio" defaultValue={local.premio} required />
            <small>Por ejemplo: una cena para dos, un café con leche, un postre.</small>
          </div>

          <div className="campo">
            <label htmlFor="beneficioBienvenida">Regalo por unirse (opcional)</label>
            <input
              id="beneficioBienvenida"
              name="beneficioBienvenida"
              defaultValue={local.beneficioBienvenida ?? ''}
            />
            <small>
              Sube mucho cuánta gente completa el formulario: da algo a cambio de los datos.
            </small>
          </div>

        </section>

        <section className="hoja">
          <h2>Cuándo escribirle al cliente</h2>

          <div className="campo">
            <label htmlFor="semanasInactividad">Semanas sin venir para considerarlo perdido</label>
            <input
              id="semanasInactividad"
              name="semanasInactividad"
              type="number"
              min={1}
              max={52}
              defaultValue={local.semanasInactividad}
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="diasAntesCumple">Días antes del cumpleaños para saludarlo</label>
            <input
              id="diasAntesCumple"
              name="diasAntesCumple"
              type="number"
              min={0}
              max={60}
              defaultValue={local.diasAntesCumple}
              required
            />
            <small>Mejor unos días antes que el mismo día: le da tiempo de hacer planes.</small>
          </div>

        </section>

        <button type="submit">Guardar cambios</button>
      </form>
    </MarcoPanel>
  );
}

export const metadata = { title: 'Configurar el club · Sello Fiel' };
export const dynamic = 'force-dynamic';
