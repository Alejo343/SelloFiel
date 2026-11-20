'use client';

/**
 * La pantalla que el local deja abierta en la caja.
 *
 * Muestra un QR que se renueva solo. Cada código vale UNA vez y caduca a los
 * pocos segundos, así que una foto no le sirve a nadie: es la idea de David,
 * y es lo mismo que hace el chip NTAG 424 DNA en hardware.
 */

import { useCallback, useEffect, useState } from 'react';

import { SEGUNDOS_DE_REFRESCO } from '@/dominio/fraude';

export function PantallaRotativa({
  tagId,
  urlQr,
  codigoInicial,
}: {
  tagId: string;
  urlQr: string;
  /**
   * El primer código lo emite el servidor al pintar la página. Así el QR
   * aparece de inmediato en vez de tras una ida y vuelta, que delante de un
   * cliente esperando se nota.
   */
  codigoInicial: string;
}) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [error, setError] = useState<string | null>(null);

  const pedirCodigo = useCallback(async () => {
    try {
      const respuesta = await fetch('/api/codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });

      if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`);

      const datos = (await respuesta.json()) as { codigo: string };
      setCodigo(datos.codigo);
      setError(null);
    } catch (problema) {
      // Si falla, se mantiene el código anterior en pantalla: sigue siendo
      // válido unos segundos más y es mejor que dejar al mozo sin nada.
      setError(problema instanceof Error ? problema.message : 'Sin conexión');
    }
  }, [tagId]);

  useEffect(() => {
    const reloj = setInterval(() => void pedirCodigo(), SEGUNDOS_DE_REFRESCO * 1000);
    return () => clearInterval(reloj);
  }, [pedirCodigo]);

  return (
    <div>
      {/* El QR se pide al servidor ya dibujado: así no hace falta una
          librería de QR en el navegador. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${urlQr}?c=${encodeURIComponent(codigo)}`}
        alt="Código para sumar el sello"
        width={280}
        height={280}
      />
      <p>
        <small>
          Se renueva cada {SEGUNDOS_DE_REFRESCO} segundos.
          {error && ' Sin conexión: reintentando.'}
        </small>
      </p>
    </div>
  );
}
