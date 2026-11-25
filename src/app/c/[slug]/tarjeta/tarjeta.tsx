/**
 * La tarjeta de sellos del cliente (RF-06).
 *
 * Misma forma que la que muestra sellofiel.app, con el color del local. Los
 * sellos se dibujan, pero el número siempre va también escrito: el dibujo es
 * para los ojos, el texto es lo que lee un lector de pantalla y lo que no
 * depende de distinguir colores.
 *
 * Compartida entre el tap, el código de pantalla y la tarjeta, para que lo que
 * el cliente ve al sumar y lo que ve al volver a entrar sea exactamente igual.
 */

import Link from 'next/link';

import { Sello } from '@/componentes/sello';
import type { EstadoClub } from '@/dominio/sellos';

export interface PropsTarjeta {
  estado: EstadoClub;
  premio: string;
  localSlug: string;
  localNombre: string;
  /** En formato internacional sin signos, para armar el enlace de WhatsApp */
  whatsappLocal?: string | null;
  /** Enlace para añadir la tarjeta al wallet, si ya se generó */
  enlaceWallet?: string | null;
  /** Con diseño a medida, la misma imagen que ve en Wallet */
  imagenDiseno?: string | null;
}

export function Tarjeta({
  estado,
  premio,
  localSlug,
  localNombre,
  whatsappLocal,
  enlaceWallet,
  imagenDiseno,
}: PropsTarjeta) {
  const llenos = Math.min(estado.sellos, estado.objetivo);
  const casillas = Array.from({ length: estado.objetivo }, (_, i) => i < llenos);

  return (
    <div className="pila">
      <section
        className={`tarjeta-sellos${estado.premioDisponible ? ' tarjeta-sellos--premio' : ''}`}
        aria-label="Tu tarjeta de sellos"
      >
        <div className="tarjeta-sellos__cabecera">
          <h2>Tus sellos</h2>
          <p className="tarjeta-sellos__cuenta">
            {estado.sellos} de {estado.objetivo} sellos
            {estado.sellos > estado.objetivo && ` (${estado.sellos - estado.objetivo} a favor)`}
          </p>
        </div>

        {imagenDiseno ? (
          // La misma imagen que en Wallet, para que las dos tarjetas se vean igual.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagenDiseno} alt="" className="tarjeta-sellos__imagen" width={1032} height={812} />
        ) : (
          <div className="sellos" aria-hidden="true">
            {casillas.map((lleno, i) => (
              <div key={i} className={lleno ? 'sello sello--lleno' : 'sello'}>
                {lleno && <Sello />}
              </div>
            ))}
          </div>
        )}

        <div className="tarjeta-sellos__premio">
          {estado.premioDisponible ? (
            <p>
              <strong>¡Tienes tu premio listo!</strong> Pídelo en el local: {premio}
            </p>
          ) : (
            <p>
              Te {estado.faltan === 1 ? 'falta' : 'faltan'} <strong>{estado.faltan}</strong>{' '}
              {estado.faltan === 1 ? 'sello' : 'sellos'} para: <strong>{premio}</strong>
            </p>
          )}
        </div>
      </section>

      {enlaceWallet && (
        <div className="pila">
          {/* Guardarla en el wallet es OPCIONAL: sin hacerlo, el cliente sigue
              en el club y suma sellos igual. */}
          <a className="boton boton--local" href={enlaceWallet}>
            Guardar mi tarjeta en Google Wallet
          </a>
          <p className="ayuda centrado">
            Así la tienes junto a tus tarjetas del celular, y te aparece cuando pasas cerca del
            local. Es opcional.
          </p>
        </div>
      )}

      {whatsappLocal && (
        <a
          className="boton boton--secundario"
          href={`https://wa.me/${whatsappLocal}?text=${encodeURIComponent(
            `Hola ${localNombre}, quiero hacer un pedido.`,
          )}`}
        >
          Pedir o reservar por WhatsApp
        </a>
      )}

      <p className="centrado texto-chico">
        <Link href={`/c/${localSlug}/politica`}>Cómo tratamos tus datos</Link>
      </p>
    </div>
  );
}
