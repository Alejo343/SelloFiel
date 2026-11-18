/**
 * Generación de los mensajes que hacen volver al cliente, y la bandeja del
 * panel (RF-26).
 *
 * El trabajo diario calcula a quién hay que escribirle hoy y por qué, y deja
 * los mensajes en estado 'pendiente'. El local los ve en su bandeja con el
 * texto ya armado y un botón que abre WhatsApp. Nadie envía nada
 * automáticamente todavía: eso es la Fase 9, con la API de Meta.
 *
 * La idempotencia es lo delicado de todo esto. El trabajo corre a diario y las
 * ventanas duran varios días, así que sin una clave de ocasión el cliente
 * recibiría siete felicitaciones de cumpleaños. Ver `claveDeOcasion`.
 */

import { and, asc, desc, eq, gte, isNull, lte, ne, sql } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { clientes, locales, mensajes, plantillas, programas, sellos } from '../db/schema';
import { diaEnZona, sumarDias, type Dia } from '../dominio/fechas';
import { motivosParaEscribir } from '../dominio/inactividad';
import {
  claveDeOcasion,
  enlaceWhatsApp,
  motivoLegible,
  PLANTILLAS_POR_DEFECTO,
  renderizarPlantilla,
  type TipoMensaje,
} from '../dominio/mensajes';
import { calcularEstado } from '../dominio/sellos';
import type { BaseDeDatos } from './tipos';

const BASE_PUBLICA = () => process.env.URL_PUBLICA ?? 'http://localhost:3011';

export interface ResultadoGeneracion {
  creados: number;
  porTipo: Partial<Record<TipoMensaje, number>>;
}

/**
 * Calcula los mensajes de hoy para un local (o para todos).
 *
 * Se le pasa `ahora` para poder fijarlo en las pruebas: nunca lee el reloj por
 * su cuenta.
 */
export async function generarMensajes(
  opciones: { localId?: string; ahora?: Date } = {},
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResultadoGeneracion> {
  const ahora = opciones.ahora ?? new Date();
  const resultado: ResultadoGeneracion = { creados: 0, porTipo: {} };

  const listaLocales = await db
    .select({
      id: locales.id,
      slug: locales.slug,
      nombre: locales.nombre,
      zonaHoraria: locales.zonaHoraria,
      activo: locales.activo,
      sellosObjetivo: programas.sellosObjetivo,
      premio: programas.premio,
      semanasInactividad: programas.semanasInactividad,
      diasAntesCumple: programas.diasAntesCumple,
      horasPostVisita: programas.horasPostVisita,
    })
    .from(locales)
    .innerJoin(programas, eq(programas.localId, locales.id))
    .where(opciones.localId ? eq(locales.id, opciones.localId) : sql`true`);

  for (const local of listaLocales) {
    if (!local.activo) continue;

    const hoy = diaEnZona(ahora, local.zonaHoraria);
    const textos = await plantillasDelLocal(local.id, db);

    /* ---- clientes con su estado, de una sola consulta ---- */
    const filas = await db
      .select({
        id: clientes.id,
        nombre: clientes.nombre,
        telefono: clientes.telefono,
        fechaNacimiento: clientes.fechaNacimiento,
        bajaEn: clientes.bajaEn,
        sellosDisponibles: sql<number>`
          count(${sellos.id}) filter (where ${sellos.canjeId} is null)::int`,
        ultimoSello: sql<string | null>`max(${sellos.fecha})`,
      })
      .from(clientes)
      .leftJoin(sellos, eq(sellos.clienteId, clientes.id))
      .where(and(eq(clientes.localId, local.id), isNull(clientes.bajaEn)))
      .groupBy(clientes.id);

    for (const cliente of filas) {
      const estado = calcularEstado(cliente.sellosDisponibles, local.sellosObjetivo);

      const motivos = motivosParaEscribir(
        {
          ultimoSello: cliente.ultimoSello,
          fechaNacimiento: cliente.fechaNacimiento,
          dadoDeBaja: cliente.bajaEn !== null,
        },
        hoy,
        {
          semanasInactividad: local.semanasInactividad,
          diasAntesCumple: local.diasAntesCumple,
        },
      );

      for (const tipo of motivos) {
        const creado = await crearMensaje(
          {
            localId: local.id,
            clienteId: cliente.id,
            tipo,
            clave: claveDeOcasion(tipo, { hoy, ultimoSello: cliente.ultimoSello }),
            texto: renderizarPlantilla(textos[tipo], {
              nombre: cliente.nombre,
              local: local.nombre,
              sellos: estado.sellos,
              faltan: estado.faltan,
              premio: local.premio,
            }),
            programadoPara: ahora,
          },
          db,
        );

        if (creado) {
          resultado.creados += 1;
          resultado.porTipo[tipo] = (resultado.porTipo[tipo] ?? 0) + 1;
        }
      }
    }

    /* ---- la pregunta de después de la visita ---- */
    resultado.creados += await generarPostVisita(
      { local, hoy, ahora, textos },
      resultado,
      db,
    );
  }

  return resultado;
}

/**
 * RN-07: se pregunta unas horas DESPUÉS de la visita, no al salir.
 *
 * Se busca entre los sellos de hoy y ayer los que ya cumplieron la espera. El
 * límite inferior evita resucitar visitas viejas si el trabajo lleva días sin
 * correr: preguntarle a alguien por una comida de la semana pasada queda raro.
 */
async function generarPostVisita(
  contexto: {
    local: { id: string; slug: string; nombre: string; premio: string; sellosObjetivo: number; horasPostVisita: number };
    hoy: Dia;
    ahora: Date;
    textos: Record<TipoMensaje, string>;
  },
  resultado: ResultadoGeneracion,
  db: BaseDeDatos,
): Promise<number> {
  const { local, hoy, ahora, textos } = contexto;

  const limiteSuperior = new Date(ahora.getTime() - local.horasPostVisita * 3_600_000);
  const limiteInferior = new Date(ahora.getTime() - 36 * 3_600_000);

  const visitas = await db
    .select({
      selloId: sellos.id,
      fecha: sellos.fecha,
      clienteId: clientes.id,
      nombre: clientes.nombre,
      telefono: clientes.telefono,
    })
    .from(sellos)
    .innerJoin(clientes, eq(sellos.clienteId, clientes.id))
    .where(
      and(
        eq(sellos.localId, local.id),
        isNull(clientes.bajaEn),
        gte(sellos.fecha, sumarDias(hoy, -2)),
        lte(sellos.creadoEn, limiteSuperior),
        gte(sellos.creadoEn, limiteInferior),
      ),
    );

  let creados = 0;

  /**
   * El panel ya no deja guardar esta plantilla sin `{enlace}`, pero puede
   * haber textos guardados antes de esa validación. Sin el enlace, el cliente
   * recibiría una pregunta sin forma de responder, y el local no se enteraría.
   */
  const plantillaPostVisita = textos.post_visita.includes('{enlace}')
    ? textos.post_visita
    : `${textos.post_visita} {enlace}`;

  for (const visita of visitas) {
    const enlaceOpinion = `${BASE_PUBLICA()}/c/${local.slug}/opinion/${visita.selloId}`;

    const creado = await crearMensaje(
      {
        localId: local.id,
        clienteId: visita.clienteId,
        tipo: 'post_visita',
        clave: claveDeOcasion('post_visita', { hoy, diaDeLaVisita: visita.fecha }),
        texto: renderizarPlantilla(plantillaPostVisita, {
          nombre: visita.nombre,
          local: local.nombre,
          sellos: 0,
          faltan: 0,
          premio: local.premio,
          enlaceOpinion,
        }),
        programadoPara: ahora,
      },
      db,
    );

    if (creado) {
      creados += 1;
      resultado.porTipo.post_visita = (resultado.porTipo.post_visita ?? 0) + 1;
    }
  }

  return creados;
}

/** Inserta si no existía ya ese mensaje. Devuelve si lo creó. */
async function crearMensaje(
  datos: {
    localId: string;
    clienteId: string;
    tipo: TipoMensaje;
    clave: string;
    texto: string;
    programadoPara: Date;
  },
  db: BaseDeDatos,
): Promise<boolean> {
  const filas = await db
    .insert(mensajes)
    .values(datos)
    .onConflictDoNothing({ target: [mensajes.clienteId, mensajes.clave] })
    .returning({ id: mensajes.id });

  return filas.length > 0;
}

/** Los textos del local, con los de fábrica para los que no haya personalizado. */
export async function plantillasDelLocal(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<Record<TipoMensaje, string>> {
  const filas = await db
    .select({ tipo: plantillas.tipo, texto: plantillas.texto, activa: plantillas.activa })
    .from(plantillas)
    .where(eq(plantillas.localId, localId));

  const textos = { ...PLANTILLAS_POR_DEFECTO };
  for (const fila of filas) {
    if (fila.activa) textos[fila.tipo] = fila.texto;
  }
  return textos;
}

export async function guardarPlantilla(
  localId: string,
  tipo: TipoMensaje,
  texto: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<void> {
  await db
    .insert(plantillas)
    .values({ localId, tipo, texto })
    .onConflictDoUpdate({
      target: [plantillas.localId, plantillas.tipo],
      set: { texto, activa: true },
    });
}

/* ------------------------------------------------------------- bandeja */

export interface ItemBandeja {
  id: string;
  clienteId: string;
  clienteNombre: string;
  telefono: string;
  tipo: TipoMensaje;
  motivo: string;
  texto: string;
  enlace: string;
  programadoPara: Date;
}

/** Lo que el local tiene que enviar hoy, con el enlace listo (RF-26). */
export async function bandejaPendientes(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
  limite = 200,
): Promise<ItemBandeja[]> {
  const filas = await db
    .select({
      id: mensajes.id,
      clienteId: mensajes.clienteId,
      tipo: mensajes.tipo,
      texto: mensajes.texto,
      programadoPara: mensajes.programadoPara,
      clienteNombre: clientes.nombre,
      telefono: clientes.telefono,
      bajaEn: clientes.bajaEn,
    })
    .from(mensajes)
    .innerJoin(clientes, eq(mensajes.clienteId, clientes.id))
    .where(and(eq(mensajes.localId, localId), eq(mensajes.estado, 'pendiente')))
    .orderBy(asc(mensajes.programadoPara))
    .limit(limite);

  return (
    filas
      /**
       * RN-08. Se filtra también al leer, no solo al generar: el cliente pudo
       * pedir la baja DESPUÉS de que el mensaje se generara, y ese mensaje
       * sigue en la bandeja esperando. Si no se filtrara acá, el local le
       * escribiría igual a quien pidió que no le escribieran.
       */
      .filter((f) => f.bajaEn === null)
      .map((f) => ({
        id: f.id,
        clienteId: f.clienteId,
        clienteNombre: f.clienteNombre,
        telefono: f.telefono,
        tipo: f.tipo,
        motivo: motivoLegible(f.tipo),
        texto: f.texto,
        enlace: enlaceWhatsApp(f.telefono, f.texto),
        programadoPara: f.programadoPara,
      }))
  );
}

export async function marcarEnviado(
  localId: string,
  mensajeId: string,
  db: BaseDeDatos = dbPorDefecto,
  ahora: Date = new Date(),
): Promise<boolean> {
  const filas = await db
    .update(mensajes)
    .set({ estado: 'enviado', enviadoEn: ahora })
    .where(and(eq(mensajes.id, mensajeId), eq(mensajes.localId, localId)))
    .returning({ id: mensajes.id });

  return filas.length > 0;
}

export async function descartarMensaje(
  localId: string,
  mensajeId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<boolean> {
  const filas = await db
    .update(mensajes)
    .set({ estado: 'descartado' })
    .where(and(eq(mensajes.id, mensajeId), eq(mensajes.localId, localId)))
    .returning({ id: mensajes.id });

  return filas.length > 0;
}

/** Cuántos pendientes tiene el local, para avisarlo en la portada del panel. */
export async function contarPendientes(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<number> {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mensajes)
    .innerJoin(clientes, eq(mensajes.clienteId, clientes.id))
    .where(
      and(
        eq(mensajes.localId, localId),
        eq(mensajes.estado, 'pendiente'),
        isNull(clientes.bajaEn),
      ),
    );

  return fila?.n ?? 0;
}

/** Historial, para que el local vea qué se mandó y cuándo. */
export async function historialMensajes(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
  limite = 100,
) {
  return db
    .select({
      id: mensajes.id,
      tipo: mensajes.tipo,
      texto: mensajes.texto,
      estado: mensajes.estado,
      enviadoEn: mensajes.enviadoEn,
      clienteNombre: clientes.nombre,
    })
    .from(mensajes)
    .innerJoin(clientes, eq(mensajes.clienteId, clientes.id))
    .where(and(eq(mensajes.localId, localId), ne(mensajes.estado, 'pendiente')))
    .orderBy(desc(mensajes.enviadoEn))
    .limit(limite);
}
