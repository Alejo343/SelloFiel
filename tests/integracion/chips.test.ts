import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  cambiarEstadoChip,
  crearChip,
  direccionDelChip,
  generarToken,
  listarChips,
  obtenerChip,
  renombrarChip,
} from '../../src/servicios/chips';
import { sumarSello } from '../../src/servicios/sellos';
import { resolverTag } from '../../src/servicios/tags';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';
import {
  crearClienteDePrueba,
  crearLocalDePrueba,
  instante,
  type LocalDePrueba,
} from '../ayuda/fabricas';

let base: BaseDePruebas;
let local: LocalDePrueba;

beforeAll(async () => {
  base = await abrirBaseDePruebas();
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
  local = await crearLocalDePrueba(base.db);
});

describe('generarToken', () => {
  it('no se adivina: largo, aleatorio y apto para una URL', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const t = generarToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{16}$/);
      vistos.add(t);
    }
    expect(vistos.size).toBe(200);
  });

  it('la dirección completa cabe en un NTAG213, el chip más chico', () => {
    // El NTAG213 tiene 137 bytes útiles para el mensaje NDEF.
    expect(direccionDelChip(generarToken()).length).toBeLessThan(100);
  });
});

describe('crearChip', () => {
  it('registra el chip con su nombre y tipo', async () => {
    const { id } = await crearChip(
      { localId: local.localId, objeto: '  Media luna de la caja  ', tipo: 'nfc' },
      base.db,
    );

    const chip = await obtenerChip(local.localId, id, base.db);
    expect(chip?.objeto).toBe('Media luna de la caja');
    expect(chip?.tipo).toBe('nfc');
    expect(chip?.activo).toBe(true);
  });

  it('un chip recién registrado ya suma sellos', async () => {
    const { token } = await crearChip(
      { localId: local.localId, objeto: 'Corona', tipo: 'nfc' },
      base.db,
    );

    const resuelto = await resolverTag(token, base.db);
    expect(resuelto?.localId).toBe(local.localId);
    expect(resuelto?.tagTipo).toBe('nfc');
  });
});

describe('dar de baja un chip perdido', () => {
  it('deja de sumar sellos al instante', async () => {
    const { id } = await crearChip(
      { localId: local.localId, objeto: 'Chip perdido', tipo: 'nfc' },
      base.db,
    );
    const clienteId = await crearClienteDePrueba(base.db, local.localId);

    await cambiarEstadoChip(local.localId, id, false, base.db);

    const r = await sumarSello(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        zonaHoraria: local.zonaHoraria,
        origen: 'nfc',
        tagId: id,
        ahora: instante('2026-11-24'),
      },
      base.db,
    );

    expect(r).toMatchObject({ resultado: 'rechazado', motivo: 'tag_inactivo' });
  });

  it('se puede volver a activar', async () => {
    const { id } = await crearChip({ localId: local.localId, objeto: 'X', tipo: 'nfc' }, base.db);
    await cambiarEstadoChip(local.localId, id, false, base.db);
    await cambiarEstadoChip(local.localId, id, true, base.db);
    expect((await obtenerChip(local.localId, id, base.db))?.activo).toBe(true);
  });
});

describe('último uso', () => {
  it('nunca usado hasta que suma un sello', async () => {
    const { id } = await crearChip({ localId: local.localId, objeto: 'X', tipo: 'nfc' }, base.db);
    expect((await obtenerChip(local.localId, id, base.db))?.ultimoUso).toBeNull();

    const clienteId = await crearClienteDePrueba(base.db, local.localId);
    await sumarSello(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        zonaHoraria: local.zonaHoraria,
        origen: 'nfc',
        tagId: id,
        ahora: instante('2026-11-24'),
      },
      base.db,
    );

    expect((await obtenerChip(local.localId, id, base.db))?.ultimoUso).toBeInstanceOf(Date);
  });
});

describe('aislamiento entre locales (RNF-05)', () => {
  it('no se ven, ni se dan de baja, ni se renombran los chips de otro local', async () => {
    const otro = await crearLocalDePrueba(base.db);
    const { id } = await crearChip(
      { localId: otro.localId, objeto: 'Ajeno', tipo: 'nfc' },
      base.db,
    );

    expect(await obtenerChip(local.localId, id, base.db)).toBeNull();
    expect((await listarChips(local.localId, base.db)).map((c) => c.id)).not.toContain(id);
    expect(await cambiarEstadoChip(local.localId, id, false, base.db)).toBe(false);
    expect(await renombrarChip(local.localId, id, 'Hackeado', base.db)).toBe(false);

    const intacto = await obtenerChip(otro.localId, id, base.db);
    expect(intacto?.activo).toBe(true);
    expect(intacto?.objeto).toBe('Ajeno');
  });
});
