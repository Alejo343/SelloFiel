'use client';

import { useState } from 'react';

/** Botón para copiar la dirección del chip y pegarla en NFC Tools. */
export function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        } catch {
          // Sin permiso de portapapeles: la dirección sigue a la vista para
          // copiarla a mano.
        }
      }}
    >
      {copiado ? '¡Copiada!' : 'Copiar dirección'}
    </button>
  );
}
