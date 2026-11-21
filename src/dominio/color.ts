/**
 * Color y contraste.
 *
 * Las pantallas del cliente llevan el color del LOCAL, no el de Sello Fiel: es
 * la promesa de que cada local tiene su tarjeta propia. Pero ese color lo elige
 * el dueño y puede ser cualquiera. Un amarillo pálido con texto blanco encima
 * es ilegible, y un azul oscuro con texto oscuro también.
 *
 * Así que el sistema decide solo si el texto va claro u oscuro, con la fórmula
 * de contraste de las pautas WCAG 2.1. No es decoración: es lo que hace que un
 * botón se pueda leer de pie, con una mano y con poca luz en un salón (RNF-12).
 */

/** Tinta oscura y clara de la marca. Mismos valores que sellofiel.app. */
export const TINTA_OSCURA = '#1F2A44';
export const TINTA_CLARA = '#FFFFFF';

/** Color de respaldo si el del local no es válido. */
export const COLOR_POR_DEFECTO = '#1F2A44';

/**
 * WCAG pide 4,5:1 para texto normal (nivel AA). Es el umbral que usamos para
 * decidir si un color sirve tal cual como fondo de un botón.
 */
export const CONTRASTE_MINIMO_TEXTO = 4.5;

const HEX = /^#?([0-9a-fA-F]{6})$/;

export function esColorValido(color: string | null | undefined): color is string {
  return typeof color === 'string' && HEX.test(color.trim());
}

/** Normaliza a '#rrggbb' en minúsculas. Devuelve el de respaldo si no sirve. */
export function normalizarColor(color: string | null | undefined): string {
  if (!esColorValido(color)) return COLOR_POR_DEFECTO.toLowerCase();
  const limpio = color.trim().replace('#', '').toLowerCase();
  return `#${limpio}`;
}

function aRgb(color: string): [number, number, number] {
  const hex = normalizarColor(color).slice(1);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** Luminancia relativa, tal como la define WCAG 2.1. */
export function luminancia(color: string): number {
  const canal = (valor: number) => {
    const c = valor / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = aRgb(color);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Relación de contraste entre dos colores, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Qué color de texto poner encima de un fondo.
 *
 * Elige entre la tinta oscura y la clara la que más contraste da. No se usa un
 * umbral fijo de luminancia porque falla en los tonos medios: un naranja o un
 * verde intenso pueden necesitar texto oscuro aunque "parezcan" oscuros.
 */
export function tintaSobre(fondo: string): string {
  return contraste(fondo, TINTA_OSCURA) >= contraste(fondo, TINTA_CLARA)
    ? TINTA_OSCURA
    : TINTA_CLARA;
}

/**
 * Oscurece o aclara un color mezclándolo con negro o blanco.
 * `cantidad` va de -1 (negro) a 1 (blanco).
 */
export function ajustar(color: string, cantidad: number): string {
  const [r, g, b] = aRgb(color);
  const destino = cantidad < 0 ? 0 : 255;
  const t = Math.min(1, Math.abs(cantidad));
  const mezclar = (c: number) => Math.round(c + (destino - c) * t);
  return `#${[r, g, b].map((c) => mezclar(c).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Un color de acento que se lea bien sobre el papel crema de las pantallas.
 *
 * Si el color del local es demasiado claro para usarlo como texto sobre el
 * fondo (por ejemplo para el número de sellos), se oscurece hasta que lo sea.
 * Así el local conserva su tono y el cliente puede leerlo.
 */
export function acentoLegibleSobre(color: string, fondo: string): string {
  let acento = normalizarColor(color);
  for (let paso = 0; paso < 12 && contraste(acento, fondo) < CONTRASTE_MINIMO_TEXTO; paso += 1) {
    acento = ajustar(acento, -0.12);
  }
  return acento;
}

/**
 * Los dos fondos sobre los que va texto en las pantallas del cliente. El
 * PEOR caso para un texto oscuro es el fondo más oscuro: si el acento se lee
 * sobre ese, se lee sobre los dos.
 *
 * Antes se calculaba contra el crema, el más claro, y un enlace que pasaba
 * sobre las tarjetas fallaba sobre el fondo de la página (4,26 a 1, cuando el
 * mínimo es 4,5). Lo detectó la auditoría de accesibilidad el 2026-11-21.
 */
export const FONDO_PAPEL = '#f3eee5';
export const FONDO_CREMA = '#fbf5ec';

/** Las variables CSS del tema de un local, listas para el atributo `style`. */
export function temaDelLocal(colorPrimario: string | null | undefined): Record<string, string> {
  const local = normalizarColor(colorPrimario);

  return {
    '--local': local,
    '--sobre-local': tintaSobre(local),
    '--local-acento': acentoLegibleSobre(local, FONDO_PAPEL),
    '--local-suave': ajustar(local, 0.86),
  };
}
