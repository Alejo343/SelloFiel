/**
 * Campañas masivas contra la base real (RF-31).
 *
 * Lo que no puede fallar: que llegue a quien pidió la baja, que llegue a
 * clientes de otro local, o que una campaña quede a medias.
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { campanas, mensajes, sellos } from '../../src/db/schema';
import {
  cancelarPendientes,
  contarPorSegmento,
  crearCampana,
  listarCampanas,
} from '../../src/servicios/campanas';
import { darDeBaja } from '../../src/servicios/clientes';
import { bandejaPendientes, marcarEnviado } from '../../src/servicios/mensajes';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';
import { crearClienteDePrueba, crearLocalDePrueba, instante, type LocalDePrueba } from '../ayuda/fabricas';

let base: BaseDePruebas;
let local: LocalDePrueba;
let otro: LocalDePrueba;
const HOY = instante('2026-11-24');

beforeAll(async () => {
  base = await abrirBaseDePruebas();
});
afterAll(async () => {
  await base.cerrar();
});

async function cliente(l: LocalDePrueba, nombre: string, dias: string[] = [], cumple: string | null = null) {
  const id = await crearClienteDePrueba(base.db, l.localId, { nombre, fechaNacimiento: cumple });
  if (dias.length) {
    await base.db
      .insert(sellos)
      .values(dias.map((fecha) => ({ localId: l.localId, clienteId: id, fecha, origen: 'nfc' as const })));
  }
  return id;
}

let ana: string;
let pedro: string;

beforeEach(async () => {
  await base.limpiar();
  local = await crearLocalDePrueba(base.db, { slug: 'la-esquina', sellosObjetivo: 10 });
  otro = await crearLocalDePrueba(base.db, { slug: 'cafe-vecino', sellosObjetivo: 10 });

  await cliente(local, 'Marta Frecuente', ['2026-11-20', '2026-11-10']);
  ana = await cliente(local, 'Ana Perdida', ['2026-07-01']);
  await cliente(local, 'Carlos Cumple', [], '1990-11-30');
  pedro = await cliente(local, 'Pedro Baja', ['2026-11-21']);
  await darDeBaja(local.localId, pedro, base.db);
  await cliente(otro, 'Sofía Vecina', ['2026-11-22']);
});

const nueva = (p: Partial<Parameters<typeof crearCampana>[0]> = {}) =>
  crearCampana(
    { localId: local.localId, nombre: 'Día de la milanesa', segmento: 'todos', texto: 'Hola {nombre}, hoy 2x1 en {local}', ...p },
    base.db,
    HOY,
  );

describe('campañas', () => {
  it('cuenta por segmento sin incluir a quien pidió la baja ni a otro local', async () => {
    const c = await contarPorSegmento(local.localId, base.db, HOY);
    expect(c.todos).toBe(3);
    expect(c.frecuentes).toBe(1);
    expect(c.inactivos).toBe(1);
    expect(c.cumplen_este_mes).toBe(1);
  });

  it('deja un mensaje personalizado por destinatario en la bandeja, con el nombre de la campaña', async () => {
    const r = await nueva();
    expect(r).toMatchObject({ ok: true, destinatarios: 3 });

    const bandeja = await bandejaPendientes(local.localId, base.db);
    expect(bandeja).toHaveLength(3);
    expect(bandeja.map((m) => m.clienteNombre)).not.toContain('Pedro Baja');
    const marta = bandeja.find((m) => m.clienteNombre === 'Marta Frecuente')!;
    expect(marta.texto).toMatch(/^Hola Marta Frecuente, hoy 2x1 en \S/);
    expect(marta.motivo).toBe('Campaña: Día de la milanesa');

    // Nada de otro local.
    expect(await bandejaPendientes(otro.localId, base.db)).toHaveLength(0);
  });

  it('solo le llega al segmento elegido', async () => {
    await nueva({ segmento: 'inactivos' });
    const filas = await base.db.select().from(mensajes);
    expect(filas).toHaveLength(1);
    expect(filas[0].clienteId).toBe(ana);
  });

  it('dos campañas iguales son dos envíos distintos (clave por campaña)', async () => {
    await nueva();
    await nueva();
    expect(await base.db.select().from(mensajes)).toHaveLength(6);
  });

  it('rechaza sin crear nada si el texto es inválido o el segmento está vacío', async () => {
    expect((await nueva({ texto: 'Hola {nombe}' })).ok).toBe(false);
    await base.db.delete(sellos).where(eq(sellos.clienteId, ana));
    expect(await nueva({ segmento: 'inactivos' })).toMatchObject({ ok: false });
    expect(await base.db.select().from(campanas)).toHaveLength(0);
    expect(await base.db.select().from(mensajes)).toHaveLength(0);
  });

  it('lista con el avance, y cancelar quita solo lo pendiente de ESE local', async () => {
    const r = await nueva();
    if (!r.ok) throw new Error();
    const [primero] = await bandejaPendientes(local.localId, base.db);
    await marcarEnviado(local.localId, primero.id, base.db);

    // Otro local no puede cancelar la campaña ajena.
    expect(await cancelarPendientes(otro.localId, r.campanaId, base.db)).toBe(0);
    expect(await cancelarPendientes(local.localId, r.campanaId, base.db)).toBe(2);

    const [c] = await listarCampanas(local.localId, base.db);
    expect(c).toMatchObject({ destinatarios: 3, enviados: 1, pendientes: 0, descartados: 2 });
    expect(await listarCampanas(otro.localId, base.db)).toHaveLength(0);
  });
});
