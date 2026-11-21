/**
 * Reglas de presentación de la marca de un local.
 */

/**
 * Iniciales para cuando el local no tiene logo, o el suyo no carga.
 *
 * Se descartan los artículos ("Café del Parque" -> "CP"), pero solo si quedan
 * al menos dos palabras: "La Esquina" daría una sola "E", que se ve pobre, y
 * es mejor "LE".
 */
export function inicialesDe(nombre: string): string {
  const todas = nombre.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));
  const significativas = todas.filter((p) => !/^(de|del|la|el|los|las|y)$/i.test(p));
  const fuente = significativas.length >= 2 ? significativas : todas;
  return fuente
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
