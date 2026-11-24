import { describe, expect, it } from 'vitest';

import { enSegmento, type ClienteSegmentable } from '../../src/dominio/segmentos';

const CTX = { hoy: '2026-11-24', sellosObjetivo: 10, reglas: { semanasInactividad: 6, diasAntesCumple: 7 } };
const cliente = (p: Partial<ClienteSegmentable> = {}): ClienteSegmentable => ({
  ultimoSello: '2026-11-20',
  fechaNacimiento: null,
  sellosDisponibles: 3,
  dadoDeBaja: false,
  ...p,
});

describe('segmentos de campaña', () => {
  it('quien pidió la baja no entra en NINGÚN segmento, ni en "todos" (RN-08)', () => {
    const deBaja = cliente({ dadoDeBaja: true, sellosDisponibles: 12, fechaNacimiento: '1990-11-10' });
    for (const s of ['todos', 'frecuentes', 'inactivos', 'con_premio', 'cumplen_este_mes'] as const) {
      expect(enSegmento(deBaja, s, CTX), s).toBe(false);
    }
  });

  it('frecuentes: vino en los últimos 30 días', () => {
    expect(enSegmento(cliente({ ultimoSello: '2026-11-01' }), 'frecuentes', CTX)).toBe(true);
    expect(enSegmento(cliente({ ultimoSello: '2026-09-01' }), 'frecuentes', CTX)).toBe(false);
    expect(enSegmento(cliente({ ultimoSello: null }), 'frecuentes', CTX)).toBe(false);
  });

  it('inactivos: usa la regla del local, y quien nunca vino no cuenta', () => {
    expect(enSegmento(cliente({ ultimoSello: '2026-08-01' }), 'inactivos', CTX)).toBe(true);
    expect(enSegmento(cliente({ ultimoSello: '2026-11-20' }), 'inactivos', CTX)).toBe(false);
    expect(enSegmento(cliente({ ultimoSello: null }), 'inactivos', CTX)).toBe(false);
  });

  it('con premio: juntó los sellos del objetivo', () => {
    expect(enSegmento(cliente({ sellosDisponibles: 10 }), 'con_premio', CTX)).toBe(true);
    expect(enSegmento(cliente({ sellosDisponibles: 9 }), 'con_premio', CTX)).toBe(false);
  });

  it('cumplen este mes: el mes de nacimiento es el actual', () => {
    expect(enSegmento(cliente({ fechaNacimiento: '1990-11-30' }), 'cumplen_este_mes', CTX)).toBe(true);
    expect(enSegmento(cliente({ fechaNacimiento: '1990-12-01' }), 'cumplen_este_mes', CTX)).toBe(false);
    expect(enSegmento(cliente({ fechaNacimiento: null }), 'cumplen_este_mes', CTX)).toBe(false);
  });
});

import { esSegmento, validarCampana } from '../../src/dominio/segmentos';
import { marcadoresDesconocidos } from '../../src/dominio/mensajes';

describe('validarCampana', () => {
  const valida = { nombre: 'Día de la milanesa', texto: 'Hola {nombre}, hoy milanesa al 2x1', segmento: 'todos' };
  const v = (d: typeof valida) => validarCampana(d, marcadoresDesconocidos(d.texto));

  it('acepta una campaña bien armada', () => {
    expect(v(valida)).toEqual({ ok: true });
  });

  it('rechaza un marcador mal escrito, que saldría tal cual en cada WhatsApp', () => {
    const r = v({ ...valida, texto: 'Hola {nombe}' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain('{nombe}');
  });

  it('rechaza {enlace}, que solo sirve después de una visita', () => {
    expect(v({ ...valida, texto: 'Mira {enlace}' }).ok).toBe(false);
  });

  it('rechaza nombre o texto vacíos, texto larguísimo y segmentos inventados', () => {
    expect(v({ ...valida, nombre: '  ' }).ok).toBe(false);
    expect(v({ ...valida, texto: '' }).ok).toBe(false);
    expect(v({ ...valida, texto: 'a'.repeat(701) }).ok).toBe(false);
    expect(v({ ...valida, segmento: 'vip' }).ok).toBe(false);
    expect(esSegmento('toString')).toBe(false);
  });
});
