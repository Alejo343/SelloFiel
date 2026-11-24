/**
 * Contraseñas temporales para los dueños que crea un administrador.
 *
 * Fáciles de dictar por teléfono o de copiar en un WhatsApp: sin letras que se
 * confunden (0/O, 1/l/I), agrupadas de a cuatro. 16 caracteres de un alfabeto
 * de 31 dan unos 79 bits: imposible de adivinar, y el dueño la cambia al
 * entrar la primera vez.
 */

import { randomInt } from 'node:crypto';

const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';

export function contrasenaTemporal(): string {
  const caracteres = Array.from({ length: 16 }, () => ALFABETO[randomInt(ALFABETO.length)]);
  return [0, 4, 8, 12].map((i) => caracteres.slice(i, i + 4).join('')).join('-');
}
