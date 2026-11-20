import { describe, expect, it } from 'vitest';

import {
  alertasDeSello,
  capacidadDe,
  mensajeCodigoInvalido,
  puedeSumarSellos,
  SEGUNDOS_DE_REFRESCO,
  SEGUNDOS_DE_VIDA_CODIGO,
  SELLOS_EN_RAFAGA,
  validarCodigo,
  validarContador,
} from '../../src/dominio/fraude';

describe('qué puede hacer cada tipo de tag (RN-10)', () => {
  it('un QR impreso NO suma sellos, solo sirve para unirse', () => {
    // La regla más importante de la fase: un QR impreso es una URL fija que
    // el cliente fotografía y usa desde su casa.
    expect(capacidadDe('qr_impreso')).toBe('solo_unirse');
    expect(puedeSumarSellos('qr_impreso')).toBe(false);
  });

  it('el NFC y la pantalla sí suman', () => {
    expect(puedeSumarSellos('nfc')).toBe(true);
    expect(puedeSumarSellos('pantalla')).toBe(true);
  });
});

describe('validarContador del chip (RN-04)', () => {
  it('no exige nada si el tag no manda contador', () => {
    // Un QR o un chip barato no tienen contador: no hay nada que validar.
    expect(validarContador(null, 5)).toBeNull();
    expect(validarContador(undefined, 5)).toBeNull();
  });

  it('acepta el primer contador que ve', () => {
    expect(validarContador(1, null)).toEqual({ valido: true, contador: 1 });
    expect(validarContador(9000, undefined)).toEqual({ valido: true, contador: 9000 });
  });

  it('acepta un contador que avanza', () => {
    expect(validarContador(6, 5)).toEqual({ valido: true, contador: 6 });
    // Puede saltar: alguien pudo leer el chip sin llegar a sumar.
    expect(validarContador(50, 5)).toEqual({ valido: true, contador: 50 });
  });

  it('rechaza un contador repetido: es una lectura reproducida', () => {
    expect(validarContador(5, 5)).toEqual({ valido: false, motivo: 'repetido' });
  });

  it('rechaza un contador que retrocede', () => {
    expect(validarContador(4, 5)).toEqual({ valido: false, motivo: 'retrocede' });
  });

  it('el contador cero es un valor válido, no una ausencia', () => {
    // Si se tratara 0 como "sin contador", el primer toque de un chip nuevo
    // se saltaría la validación para siempre.
    expect(validarContador(0, null)).toEqual({ valido: true, contador: 0 });
    expect(validarContador(0, 0)).toEqual({ valido: false, motivo: 'repetido' });
  });
});

describe('validarCodigo de un solo uso (RN-11)', () => {
  const AHORA = new Date('2026-11-20T15:00:00Z');
  const futuro = new Date('2026-11-20T15:00:30Z');
  const pasado = new Date('2026-11-20T14:59:30Z');

  it('acepta un código fresco y sin usar', () => {
    expect(validarCodigo({ usadoEn: null, expiraEn: futuro }, AHORA)).toEqual({ valido: true });
  });

  it('rechaza uno ya usado: una foto no sirve dos veces', () => {
    expect(
      validarCodigo({ usadoEn: new Date('2026-11-20T14:59:00Z'), expiraEn: futuro }, AHORA),
    ).toEqual({ valido: false, motivo: 'usado' });
  });

  it('rechaza uno vencido aunque nadie lo haya usado', () => {
    // El caso que un solo uso NO cubre: el cliente fotografía el código, nadie
    // más lo usa, y lo usaría esa noche desde su casa. La caducidad lo impide.
    expect(validarCodigo({ usadoEn: null, expiraEn: pasado }, AHORA)).toEqual({
      valido: false,
      motivo: 'expirado',
    });
  });

  it('rechaza uno que vence justo ahora', () => {
    expect(validarCodigo({ usadoEn: null, expiraEn: AHORA }, AHORA)).toEqual({
      valido: false,
      motivo: 'expirado',
    });
  });

  it('rechaza un código inventado', () => {
    expect(validarCodigo(null, AHORA)).toEqual({ valido: false, motivo: 'inexistente' });
  });

  it('la pantalla refresca antes de que el código venza', () => {
    // Si refrescara después, habría un hueco en el que el QR visible ya no
    // sirve y el cliente escanearía algo muerto.
    expect(SEGUNDOS_DE_REFRESCO).toBeLessThan(SEGUNDOS_DE_VIDA_CODIGO);
  });

  it('los mensajes dicen qué hacer, no solo qué falló', () => {
    expect(mensajeCodigoInvalido('expirado')).toMatch(/el que esté en pantalla/i);
    expect(mensajeCodigoInvalido('usado')).toMatch(/otra vez/i);
    expect(mensajeCodigoInvalido('inexistente')).toMatch(/personal/i);
  });
});

describe('alertasDeSello', () => {
  const normal = { sellosRecientes: 2, altasRecientes: 1, horaLocal: 14 };

  it('no alerta en una tarde normal', () => {
    expect(alertasDeSello(normal)).toEqual([]);
  });

  it('alerta por muchos sellos en pocos minutos', () => {
    const alertas = alertasDeSello({ ...normal, sellosRecientes: SELLOS_EN_RAFAGA });
    expect(alertas.map((a) => a.motivo)).toContain('rafaga_de_sellos');
  });

  it('no alerta justo por debajo del umbral', () => {
    expect(alertasDeSello({ ...normal, sellosRecientes: SELLOS_EN_RAFAGA - 1 })).toEqual([]);
  });

  it('alerta por muchas altas de golpe', () => {
    const alertas = alertasDeSello({ ...normal, altasRecientes: SELLOS_EN_RAFAGA });
    expect(alertas.map((a) => a.motivo)).toContain('altas_en_rafaga');
  });

  it('alerta por un sello de madrugada', () => {
    expect(alertasDeSello({ ...normal, horaLocal: 4 }).map((a) => a.motivo)).toContain(
      'horario_improbable',
    );
  });

  it('no alerta de noche temprano ni al amanecer', () => {
    // Un restaurante a las 23:00 o a las 7:00 es perfectamente normal.
    expect(alertasDeSello({ ...normal, horaLocal: 23 })).toEqual([]);
    expect(alertasDeSello({ ...normal, horaLocal: 7 })).toEqual([]);
  });

  it('puede dar varias alertas a la vez', () => {
    const alertas = alertasDeSello({
      sellosRecientes: 20,
      altasRecientes: 20,
      horaLocal: 4,
    });
    expect(alertas).toHaveLength(3);
  });

  it('el detalle explica qué vio, con números', () => {
    const [alerta] = alertasDeSello({ ...normal, sellosRecientes: 12 });
    expect(alerta.detalle).toContain('12');
  });
});
