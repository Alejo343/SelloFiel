/**
 * Exportar a CSV de forma segura.
 *
 * El riesgo que no es obvio: los nombres los escribe el CLIENTE en el
 * formulario público. Si alguien pone como nombre `=HYPERLINK("http://...")`
 * o `=cmd|...`, Excel lo ejecuta como fórmula cuando el dueño abre el archivo.
 * Se llama inyección de CSV, y es un ataque real contra quien descarga datos
 * que escribieron otros.
 *
 * La defensa estándar (OWASP): anteponer un apóstrofo a toda celda que empiece
 * con = + - @, tabulador o retorno de carro. Excel lo muestra como texto.
 */

const INICIO_PELIGROSO = /^[=+\-@\t\r]/;

export function celdaSegura(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  let texto = String(valor);

  if (INICIO_PELIGROSO.test(texto)) texto = `'${texto}`;

  // Comillas, comas, punto y coma o saltos de línea obligan a entrecomillar.
  if (/[",;\r\n]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;

  return texto;
}

/**
 * Arma el CSV completo.
 *
 * Separado por punto y coma, no por coma: es lo que espera Excel en español,
 * donde la coma es el separador decimal. Con comas, todo quedaría en una sola
 * columna al abrirlo en Colombia.
 *
 * Empieza con la marca BOM de UTF-8 para que Excel no destroce las tildes.
 */
export function aCsv(encabezados: string[], filas: unknown[][]): string {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celdaSegura).join(';'));
  return `﻿${lineas.join('\r\n')}\r\n`;
}
