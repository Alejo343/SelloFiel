'use client';

/**
 * Lo que ve el cliente cuando algo falla, en vez de la pantalla genérica de
 * Next en inglés ("This page couldn't load").
 *
 * Dos cosas a la vez:
 *  - Al cliente, un mensaje claro y un botón para reintentar. Casi siempre
 *    basta: el fallo típico es un corte de conexión o una versión vieja de la
 *    página tras un despliegue.
 *  - A nosotros, el error. Ocurre en su navegador y no deja rastro en el
 *    servidor, así que se envía a /api/errores para que quede en el registro.
 */

import { useEffect } from 'react';

export function PantallaError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const e = error instanceof Error ? error : new Error(String(error));
    const cuerpo = JSON.stringify({
      ruta: window.location.pathname,
      mensaje: e.message,
      digest: (e as Error & { digest?: string }).digest,
      pila: e.stack,
      navegador: navigator.userAgent,
    });

    // sendBeacon sobrevive aunque el cliente cierre la pestaña enseguida.
    const enviado = navigator.sendBeacon?.(
      '/api/errores',
      new Blob([cuerpo], { type: 'application/json' }),
    );
    if (!enviado) {
      void fetch('/api/errores', { method: 'POST', body: cuerpo, keepalive: true }).catch(
        () => undefined,
      );
    }
  }, [error]);

  return (
    <main className="pagina">
      <h1>Algo no salió bien</h1>
      <p className="aviso">
        No pudimos cargar esta parte. Suele ser un problema de conexión: prueba otra vez. Si ya
        habías enviado tus datos, no te preocupes, no se pierden ni se duplican.
      </p>
      <button type="button" onClick={() => retry()}>
        Reintentar
      </button>
      <button
        type="button"
        className="boton--secundario"
        onClick={() => window.location.reload()}
      >
        Recargar la página
      </button>
    </main>
  );
}
