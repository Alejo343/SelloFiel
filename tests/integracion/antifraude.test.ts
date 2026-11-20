/**
 * Las defensas contra sellos falsos, contra la base real.
 *
 * Lo que no se puede probar sin base: que dos personas escaneando el mismo QR
 * a la vez no ganen las dos, y que el contador del chip se guarde de verdad.
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { alertasFraude, codigosSello, tags } from '../../src/db/schema';
import { SELLOS_EN_RAFAGA } from '../../src/dominio/fraude';
import {
  alertasSinRevisar,
  consumirCodigo,
  contarAlertas,
  emitirCodigo,
  limpiarCodigosVencidos,
  marcarAlerta,
  revisarSello,
  validarYAvanzarContador,
} from '../../src/servicios/antifraude';
import { sumarSello } from '../../src/servicios/sellos';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';
import {
  crearClienteDePrueba,
  crearLocalDePrueba,
  instante,
  type LocalDePrueba,
} from '../ayuda/fabricas';

let base: BaseDePruebas;
let local: LocalDePrueba;
let clienteId: string;

beforeAll(async () => {
  base = await abrirBaseDePruebas();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  local = await crearLocalDePrueba(base.db);
  clienteId = await crearClienteDePrueba(base.db, local.localId);
});

const AHORA = instante('2026-11-20');

describe('códigos de un solo uso (RN-11)', () => {
  it('un código recién emitido se puede consumir', async () => {
    const { codigo } = await emitirCodigo(local.tagId, local.localId, base.db, AHORA);

    const resultado = await consumirCodigo(codigo, clienteId, base.db, AHORA);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.tagId).toBe(local.tagId);
  });

  it('el mismo código NO sirve dos veces', async () => {
    // El núcleo de la idea: una foto del QR no vale para volver a sumar.
    const { codigo } = await emitirCodigo(local.tagId, local.localId, base.db, AHORA);

    await consumirCodigo(codigo, clienteId, base.db, AHORA);
    const segundo = await consumirCodigo(codigo, clienteId, base.db, AHORA);

    expect(segundo).toEqual({ ok: false, motivo: 'usado' });
  });

  it('un código vencido no sirve, aunque nadie lo haya usado', async () => {
    // El hueco que el "un solo uso" NO cubre por sí mismo: el cliente
    // fotografía el código, nadie más lo usa, y lo usaría esa noche.
    const { codigo } = await emitirCodigo(local.tagId, local.localId, base.db, AHORA);

    const masTarde = new Date(AHORA.getTime() + 10 * 60_000);
    expect(await consumirCodigo(codigo, clienteId, base.db, masTarde)).toEqual({
      ok: false,
      motivo: 'expirado',
    });
  });

  it('un código inventado no sirve', async () => {
    expect(await consumirCodigo('me-lo-invente', clienteId, base.db, AHORA)).toEqual({
      ok: false,
      motivo: 'inexistente',
    });
  });

  it('dos personas escaneando el mismo QR a la vez: solo una suma', async () => {
    // Pasa de verdad: dos clientes apuntan a la misma pantalla al tiempo.
    const { codigo } = await emitirCodigo(local.tagId, local.localId, base.db, AHORA);
    const otro = await crearClienteDePrueba(base.db, local.localId);

    const resultados = await Promise.all([
      consumirCodigo(codigo, clienteId, base.db, AHORA),
      consumirCodigo(codigo, otro, base.db, AHORA),
      consumirCodigo(codigo, clienteId, base.db, AHORA),
    ]);

    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(resultados.filter((r) => !r.ok)).toHaveLength(2);
  });

  it('emitir uno nuevo no invalida el que está en pantalla', async () => {
    // Si lo invalidara, el cliente que está escaneando en ese instante vería
    // fallar un QR que tiene delante de los ojos.
    const primero = await emitirCodigo(local.tagId, local.localId, base.db, AHORA);
    await emitirCodigo(local.tagId, local.localId, base.db, AHORA);

    expect((await consumirCodigo(primero.codigo, clienteId, base.db, AHORA)).ok).toBe(true);
  });

  it('los códigos no son adivinables', async () => {
    const emitidos = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const { codigo } = await emitirCodigo(local.tagId, local.localId, base.db, AHORA);
      emitidos.add(codigo);
      expect(codigo.length).toBeGreaterThanOrEqual(20);
    }
    expect(emitidos.size).toBe(30);
  });

  it('la limpieza borra los vencidos de hace días, no los de ahora', async () => {
    await emitirCodigo(local.tagId, local.localId, base.db, AHORA);
    const viejo = new Date(AHORA.getTime() - 5 * 86_400_000);
    await emitirCodigo(local.tagId, local.localId, base.db, viejo);

    const borrados = await limpiarCodigosVencidos(base.db, AHORA);

    expect(borrados).toBe(1);
    expect(await base.db.select().from(codigosSello)).toHaveLength(1);
  });
});

describe('contador del chip (RN-04)', () => {
  it('acepta y guarda el primer contador', async () => {
    const r = await validarYAvanzarContador(
      { tagId: local.tagId, localId: local.localId, clienteId, contadorRecibido: 7 },
      base.db,
    );

    expect(r.ok).toBe(true);
    const [tag] = await base.db.select().from(tags).where(eq(tags.id, local.tagId));
    expect(tag.ultimoContador).toBe(7);
  });

  it('acepta uno que avanza y lo guarda', async () => {
    await validarYAvanzarContador(
      { tagId: local.tagId, localId: local.localId, clienteId, contadorRecibido: 7 },
      base.db,
    );
    const r = await validarYAvanzarContador(
      { tagId: local.tagId, localId: local.localId, clienteId, contadorRecibido: 8 },
      base.db,
    );

    expect(r.ok).toBe(true);
    const [tag] = await base.db.select().from(tags).where(eq(tags.id, local.tagId));
    expect(tag.ultimoContador).toBe(8);
  });

  it('rechaza uno repetido y deja una alerta', async () => {
    // Es la señal más clara de copia: alguien reprodujo una lectura antigua.
    await validarYAvanzarContador(
      { tagId: local.tagId, localId: local.localId, clienteId, contadorRecibido: 7 },
      base.db,
    );
    const r = await validarYAvanzarContador(
      { tagId: local.tagId, localId: local.localId, clienteId, contadorRecibido: 7 },
      base.db,
    );

    expect(r).toEqual({ ok: false, motivo: 'contador_repetido' });

    const [alerta] = await base.db.select().from(alertasFraude);
    expect(alerta.motivo).toBe('contador_repetido');
    expect(alerta.detalle).toContain('7');
  });

  it('no exige nada a un tag que no manda contador', async () => {
    const r = await validarYAvanzarContador(
      { tagId: local.tagId, localId: local.localId, clienteId, contadorRecibido: null },
      base.db,
    );

    expect(r.ok).toBe(true);
    expect(await base.db.select().from(alertasFraude)).toHaveLength(0);
  });

  it('no deja avanzar el contador de un tag de otro local', async () => {
    const otro = await crearLocalDePrueba(base.db);

    await validarYAvanzarContador(
      { tagId: otro.tagId, localId: local.localId, clienteId, contadorRecibido: 99 },
      base.db,
    );

    const [tag] = await base.db.select().from(tags).where(eq(tags.id, otro.tagId));
    expect(tag.ultimoContador).toBeNull();
  });
});

describe('alertas de sellos sospechosos', () => {
  async function sellosSeguidos(cuantos: number) {
    for (let i = 0; i < cuantos; i += 1) {
      const suCliente = await crearClienteDePrueba(base.db, local.localId);
      await sumarSello(
        {
          localId: local.localId,
          clienteId: suCliente,
          sellosObjetivo: local.sellosObjetivo,
          zonaHoraria: local.zonaHoraria,
          origen: 'nfc',
          tagId: local.tagId,
          ahora: AHORA,
        },
        base.db,
      );
    }
  }

  it('no alerta en una tarde normal', async () => {
    await sellosSeguidos(2);

    const n = await revisarSello(
      { localId: local.localId, clienteId, horaLocal: 14, ahora: new Date() },
      base.db,
    );

    expect(n).toBe(0);
  });

  it('alerta cuando hay una ráfaga de sellos', async () => {
    await sellosSeguidos(SELLOS_EN_RAFAGA);

    const n = await revisarSello(
      { localId: local.localId, clienteId, horaLocal: 14, ahora: new Date() },
      base.db,
    );

    expect(n).toBeGreaterThanOrEqual(1);
    const alertas = await alertasSinRevisar(local.localId, base.db);
    expect(alertas.map((a) => a.motivo)).toContain('rafaga_de_sellos');
  });

  it('alerta por un sello de madrugada', async () => {
    const n = await revisarSello(
      { localId: local.localId, clienteId, horaLocal: 4, ahora: new Date() },
      base.db,
    );

    expect(n).toBe(1);
    expect((await alertasSinRevisar(local.localId, base.db))[0].motivo).toBe(
      'horario_improbable',
    );
  });

  it('las alertas no bloquean el sello (RN-09)', async () => {
    // Un falso positivo que impida sumar delante del cliente hace más daño
    // que el fraude que evitaría.
    await sellosSeguidos(SELLOS_EN_RAFAGA);

    const r = await sumarSello(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        zonaHoraria: local.zonaHoraria,
        origen: 'nfc',
        tagId: local.tagId,
        ahora: AHORA,
      },
      base.db,
    );

    expect(r.resultado).toBe('sumado');
  });

  it('el local solo ve sus propias alertas (RNF-05)', async () => {
    const otro = await crearLocalDePrueba(base.db);
    const suCliente = await crearClienteDePrueba(base.db, otro.localId);

    await revisarSello(
      { localId: otro.localId, clienteId: suCliente, horaLocal: 4, ahora: new Date() },
      base.db,
    );

    expect(await contarAlertas(local.localId, base.db)).toBe(0);
    expect(await contarAlertas(otro.localId, base.db)).toBe(1);
  });

  it('marcar una alerta la saca de la lista', async () => {
    await revisarSello(
      { localId: local.localId, clienteId, horaLocal: 4, ahora: new Date() },
      base.db,
    );

    const [alerta] = await alertasSinRevisar(local.localId, base.db);
    expect(await marcarAlerta(local.localId, alerta.id, 'revisada', base.db)).toBe(true);

    expect(await contarAlertas(local.localId, base.db)).toBe(0);
  });

  it('no deja marcar la alerta de otro local', async () => {
    const otro = await crearLocalDePrueba(base.db);
    const suCliente = await crearClienteDePrueba(base.db, otro.localId);
    await revisarSello(
      { localId: otro.localId, clienteId: suCliente, horaLocal: 4, ahora: new Date() },
      base.db,
    );

    const [ajena] = await alertasSinRevisar(otro.localId, base.db);
    expect(await marcarAlerta(local.localId, ajena.id, 'revisada', base.db)).toBe(false);
    expect(await contarAlertas(otro.localId, base.db)).toBe(1);
  });
});
