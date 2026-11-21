'use client';

/**
 * El logo del local, con respaldo.
 *
 * El dueño pega la URL de su logo a mano, así que tarde o temprano habrá una
 * que no carga: mal copiada, borrada, o de un sitio caído. Un ícono de imagen
 * rota en la cabecera de su propio club es lo peor que puede ver el cliente.
 *
 * Las iniciales están SIEMPRE debajo, y la imagen las tapa si carga. Si falla,
 * se oculta la imagen y quedan las iniciales a la vista.
 *
 * Por qué no basta con `onError`: si la imagen falla antes de que la página
 * cargue su JavaScript, el evento de error ocurre cuando todavía nadie lo
 * escucha, y el ícono roto se queda. Se vio en las capturas del 2026-11-21. Por
 * eso al montar se revisa además el estado real de la imagen.
 */

import { useEffect, useRef } from 'react';

export function LogoLocal({ url, iniciales }: { url: string | null | undefined; iniciales: string }) {
  const contenedor = useRef<HTMLDivElement>(null);

  // Sin estado de React: se marca el DOM directamente, que es lo que hay que
  // sincronizar con algo externo (el resultado de cargar la imagen).
  const ocultarImagen = () => contenedor.current?.classList.add('logo-local--fallo');

  useEffect(() => {
    const imagen = contenedor.current?.querySelector('img');
    // `complete` con ancho cero significa que ya intentó cargar y falló.
    if (imagen && imagen.complete && imagen.naturalWidth === 0) ocultarImagen();
  }, []);

  return (
    <div ref={contenedor} className="logo-local">
      <div className="marca-local__iniciales" aria-hidden="true">
        {iniciales}
      </div>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="marca-local__logo logo-local__imagen"
          src={url}
          alt=""
          width={52}
          height={52}
          onError={ocultarImagen}
        />
      )}
    </div>
  );
}
