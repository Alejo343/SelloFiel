/**
 * La generación de mensajes contra la base real.
 *
 * Lo que más importa acá es la idempotencia: el trabajo corre todos los días y
 * las ventanas duran varios días, así que sin claves de ocasión el cliente
 * recibiría una felicitación diaria durante una semana. Eso no es un detalle
 * estético: es la clase de cosa por la que un local apaga la herramienta.
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { mensajes, sellos } from '../../src/db/schema';
import { darDeBaja } from '../../src/servicios/clientes';
import {
  bandejaPendientes,
  contarPendientes,
  generarMensajes,
  guardarPlantilla,
  marcarEnviado,
  plantillasDelLocal,
} from '../../src/servicios/mensajes';
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
  local = await crearLocalDePrueba(base.db, { slug: 'la-esquina', sellosObjetivo: 10 });
});

/** Un cliente con sellos en los días indicados (relativos al día base). */
async function clienteCon(opciones: {
  nombre?: string;
  telefono?: string;
  cumple?: string | null;
  diasConSello?: string[];
}) {
  const id = await crearClienteDePrueba(base.db, local.localId, {
    nombre: opciones.nombre ?? 'Cliente',
    telefono: opciones.telefono,
    fechaNacimiento: opciones.cumple ?? null,
  });

  if (opciones.diasConSello?.length) {
    await base.db.insert(sellos).values(
      opciones.diasConSello.map((fecha) => ({
        localId: local.localId,
        clienteId: id,
        fecha,
        origen: 'nfc' as const,
      })),
    );
  }

  return id;
}

const HOY = instante('2026-11-18');

describe('generarMensajes: a quién le escribe', () => {
  it('felicita a quien cumple dentro de la ventana', async () => {
    await clienteCon({ nombre: 'Carlos Cumple', cumple: '1990-11-21' });

    const r = await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    expect(r.porTipo.cumpleanos).toBe(1);
    const [m] = await base.db.select().from(mensajes);
    expect(m.texto).toContain('Carlos Cumple');
  });

  it('no felicita a quien cumple el mes que viene', async () => {
    await clienteCon({ cumple: '1990-12-21' });
    const r = await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    expect(r.creados).toBe(0);
  });

  it('escribe a quien dejó de venir', async () => {
    await clienteCon({ nombre: 'Ana Perdida', diasConSello: ['2026-08-01'] });

    const r = await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    expect(r.porTipo.inactividad).toBe(1);
  });

  it('NO escribe a quien nunca vino', async () => {
    // Un "hace mucho que no vienes" a quien nunca vino queda mal y es el tipo
    // de detalle que hace que el local pierda confianza.
    await clienteCon({ nombre: 'Lucía Nueva', diasConSello: [] });
    const r = await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    expect(r.creados).toBe(0);
  });

  it('NO escribe a quien vino hace poco', async () => {
    await clienteCon({ diasConSello: ['2026-11-15'] });
    const r = await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    expect(r.creados).toBe(0);
  });

  it('nunca escribe a quien pidió la baja (RN-08)', async () => {
    const id = await clienteCon({ cumple: '1990-11-21', diasConSello: ['2026-08-01'] });
    await darDeBaja(local.localId, id, base.db);

    const r = await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    expect(r.creados).toBe(0);
  });

  it('rellena el texto con los datos reales del cliente', async () => {
    await clienteCon({
      nombre: 'Marta Fiel',
      diasConSello: ['2026-08-01', '2026-08-02', '2026-08-03'],
    });

    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    const [m] = await base.db.select().from(mensajes);
    expect(m.texto).toContain('Marta Fiel');
    expect(m.texto).toContain('la-esquina');
    expect(m.texto).toContain('3 sellos');
    expect(m.texto).not.toContain('{');
  });
});

describe('generarMensajes es idempotente', () => {
  it('no felicita siete veces durante la ventana de cumpleaños', async () => {
    // El caso que justifica toda la mecánica de claves de ocasión.
    await clienteCon({ cumple: '1990-11-21' });

    for (const dia of ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']) {
      await generarMensajes({ localId: local.localId, ahora: instante(dia) }, base.db);
    }

    const todos = await base.db.select().from(mensajes);
    expect(todos).toHaveLength(1);
  });

  it('no repite el aviso de inactividad cada día', async () => {
    await clienteCon({ diasConSello: ['2026-08-01'] });

    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    await generarMensajes({ localId: local.localId, ahora: instante('2026-11-19') }, base.db);
    await generarMensajes({ localId: local.localId, ahora: instante('2026-11-25') }, base.db);

    expect(await base.db.select().from(mensajes)).toHaveLength(1);
  });

  it('vuelve a avisar si el cliente regresa y se pierde otra vez', async () => {
    const id = await clienteCon({ diasConSello: ['2026-08-01'] });
    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    // Vuelve en diciembre...
    await base.db.insert(sellos).values({
      localId: local.localId,
      clienteId: id,
      fecha: '2026-12-01',
      origen: 'nfc',
    });

    // ...y se vuelve a perder.
    await generarMensajes({ localId: local.localId, ahora: instante('2027-02-15') }, base.db);

    const todos = await base.db.select().from(mensajes);
    expect(todos).toHaveLength(2);
  });

  it('felicita otra vez al año siguiente', async () => {
    await clienteCon({ cumple: '1990-11-21' });

    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    await generarMensajes({ localId: local.localId, ahora: instante('2027-11-18') }, base.db);

    expect(await base.db.select().from(mensajes)).toHaveLength(2);
  });
});

describe('la pregunta después de la visita (RN-07)', () => {
  /** Un sello de hoy, creado hace `horas` horas. */
  async function visitaHace(horas: number, nombre = 'Cliente de hoy') {
    const id = await crearClienteDePrueba(base.db, local.localId, { nombre });
    await base.db.insert(sellos).values({
      localId: local.localId,
      clienteId: id,
      fecha: '2026-11-18',
      origen: 'nfc',
      creadoEn: new Date(HOY.getTime() - horas * 3_600_000),
    });
    return id;
  }

  it('no pregunta justo al salir del local', async () => {
    await visitaHace(0.5);
    const r = await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    expect(r.porTipo.post_visita ?? 0).toBe(0);
  });

  it('pregunta pasadas las horas configuradas', async () => {
    await visitaHace(3);
    const r = await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    expect(r.porTipo.post_visita).toBe(1);
  });

  it('incluye el enlace donde el cliente califica', async () => {
    await visitaHace(3);
    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    const [m] = await base.db
      .select()
      .from(mensajes)
      .where(eq(mensajes.tipo, 'post_visita'));

    expect(m.texto).toMatch(/\/c\/la-esquina\/opinion\//);
  });

  it('no resucita visitas viejas si el trabajo llevaba días sin correr', async () => {
    // Preguntar por una comida de la semana pasada queda raro y delata que
    // el sistema estuvo caído.
    await visitaHace(72);
    const r = await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    expect(r.porTipo.post_visita ?? 0).toBe(0);
  });

  it('pregunta una sola vez por visita, aunque el trabajo corra varias veces', async () => {
    await visitaHace(3);

    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    const todos = await base.db
      .select()
      .from(mensajes)
      .where(eq(mensajes.tipo, 'post_visita'));
    expect(todos).toHaveLength(1);
  });
});

describe('la bandeja del panel', () => {
  it('trae el enlace de WhatsApp ya armado', async () => {
    await clienteCon({
      nombre: 'Marta Fiel',
      telefono: '573001234567',
      diasConSello: ['2026-08-01'],
    });
    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    const [item] = await bandejaPendientes(local.localId, base.db);

    expect(item.enlace).toContain('https://wa.me/573001234567?text=');
    expect(item.motivo).toMatch(/no viene/i);
    expect(decodeURIComponent(item.enlace)).toContain('Marta Fiel');
  });

  it('marcar como enviado lo saca de la bandeja', async () => {
    await clienteCon({ diasConSello: ['2026-08-01'] });
    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    const [item] = await bandejaPendientes(local.localId, base.db);
    expect(await marcarEnviado(local.localId, item.id, base.db)).toBe(true);

    expect(await bandejaPendientes(local.localId, base.db)).toHaveLength(0);
    expect(await contarPendientes(local.localId, base.db)).toBe(0);
  });

  it('oculta los mensajes de quien pidió la baja DESPUÉS de generarse', async () => {
    // El mensaje ya estaba en la bandeja cuando el cliente pidió la baja. Si
    // no se filtrara al leer, el local le escribiría igual.
    const id = await clienteCon({ diasConSello: ['2026-08-01'] });
    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);
    expect(await bandejaPendientes(local.localId, base.db)).toHaveLength(1);

    await darDeBaja(local.localId, id, base.db);

    expect(await bandejaPendientes(local.localId, base.db)).toHaveLength(0);
    expect(await contarPendientes(local.localId, base.db)).toBe(0);
  });

  it('no mezcla las bandejas de dos locales (RNF-05)', async () => {
    const otro = await crearLocalDePrueba(base.db, { slug: 'cafe-vecino' });
    const suCliente = await crearClienteDePrueba(base.db, otro.localId, { nombre: 'Sofía' });
    await base.db.insert(sellos).values({
      localId: otro.localId,
      clienteId: suCliente,
      fecha: '2026-08-01',
      origen: 'nfc',
    });

    await clienteCon({ nombre: 'Marta', diasConSello: ['2026-08-01'] });
    await generarMensajes({ ahora: HOY }, base.db);

    const mios = await bandejaPendientes(local.localId, base.db);
    const suyos = await bandejaPendientes(otro.localId, base.db);

    expect(mios.map((m) => m.clienteNombre)).toEqual(['Marta']);
    expect(suyos.map((m) => m.clienteNombre)).toEqual(['Sofía']);
  });
});

describe('plantillas del local', () => {
  it('usa las de fábrica mientras el local no personalice', async () => {
    const textos = await plantillasDelLocal(local.localId, base.db);
    expect(textos.cumpleanos).toContain('{nombre}');
  });

  it('usa el texto del local cuando lo hay', async () => {
    await guardarPlantilla(local.localId, 'cumpleanos', '¡Feliz cumple {nombre}!', base.db);

    const textos = await plantillasDelLocal(local.localId, base.db);
    expect(textos.cumpleanos).toBe('¡Feliz cumple {nombre}!');
    // Los demás siguen siendo los de fábrica.
    expect(textos.inactividad).toBe((await plantillasDelLocal(local.localId, base.db)).inactividad);
  });

  it('el mensaje generado usa el texto personalizado', async () => {
    await guardarPlantilla(local.localId, 'inactividad', 'Vuelve ya, {nombre}', base.db);
    await clienteCon({ nombre: 'Ana', diasConSello: ['2026-08-01'] });

    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    const [m] = await base.db.select().from(mensajes);
    expect(m.texto).toBe('Vuelve ya, Ana');
  });

  it('guardar dos veces actualiza en vez de duplicar', async () => {
    await guardarPlantilla(local.localId, 'cumpleanos', 'Primera', base.db);
    await guardarPlantilla(local.localId, 'cumpleanos', 'Segunda', base.db);

    const textos = await plantillasDelLocal(local.localId, base.db);
    expect(textos.cumpleanos).toBe('Segunda');
  });
});

describe('un local desactivado no genera mensajes', () => {
  it('se salta el local dado de baja', async () => {
    const { locales } = await import('../../src/db/schema');
    await clienteCon({ diasConSello: ['2026-08-01'] });
    await base.db
      .update(locales)
      .set({ activo: false })
      .where(eq(locales.id, local.localId));

    const r = await generarMensajes({ ahora: HOY }, base.db);
    expect(r.creados).toBe(0);
  });
});

describe('la plantilla de post-visita siempre lleva el enlace', () => {
  it('se lo añade si una plantilla vieja no lo trae', async () => {
    // El panel ya no deja guardarla así, pero puede haber textos guardados
    // antes de esa validación. Sin enlace, el cliente recibe una pregunta que
    // no puede responder y el local nunca se entera.
    await guardarPlantilla(local.localId, 'post_visita', '{nombre}, ¿cómo estuvo?', base.db);

    const id = await crearClienteDePrueba(base.db, local.localId, { nombre: 'Marta' });
    await base.db.insert(sellos).values({
      localId: local.localId,
      clienteId: id,
      fecha: '2026-11-18',
      origen: 'nfc',
      creadoEn: new Date(HOY.getTime() - 3 * 3_600_000),
    });

    await generarMensajes({ localId: local.localId, ahora: HOY }, base.db);

    const [m] = await base.db
      .select()
      .from(mensajes)
      .where(eq(mensajes.tipo, 'post_visita'));

    expect(m.texto).toContain('/opinion/');
  });
});
