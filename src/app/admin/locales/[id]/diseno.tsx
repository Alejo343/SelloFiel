'use client';

import { useActionState, useState } from 'react';

import { MARCADOR_SELLOS, urlImagenDelEstado } from '@/dominio/wallet';

import { accionGuardarDiseno, type EstadoDiseno } from '../../acciones';

/**
 * El diseño a medida de la tarjeta de Wallet. Lo configura el administrador:
 * es un servicio, no algo que el dueño toque.
 */
export function DisenoTarjeta({
  localId,
  objetivo,
  logoAnchoUrl,
  plantillaImagenUrl,
}: {
  localId: string;
  objetivo: number;
  logoAnchoUrl: string | null;
  plantillaImagenUrl: string | null;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoDiseno, FormData>(accionGuardarDiseno, {});
  const [plantilla, setPlantilla] = useState(estado.valores?.plantillaImagenUrl ?? plantillaImagenUrl ?? '');
  const [logo, setLogo] = useState(estado.valores?.logoAnchoUrl ?? logoAnchoUrl ?? '');
  const [n, setN] = useState(Math.min(7, objetivo));

  const vista = urlImagenDelEstado(plantilla || null, { sellos: n, objetivo });

  return (
    <form action={accion}>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="aviso aviso--exito">{estado.ok}</p>}
      <input type="hidden" name="localId" value={localId} />

      <div className="campo">
        <label htmlFor="logoAnchoUrl">Logo ancho (opcional)</label>
        <input id="logoAnchoUrl" name="logoAnchoUrl" type="url" value={logo} onChange={(e) => setLogo(e.target.value)} />
        <small>PNG transparente de 1280×400. Reemplaza al logo redondo y al nombre en el encabezado.</small>
      </div>

      <div className="campo">
        <label htmlFor="plantillaImagenUrl">Imagen principal</label>
        <input
          id="plantillaImagenUrl"
          name="plantillaImagenUrl"
          type="url"
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          placeholder={`https://sellofiel.app/tarjetas/el-local/v1/sellos-${MARCADOR_SELLOS}.jpg`}
        />
        <small>
          1032×812. Con <code>{MARCADOR_SELLOS}</code> en la dirección, se usa una imagen por cantidad de
          sellos (de 0 a {objetivo}); se comprueba que estén todas antes de guardar. Para cambiar un
          diseño, publícalo en una carpeta nueva (v2): Google guarda las imágenes en caché.
        </small>
      </div>

      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="Vista previa del logo ancho" style={{ width: '100%', background: '#111', borderRadius: 12 }} />
      )}
      {vista && (
        <div className="pila">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={vista} alt={`Vista previa con ${n} sellos`} style={{ width: '100%', borderRadius: 12 }} />
          <label htmlFor="vista-n">Vista previa con {n} sellos</label>
          <input id="vista-n" type="range" min={0} max={objetivo} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </div>
      )}

      <button type="submit" disabled={pendiente}>
        {pendiente ? 'Comprobando imágenes…' : 'Guardar diseño'}
      </button>
    </form>
  );
}
