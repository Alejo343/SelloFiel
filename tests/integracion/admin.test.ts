import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { locales, programas, usuariosLocal } from '../../src/db/schema';
import {
  autenticarAdmin,
  cambiarActivoLocal,
  cambiarContrasenaDueno,
  crearAdmin,
  crearLocalConDueno,
  debeCambiarContrasena,
  listarLocales,
  restablecerContrasenaDueno,
  type DatosNuevoLocal,
} from '../../src/servicios/admin';
import { autenticar } from '../../src/servicios/panel';
import { resolverLocalPorSlug } from '../../src/servicios/tags';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';

let base: BaseDePruebas;
beforeAll(async () => {
  base = await abrirBaseDePruebas();
});
afterAll(async () => {
  await base.cerrar();
});
beforeEach(async () => {
  await base.limpiar();
  await base.cliente`truncate table administradores`;
});

const NUEVO: DatosNuevoLocal = {
  nombre: 'El Barril',
  slug: 'el-barril',
  premio: 'Una cerveza artesanal',
  sellosObjetivo: 8,
  colorPrimario: '#1C7A3E',
  whatsapp: '300 111 2233',
  emitePases: true,
  duenoNombre: 'Dueño del Barril',
  duenoEmail: 'Dueno@ElBarril.co',
};

describe('administradores', () => {
  it('crear un admin devuelve una contraseña que sirve para entrar', async () => {
    const clave = await crearAdmin({ email: 'David@SelloFiel.app', nombre: 'David' }, base.db);
    expect(await autenticarAdmin('david@sellofiel.app', clave, base.db)).not.toBeNull();
    expect(await autenticarAdmin('david@sellofiel.app', 'otra', base.db)).toBeNull();
  });

  it('volver a crearlo sirve para recuperar el acceso: la clave vieja deja de valer', async () => {
    const vieja = await crearAdmin({ email: 'd@s.app', nombre: 'D' }, base.db);
    const nueva = await crearAdmin({ email: 'd@s.app', nombre: 'D' }, base.db);
    expect(await autenticarAdmin('d@s.app', vieja, base.db)).toBeNull();
    expect(await autenticarAdmin('d@s.app', nueva, base.db)).not.toBeNull();
  });

  it('un dueño NO puede entrar como administrador con su contraseña', async () => {
    const r = await crearLocalConDueno(NUEVO, base.db);
    if (!r.ok) throw new Error('no se creó');
    expect(await autenticarAdmin('dueno@elbarril.co', r.contrasenaTemporal, base.db)).toBeNull();
  });
});

describe('crearLocalConDueno', () => {
  it('crea el local, su programa y el dueño, que ya puede entrar al panel', async () => {
    const r = await crearLocalConDueno(NUEVO, base.db);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const local = await resolverLocalPorSlug('el-barril', base.db);
    expect(local?.localNombre).toBe('El Barril');
    expect(local?.sellosObjetivo).toBe(8);
    expect(local?.whatsapp).toBe('573001112233');

    const dueno = await autenticar('dueno@elbarril.co', r.contrasenaTemporal, base.db);
    expect(dueno?.localId).toBe(r.localId);
  });

  it('el dueño queda obligado a cambiar la contraseña temporal', async () => {
    const r = await crearLocalConDueno(NUEVO, base.db);
    if (!r.ok) throw new Error('no se creó');
    const [u] = await base.db.select().from(usuariosLocal).where(eq(usuariosLocal.localId, r.localId));
    expect(await debeCambiarContrasena(u.id, base.db)).toBe(true);
  });

  it('rechaza una dirección repetida sin dejar nada a medias', async () => {
    await crearLocalConDueno(NUEVO, base.db);
    const r = await crearLocalConDueno({ ...NUEVO, duenoEmail: 'otro@x.co' }, base.db);

    expect(r).toEqual({ ok: false, campo: 'slug', motivo: 'Ya hay un local con esa dirección' });
    expect(await base.db.select().from(locales)).toHaveLength(1);
  });

  it('rechaza un correo de dueño repetido y no deja el local creado a medias', async () => {
    // Es la razón de la transacción: sin ella quedaría un local sin dueño.
    await crearLocalConDueno(NUEVO, base.db);
    const r = await crearLocalConDueno({ ...NUEVO, slug: 'otro-local' }, base.db);

    expect(r).toMatchObject({ ok: false, campo: 'duenoEmail' });
    expect(await base.db.select().from(locales)).toHaveLength(1);
    expect(await base.db.select().from(programas)).toHaveLength(1);
  });

  it('rechaza una dirección inválida o reservada', async () => {
    expect(await crearLocalConDueno({ ...NUEVO, slug: 'Con Espacios' }, base.db)).toMatchObject({
      ok: false,
      campo: 'slug',
    });
    expect(await crearLocalConDueno({ ...NUEVO, slug: 'admin' }, base.db)).toMatchObject({
      ok: false,
      campo: 'slug',
    });
  });
});

describe('gestión de locales', () => {
  it('pausar un local lo saca de servicio', async () => {
    const r = await crearLocalConDueno(NUEVO, base.db);
    if (!r.ok) throw new Error('no se creó');

    await cambiarActivoLocal(r.localId, false, base.db);
    expect(await resolverLocalPorSlug('el-barril', base.db)).toBeNull();
    expect(await autenticar('dueno@elbarril.co', r.contrasenaTemporal, base.db)).toBeNull();
  });

  it('lista todos los locales con su dueño', async () => {
    await crearLocalConDueno(NUEVO, base.db);
    const lista = await listarLocales(base.db);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nombre: 'El Barril', duenoEmail: 'dueno@elbarril.co', clientes: 0 });
  });

  it('restablecer la contraseña invalida la anterior', async () => {
    const r = await crearLocalConDueno(NUEVO, base.db);
    if (!r.ok) throw new Error('no se creó');
    const nueva = await restablecerContrasenaDueno(r.localId, base.db);

    expect(await autenticar('dueno@elbarril.co', r.contrasenaTemporal, base.db)).toBeNull();
    expect(await autenticar('dueno@elbarril.co', nueva!.contrasenaTemporal, base.db)).not.toBeNull();
  });
});

describe('el dueño cambia su contraseña', () => {
  it('con la actual correcta, y deja de estar obligado', async () => {
    const r = await crearLocalConDueno(NUEVO, base.db);
    if (!r.ok) throw new Error('no se creó');
    const [u] = await base.db.select().from(usuariosLocal).where(eq(usuariosLocal.localId, r.localId));

    expect(await cambiarContrasenaDueno(u.id, r.contrasenaTemporal, 'mi-clave-segura-2026', base.db)).toEqual({ ok: true });
    expect(await debeCambiarContrasena(u.id, base.db)).toBe(false);
    expect(await autenticar('dueno@elbarril.co', 'mi-clave-segura-2026', base.db)).not.toBeNull();
  });

  it('rechaza si la actual es incorrecta o la nueva es corta', async () => {
    const r = await crearLocalConDueno(NUEVO, base.db);
    if (!r.ok) throw new Error('no se creó');
    const [u] = await base.db.select().from(usuariosLocal).where(eq(usuariosLocal.localId, r.localId));

    expect((await cambiarContrasenaDueno(u.id, 'mala', 'mi-clave-segura-2026', base.db)).ok).toBe(false);
    expect((await cambiarContrasenaDueno(u.id, r.contrasenaTemporal, 'corta', base.db)).ok).toBe(false);
  });
});
