/**
 * El marco de todas las pantallas que ve el CLIENTE.
 *
 * Lleva la marca del local, no la de Sello Fiel: su logo, su nombre y su
 * color. Sello Fiel solo firma al pie, en chico. Es la promesa de producto de
 * que cada local tiene su tarjeta propia.
 *
 * El color lo elige el dueño y puede ser cualquiera, así que se pasa por
 * `temaDelLocal`, que calcula el color de texto legible encima y oscurece el
 * acento si hace falta. Un amarillo pálido no deja un botón ilegible.
 */

import type { CSSProperties, ReactNode } from 'react';

import { temaDelLocal } from '@/dominio/color';
import { inicialesDe } from '@/dominio/marca';

import { LogoLocal } from './logo-local';

export interface DatosMarca {
  localNombre: string;
  logoUrl?: string | null;
  colorPrimario?: string | null;
}


export function MarcoLocal({
  local,
  titulo,
  subtitulo = 'Club de clientes',
  children,
}: {
  local: DatosMarca;
  /**
   * El encabezado principal de la pantalla. Si no se pasa, el encabezado es
   * el nombre del local. Nunca hay dos: así el lector de pantalla oye un solo
   * título y el nombre no aparece duplicado.
   */
  titulo?: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  const estilo = temaDelLocal(local.colorPrimario) as CSSProperties;

  const logo = <LogoLocal url={local.logoUrl} iniciales={inicialesDe(local.localNombre)} />;

  return (
    <div className="tema-local" style={estilo}>
      <main className="pagina">
        <header className="marca-local">
          {logo}
          <div className="marca-local__textos">
            {titulo ? (
              <>
                <p className="marca-local__nombre">{local.localNombre}</p>
                <p className="marca-local__sub">{subtitulo}</p>
              </>
            ) : (
              <>
                <h1 className="marca-local__nombre">{local.localNombre}</h1>
                <p className="marca-local__sub">{subtitulo}</p>
              </>
            )}
          </div>
        </header>

        {titulo && <h1>{titulo}</h1>}

        {children}

        <footer className="pie-sello-fiel">
          Tarjeta digital por{' '}
          <a href="https://sellofiel.app" target="_blank" rel="noreferrer">
            Sello Fiel
          </a>
        </footer>
      </main>
    </div>
  );
}
