/**
 * Varias sucursales de una misma marca (RF-32), contra la base real.
 *
 * La promesa: una sola tarjeta que suma en cualquier sede. Lo que no puede
 * pasar: dos sellos el mismo día por ir a dos sedes, un chip de una sede
 * cerrada que siga sumando, o datos que crucen de un local a otro.
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { canjes, colaWallet, sellos, sucursales, tags } from '../../src/db/schema';
import { crearLocalConDueno } from '../../src/servicios/admin';
import { visitaParaOpinar } from '../../src/servicios/opiniones';
import { canjear, sumarSello } from '../../src/servicios/sellos';
import {
  actualizarSucursal,
  cambiarActivaSucursal,
  crearSucursal,
  listarSucursales,
  resolverSucursalElegida,
  resumenPorSucursal,
} from '../../src/servicios/sucursales';
import { resolverTag } from '../../src/servicios/tags';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';
import { crearClienteDePrueba, crearLocalDePrueba, instante, type LocalDePrueba } from '../ayuda/fabricas';

let base: BaseDePruebas;
let local: LocalDePrueba;
let norte: string;
let tagNorte: string;

beforeAll(async () => {
  base = await abrirBaseDePruebas();
});
afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  local = await crearLocalDePrueba(base.db, { slug: 'la-esquina' });
  const r = await crearSucursal(local.localId, { nombre: 'Norte', lat: '4.67', lng: '-74.04' }, base.db);
  if (!r.ok) throw new Error(r.motivo);
  norte = r.id;
  const [t] = await base.db
    .insert(tags)
    .values({ localId: local.localId, sucursalId: norte, token: 'tag-norte', tipo: 'nfc' })
    .returning();
  tagNorte = t.id;
});

const sumar = (clienteId: string, extra: Partial<Parameters<typeof sumarSello>[0]>, dia = '2026-11-24') =>
  sumarSello(
    {
      localId: local.localId,
      clienteId,
      sellosObjetivo: 10,
      zonaHoraria: local.zonaHoraria,
      origen: 'nfc',
      ahora: instante(dia),
      ...extra,
    },
    base.db,
  );

describe('una sola tarjeta para todas las sedes', () => {
  it('suma en cualquier sede y cada sello guarda dónde fue', async () => {
    const cliente = await crearClienteDePrueba(base.db, local.localId);
    expect((await sumar(cliente, { tagId: local.tagId }, '2026-11-23')).resultado).toBe('sumado');
    expect((await sumar(cliente, { tagId: tagNorte }, '2026-11-24')).resultado).toBe('sumado');

    const filas = await base.db.select().from(sellos).where(eq(sellos.clienteId, cliente));
    expect(filas.map((f) => f.sucursalId).sort()).toEqual([local.sucursalId, norte].sort());
  });

  it('ir a dos sedes el mismo día NO da dos sellos (RN-01 vale para la marca)', async () => {
    const cliente = await crearClienteDePrueba(base.db, local.localId);
    expect((await sumar(cliente, { tagId: local.tagId })).resultado).toBe('sumado');
    const segundo = await sumar(cliente, { tagId: tagNorte });
    expect(segundo).toMatchObject({ resultado: 'rechazado', motivo: 'ya_sumo_hoy' });
  });

  it('la sede de un sello con chip sale del chip, no de lo que se pase', async () => {
    const cliente = await crearClienteDePrueba(base.db, local.localId);
    await sumar(cliente, { tagId: tagNorte, sucursalId: local.sucursalId });
    const [s] = await base.db.select().from(sellos).where(eq(sellos.clienteId, cliente));
    expect(s.sucursalId).toBe(norte);
  });

  it('un sello o un canje manual nunca queda en una sede de otro local', async () => {
    const otro = await crearLocalDePrueba(base.db, { slug: 'cafe-vecino' });
    const cliente = await crearClienteDePrueba(base.db, local.localId);
    await sumar(cliente, { origen: 'manual', sucursalId: otro.sucursalId });
    const [s] = await base.db.select().from(sellos).where(eq(sellos.clienteId, cliente));
    expect(s.sucursalId).toBeNull();

    await base.db.insert(sellos).values(
      Array.from({ length: 10 }, (_, i) => ({
        localId: local.localId,
        clienteId: cliente,
        fecha: `2026-10-${String(i + 1).padStart(2, '0')}`,
        origen: 'nfc' as const,
      })),
    );
    await canjear(
      { localId: local.localId, clienteId: cliente, sellosObjetivo: 10, premio: 'x', sucursalId: otro.sucursalId },
      base.db,
    );
    const [c] = await base.db.select().from(canjes);
    expect(c.sucursalId).toBeNull();
  });
});

describe('abrir y cerrar sedes', () => {
  it('cerrada, sus chips dejan de sumar; reabierta, vuelven', async () => {
    const cliente = await crearClienteDePrueba(base.db, local.localId);
    expect((await cambiarActivaSucursal(local.localId, norte, false, base.db)).ok).toBe(true);

    expect((await resolverTag('tag-norte', base.db))?.tagActivo).toBe(false);
    expect(await sumar(cliente, { tagId: tagNorte })).toMatchObject({ motivo: 'tag_inactivo' });

    await cambiarActivaSucursal(local.localId, norte, true, base.db);
    expect((await resolverTag('tag-norte', base.db))?.tagActivo).toBe(true);
    expect((await sumar(cliente, { tagId: tagNorte })).resultado).toBe('sumado');
  });

  it('no deja cerrar la última sede abierta', async () => {
    await cambiarActivaSucursal(local.localId, norte, false, base.db);
    const r = await cambiarActivaSucursal(local.localId, local.sucursalId, false, base.db);
    expect(r.ok).toBe(false);
  });

  it('cada cambio de sedes actualiza la plantilla del wallet (por la ubicación)', async () => {
    const antes = (await base.db.select().from(colaWallet)).length;
    await actualizarSucursal(local.localId, norte, { nombre: 'Norte', lat: '4.7', lng: '-74.05' }, base.db);
    const despues = await base.db.select().from(colaWallet);
    expect(despues.length).toBeGreaterThanOrEqual(1);
    expect(despues.some((f) => f.tipo === 'crear_clase')).toBe(true);
    expect(antes).toBeLessThanOrEqual(despues.length);
  });

  it('valida nombre repetido, coordenadas a medias y enlaces raros', async () => {
    expect(await crearSucursal(local.localId, { nombre: 'Norte' }, base.db)).toMatchObject({ ok: false });
    expect(await crearSucursal(local.localId, { nombre: 'Sur', lat: '4.6' }, base.db)).toMatchObject({ ok: false });
    expect(
      await crearSucursal(local.localId, { nombre: 'Sur', lat: 'cerca', lng: '-74' }, base.db),
    ).toMatchObject({ ok: false });
    expect(
      await crearSucursal(local.localId, { nombre: 'Sur', googleMapsUrl: 'javascript:alert(1)' }, base.db),
    ).toMatchObject({ ok: false });
    expect(await crearSucursal(local.localId, { nombre: '  Sur  ' }, base.db)).toMatchObject({ ok: true });
  });

  it('un dueño no toca ni elige sedes de otro local', async () => {
    const otro = await crearLocalDePrueba(base.db, { slug: 'cafe-vecino' });
    expect((await actualizarSucursal(otro.localId, norte, { nombre: 'Robada' }, base.db)).ok).toBe(false);
    expect((await cambiarActivaSucursal(otro.localId, norte, false, base.db)).ok).toBe(false);
    expect(await resolverSucursalElegida(otro.localId, norte, base.db)).toBe(otro.sucursalId);
    expect((await listarSucursales(otro.localId, base.db)).map((s) => s.id)).not.toContain(norte);
  });
});

describe('lo que es propio de cada sede', () => {
  it('la reseña va a la ficha de Google de la sede visitada, o a otra si esa no tiene', async () => {
    await base.db.update(sucursales).set({ googleMapsUrl: 'https://maps.test/centro' }).where(eq(sucursales.id, local.sucursalId));
    await base.db.update(sucursales).set({ googleMapsUrl: 'https://maps.test/norte' }).where(eq(sucursales.id, norte));
    const cliente = await crearClienteDePrueba(base.db, local.localId);
    await sumar(cliente, { tagId: tagNorte });
    const [s] = await base.db.select().from(sellos);
    expect((await visitaParaOpinar('la-esquina', s.id, base.db))?.googleMapsUrl).toBe('https://maps.test/norte');

    await base.db.update(sucursales).set({ googleMapsUrl: null }).where(eq(sucursales.id, norte));
    expect((await visitaParaOpinar('la-esquina', s.id, base.db))?.googleMapsUrl).toBe('https://maps.test/centro');
  });

  it('el resumen cuenta los sellos de cada sede', async () => {
    const a = await crearClienteDePrueba(base.db, local.localId);
    const b = await crearClienteDePrueba(base.db, local.localId);
    await sumar(a, { tagId: tagNorte });
    await sumar(b, { tagId: tagNorte });
    await sumar(a, { tagId: local.tagId }, '2026-11-25');
    const r = await resumenPorSucursal(local.localId, '2026-11-01', base.db);
    expect(r.find((x) => x.id === norte)?.sellosDelPeriodo).toBe(2);
    expect(r.find((x) => x.id === local.sucursalId)?.sellosDelPeriodo).toBe(1);
  });

  it('un local creado por el administrador nace con una sede', async () => {
    const r = await crearLocalConDueno(
      {
        nombre: 'El Barril',
        slug: 'el-barril',
        premio: 'Una cerveza',
        sellosObjetivo: 8,
        emitePases: false,
        duenoNombre: 'Dueño',
        duenoEmail: 'dueno@elbarril.co',
      },
      base.db,
    );
    if (!r.ok) throw new Error();
    expect(await listarSucursales(r.localId, base.db)).toHaveLength(1);
  });
});
