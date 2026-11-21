import { describe, expect, it } from 'vitest';

import { inicialesDe } from '../../src/dominio/marca';

describe('inicialesDe', () => {
  it('toma las dos primeras palabras significativas', () => {
    expect(inicialesDe('Café del Parque')).toBe('CP');
    expect(inicialesDe('Panadería Doña Rosa')).toBe('PD');
  });

  it('no deja una sola letra cuando el artículo es parte del nombre', () => {
    // "La Esquina" sin el artículo daría "E", que se ve pobre.
    expect(inicialesDe('La Esquina')).toBe('LE');
    expect(inicialesDe('El Corral')).toBe('EC');
  });

  it('ignora signos sueltos como un guion largo', () => {
    expect(inicialesDe('Sello Fiel — Pruebas')).toBe('SF');
  });

  it('funciona con un nombre de una sola palabra', () => {
    expect(inicialesDe('Crepes')).toBe('C');
  });

  it('devuelve mayúsculas', () => {
    expect(inicialesDe('la esquina')).toBe('LE');
  });
});
