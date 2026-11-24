/**
 * Campañas masivas segmentadas (RF-31).
 *
 * Crear una campaña no envía nada: deja un mensaje pendiente por destinatario
 * en la bandeja, con el texto ya personalizado, y el local los dispara con el
 * mismo botón de WhatsApp que el resto. Cuando entre la API de Meta, el envío
 * real saldrá de esa misma bandeja sin tocar esto.
 */

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { campanas, clientes, locales, mensajes, programas, sellos } from '../db/schema';
import { diaEnZona } from '../dominio/fechas';
import { marcadoresDesconocidos, renderizarPlantilla } from '../dominio/mensajes';
import {
  enSegmento,
  SEGMENTOS,
  validarCampana,
  type ClienteSegmentable,
  type Segmento,
} from '../dominio/segmentos';
import { calcularEstado } from '../dominio/sellos';
import type { BaseDeDatos } from './tipos';

interface ClienteConEstado extends ClienteSegmentable {
  id: string;
  nombre: string;
}

/** El local con su programa y sus clientes, listos para segmentar. */
async function cargarLocal(localId: string, db: BaseDeDatos, ahora: Date) {
  const [local] = await db
    .select({
      id: locales.id,
      nombre: locales.nombre,
      zonaHoraria: locales.zonaHoraria,
      premio: programas.premio,
      sellosObjetivo: programas.sellosObjetivo,
      semanasInactividad: programas.semanasInactividad,
      diasAntesCumple: programas.diasAntesCumple,
    })
    .from(locales)
    .innerJoin(programas, eq(programas.localId, locales.id))
    .where(eq(locales.id, localId))
    .limit(1);
  if (!local) return null;

  const filas = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      fechaNacimiento: clientes.fechaNacimiento,
      bajaEn: clientes.bajaEn,
      sellosDisponibles: sql<number>`count(${sellos.id}) filter (where ${sellos.canjeId} is null)::int`,
      ultimoSello: sql<string | null>`max(${sellos.fecha})`,
    })
    .from(clientes)
    .leftJoin(sellos, eq(sellos.clienteId, clientes.id))
    .where(eq(clientes.localId, localId))
    .groupBy(clientes.id);

  const lista: ClienteConEstado[] = filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    fechaNacimiento: f.fechaNacimiento,
    ultimoSello: f.ultimoSello,
    sellosDisponibles: f.sellosDisponibles,
    dadoDeBaja: f.bajaEn !== null,
  }));

  const contexto = {
    hoy: diaEnZona(ahora, local.zonaHoraria),
    sellosObjetivo: local.sellosObjetivo,
    reglas: { semanasInactividad: local.semanasInactividad, diasAntesCumple: local.diasAntesCumple },
  };

  return { local, clientes: lista, contexto };
}

/** Cuántos clientes caen en cada segmento hoy, para mostrarlo al elegir. */
export async function contarPorSegmento(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
  ahora: Date = new Date(),
): Promise<Record<Segmento, number>> {
  const conteo = Object.fromEntries(Object.keys(SEGMENTOS).map((s) => [s, 0])) as Record<Segmento, number>;
  const datos = await cargarLocal(localId, db, ahora);
  if (!datos) return conteo;

  for (const cliente of datos.clientes) {
    for (const segmento of Object.keys(SEGMENTOS) as Segmento[]) {
      if (enSegmento(cliente, segmento, datos.contexto)) conteo[segmento] += 1;
    }
  }
  return conteo;
}

export type ResultadoCampana =
  | { ok: true; campanaId: string; destinatarios: number }
  | { ok: false; motivo: string };

export async function crearCampana(
  datos: { localId: string; usuarioLocalId?: string | null; nombre: string; segmento: string; texto: string },
  db: BaseDeDatos = dbPorDefecto,
  ahora: Date = new Date(),
): Promise<ResultadoCampana> {
  const texto = datos.texto.trim();
  const validacion = validarCampana(datos, marcadoresDesconocidos(texto));
  if (!validacion.ok) return validacion;
  const segmento = datos.segmento as Segmento;

  const cargado = await cargarLocal(datos.localId, db, ahora);
  if (!cargado) return { ok: false, motivo: 'No se encontró el local' };
  const { local, contexto } = cargado;

  const destinatarios = cargado.clientes.filter((c) => enSegmento(c, segmento, contexto));
  if (destinatarios.length === 0) {
    return { ok: false, motivo: 'Nadie del club entra en ese grupo hoy. Elige otro.' };
  }

  // Todo o nada: una campaña sin sus mensajes, o mensajes a medias, dejaría
  // al dueño sin saber a quién le llegó.
  const campanaId = await db.transaction(async (tx) => {
    const [campana] = await tx
      .insert(campanas)
      .values({
        localId: local.id,
        nombre: datos.nombre.trim(),
        segmento,
        texto,
        destinatarios: destinatarios.length,
        usuarioLocalId: datos.usuarioLocalId ?? null,
      })
      .returning({ id: campanas.id });

    await tx.insert(mensajes).values(
      destinatarios.map((c) => {
        const estado = calcularEstado(c.sellosDisponibles, local.sellosObjetivo);
        return {
          localId: local.id,
          clienteId: c.id,
          tipo: 'campana' as const,
          campanaId: campana.id,
          clave: `campana:${campana.id}`,
          texto: renderizarPlantilla(texto, {
            nombre: c.nombre,
            local: local.nombre,
            sellos: estado.sellos,
            faltan: estado.faltan,
            premio: local.premio,
          }),
          programadoPara: ahora,
        };
      }),
    );

    return campana.id;
  });

  return { ok: true, campanaId, destinatarios: destinatarios.length };
}

export interface CampanaDelPanel {
  id: string;
  nombre: string;
  segmento: string;
  texto: string;
  destinatarios: number;
  enviados: number;
  pendientes: number;
  descartados: number;
  creadoEn: Date;
}

export async function listarCampanas(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<CampanaDelPanel[]> {
  return db
    .select({
      id: campanas.id,
      nombre: campanas.nombre,
      segmento: campanas.segmento,
      texto: campanas.texto,
      destinatarios: campanas.destinatarios,
      enviados: sql<number>`count(${mensajes.id}) filter (where ${mensajes.estado} = 'enviado')::int`,
      pendientes: sql<number>`count(${mensajes.id}) filter (where ${mensajes.estado} = 'pendiente')::int`,
      descartados: sql<number>`count(${mensajes.id}) filter (where ${mensajes.estado} = 'descartado')::int`,
      creadoEn: campanas.creadoEn,
    })
    .from(campanas)
    .leftJoin(mensajes, eq(mensajes.campanaId, campanas.id))
    .where(eq(campanas.localId, localId))
    .groupBy(campanas.id)
    .orderBy(desc(campanas.creadoEn));
}

/**
 * Saca de la bandeja lo que quede sin enviar de una campaña: se lanzó por
 * error o ya pasó la fecha. Lo enviado queda en el historial.
 */
export async function cancelarPendientes(
  localId: string,
  campanaId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<number> {
  const filas = await db
    .update(mensajes)
    .set({ estado: 'descartado' })
    .where(
      and(
        eq(mensajes.localId, localId),
        eq(mensajes.campanaId, campanaId),
        eq(mensajes.estado, 'pendiente'),
        isNull(mensajes.enviadoEn),
      ),
    )
    .returning({ id: mensajes.id });
  return filas.length;
}
