import { describe, expect, it } from 'vitest';

import {
  acentoLegibleSobre,
  ajustar,
  contraste,
  CONTRASTE_MINIMO_TEXTO,
  esColorValido,
  luminancia,
  normalizarColor,
  FONDO_CREMA,
  FONDO_PAPEL,
  temaDelLocal,
  tintaSobre,
  TINTA_CLARA,
  TINTA_OSCURA,
} from '../../src/dominio/color';

describe('normalizarColor', () => {
  it('lleva cualquier forma válida a #rrggbb en minúsculas', () => {
    expect(normalizarColor('#E4573D')).toBe('#e4573d');
    expect(normalizarColor('E4573D')).toBe('#e4573d');
    expect(normalizarColor('  #e4573d  ')).toBe('#e4573d');
  });

  it('cae al color de respaldo con basura, en vez de romper la página', () => {
    // El color lo escribe el dueño: puede llegar cualquier cosa.
    for (const malo of [null, undefined, '', 'rojo', '#fff', '#12345', '#1234567', 'javascript:']) {
      expect(normalizarColor(malo)).toBe('#1f2a44');
    }
  });

  it('esColorValido distingue lo usable de lo que no', () => {
    expect(esColorValido('#1C7A3E')).toBe(true);
    expect(esColorValido('#fff')).toBe(false);
    expect(esColorValido('url(evil)')).toBe(false);
  });
});

describe('contraste, según WCAG 2.1', () => {
  it('blanco sobre negro da el máximo, 21:1', () => {
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('un color contra sí mismo da el mínimo, 1:1', () => {
    expect(contraste('#e4573d', '#e4573d')).toBeCloseTo(1, 5);
  });

  it('es simétrico', () => {
    expect(contraste('#e4573d', '#1f2a44')).toBeCloseTo(contraste('#1f2a44', '#e4573d'), 10);
  });

  it('la luminancia del blanco es 1 y la del negro 0', () => {
    expect(luminancia('#ffffff')).toBeCloseTo(1, 5);
    expect(luminancia('#000000')).toBeCloseTo(0, 5);
  });
});

describe('tintaSobre: qué color de texto va encima', () => {
  it('pone texto claro sobre un fondo oscuro', () => {
    expect(tintaSobre('#1f2a44')).toBe(TINTA_CLARA);
    expect(tintaSobre('#000000')).toBe(TINTA_CLARA);
  });

  it('pone texto oscuro sobre un fondo claro', () => {
    expect(tintaSobre('#ffffff')).toBe(TINTA_OSCURA);
    expect(tintaSobre('#fbf5ec')).toBe(TINTA_OSCURA);
  });

  it('acierta con un amarillo pálido, el caso que rompería un umbral ingenuo', () => {
    // Texto blanco sobre amarillo es ilegible.
    expect(tintaSobre('#ffe066')).toBe(TINTA_OSCURA);
  });

  it('el texto elegido siempre contrasta más que la alternativa', () => {
    // Barrido de una paleta amplia: ningún color del local puede dejar un
    // botón con el peor de los dos textos posibles.
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const fondo = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
          const elegido = tintaSobre(fondo);
          const otro = elegido === TINTA_OSCURA ? TINTA_CLARA : TINTA_OSCURA;
          expect(contraste(fondo, elegido)).toBeGreaterThanOrEqual(contraste(fondo, otro));
        }
      }
    }
  });
});

describe('acentoLegibleSobre', () => {
  const PAPEL = '#fbf5ec';

  it('deja intacto un color que ya se lee bien', () => {
    expect(acentoLegibleSobre('#1f2a44', PAPEL)).toBe('#1f2a44');
  });

  it('oscurece un color demasiado claro hasta que se lea', () => {
    // Un local con un amarillo pálido de marca: su número de sellos tiene que
    // poder leerse sobre el papel crema.
    const acento = acentoLegibleSobre('#ffe066', PAPEL);
    expect(contraste(acento, PAPEL)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_TEXTO);
  });

  it('cumple el mínimo de contraste para cualquier color de local', () => {
    for (const color of ['#ffffff', '#ffe066', '#a8e6cf', '#e4573d', '#1c7a3e', '#f4a261']) {
      expect(contraste(acentoLegibleSobre(color, PAPEL), PAPEL)).toBeGreaterThanOrEqual(
        CONTRASTE_MINIMO_TEXTO,
      );
    }
  });
});

describe('ajustar', () => {
  it('lleva al negro y al blanco en los extremos', () => {
    expect(ajustar('#e4573d', -1)).toBe('#000000');
    expect(ajustar('#e4573d', 1)).toBe('#ffffff');
  });

  it('no cambia nada con cantidad cero', () => {
    expect(ajustar('#e4573d', 0)).toBe('#e4573d');
  });
});

describe('temaDelLocal', () => {
  it('produce las cuatro variables CSS del tema', () => {
    const tema = temaDelLocal('#8b1e1e');
    expect(Object.keys(tema).sort()).toEqual([
      '--local',
      '--local-acento',
      '--local-suave',
      '--sobre-local',
    ]);
  });

  it('el acento se lee sobre LOS DOS fondos de la pantalla', () => {
    // El error que encontró la auditoría: se calculaba contra el fondo claro y
    // fallaba sobre el oscuro. Ahora se exige en los dos.
    for (const color of ['#ffffff', '#ffe066', '#a8e6cf', '#e4573d', '#8b1e1e', '#f4a261']) {
      const acento = temaDelLocal(color)['--local-acento'];
      expect(contraste(acento, FONDO_PAPEL)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_TEXTO);
      expect(contraste(acento, FONDO_CREMA)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_TEXTO);
    }
  });

  it('no deja pasar un valor peligroso a una variable CSS', () => {
    // El color va dentro de un atributo style: un valor arbitrario podría
    // romper el CSS o inyectar algo. Solo sale un hex limpio.
    const tema = temaDelLocal('red; background: url(evil)');
    expect(tema['--local']).toBe('#1f2a44');
  });
});
