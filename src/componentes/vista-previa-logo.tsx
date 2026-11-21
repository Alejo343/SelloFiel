'use client';

/**
 * Vista previa del logo en el panel.
 *
 * Al revés que en las pantallas del cliente, aquí el fallo NO se esconde: si el
 * enlace no carga, el dueño tiene que saberlo. Google Wallet exige un logo que
 * funcione para emitir la tarjeta, y un enlace roto hoy es una tarjeta que no
 * se puede crear mañana.
 *
 * Mismo cuidado que en `LogoLocal`: si la imagen falla antes de que cargue el
 * JavaScript, `onError` llega tarde, así que al montar se revisa su estado real.
 */

import { useEffect, useRef } from 'react';

export function VistaPreviaLogo({ url, nombre }: { url: string; nombre: string }) {
  const contenedor = useRef<HTMLDivElement>(null);

  const marcarFallo = () => contenedor.current?.classList.add('vista-logo--fallo');

  useEffect(() => {
    const imagen = contenedor.current?.querySelector('img');
    if (imagen && imagen.complete && imagen.naturalWidth === 0) marcarFallo();
  }, []);

  return (
    <div ref={contenedor} className="vista-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Logo de ${nombre}`} width={72} height={72} onError={marcarFallo} />
      <p className="vista-logo__error error" role="alert">
        No pudimos cargar esta imagen. Revisa que el enlace sea correcto y público: sin un logo
        que funcione, Google no puede crear la tarjeta de tus clientes.
      </p>
    </div>
  );
}
