import { describe, expect, it } from 'vitest';

import { contrasenaTemporal } from '../../src/lib/contrasena-temporal';
import { slugDesde, validarSlug } from '../../src/dominio/slug';

describe('slugDesde', () => {
  it('convierte el nombre en una dirección legible', () => {
    expect(slugDesde('Café del Parque')).toBe('cafe-del-parque');
    expect(slugDesde('El Barril')).toBe('el-barril');
  });

  it('quita tildes y eñes, que rompen al imprimir y al dictar', () => {
    expect(slugDesde('Panadería Doña Rosa')).toBe('panaderia-dona-rosa');
  });

  it('limpia signos, espacios de más y guiones en los bordes', () => {
    expect(slugDesde('  ¡Pollos   & Papas!  ')).toBe('pollos-y-papas');
    expect(slugDesde('Sello Fiel — Pruebas')).toBe('sello-fiel-pruebas');
  });

  it('recorta los nombres larguísimos sin dejar un guion al final', () => {
    const slug = slugDesde('Restaurante de comida típica tradicional de la región andina');
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('siempre produce un slug válido para un nombre normal', () => {
    for (const nombre of ['La Esquina', 'Café 22', 'Mr. Pollo', 'Ñapa Bar', 'Arepas & Co']) {
      expect(validarSlug(slugDesde(nombre))).toEqual({ valido: true });
    }
  });
});

describe('validarSlug', () => {
  it('rechaza lo que no sirve como dirección', () => {
    expect(validarSlug('ab').valido).toBe(false);
    expect(validarSlug('Con-Mayus').valido).toBe(false);
    expect(validarSlug('con espacio').valido).toBe(false);
    expect(validarSlug('doble--guion').valido).toBe(false);
    expect(validarSlug('-borde').valido).toBe(false);
  });

  it('rechaza las rutas del sistema', () => {
    // Un local llamado "admin" o "panel" chocaría con las pantallas propias.
    for (const r of ['admin', 'panel', 'api']) expect(validarSlug(r).valido).toBe(false);
  });
});

describe('contrasenaTemporal', () => {
  it('tiene el formato fácil de dictar: cuatro grupos de cuatro', () => {
    expect(contrasenaTemporal()).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  });

  it('no usa caracteres que se confunden al leerlos', () => {
    for (let i = 0; i < 50; i += 1) expect(contrasenaTemporal()).not.toMatch(/[0o1liI]/);
  });

  it('no se repite', () => {
    const vistas = new Set(Array.from({ length: 200 }, contrasenaTemporal));
    expect(vistas.size).toBe(200);
  });
});
