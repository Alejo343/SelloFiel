/**
 * Códigos de un solo uso y alertas de fraude.
 *
 * El diseño es de David: que el código se restablezca en cada lectura. Es la
 * misma idea que el chip NTAG 424 DNA resuelve en hardware —"emite una señal
 * única cada vez que se escanea", dicen los reels— pero en software, para
 * locales que no compren esos chips.
 */

import { randomBytes } from 'node:crypto';

import { and, count, eq, gte, isNull, lt, sql } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { alertasFraude, clientes, codigosSello, sellos, tags } from '../db/schema';
import {
  alertasDeSello,
  MINUTOS_DE_RAFAGA,
  SEGUNDOS_DE_VIDA_CODIGO,
  validarCodigo,
  validarContador,
  type MotivoAlerta,
} from '../dominio/fraude';
import type { BaseDeDatos } from './tipos';

/* ------------------------------------------------- códigos de pantalla */

/** 16 bytes al azar: no se adivina ni se enumera (RNF-06). */
function generarCodigo(): string {
  return randomBytes(16).toString('base64url');
}

export interface CodigoEmitido {
  codigo: string;
  expiraEn: Date;
}

/**
 * Emite un código nuevo para la pantalla del local.
 *
 * No invalida el anterior a propósito: la pantalla refresca antes de que el
 * código venza, y si se invalidara al emitir el siguiente, el cliente que está
 * escaneando en ese instante vería fallar un QR que tiene delante.
 */
export async function emitirCodigo(
  tagId: string,
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
  ahora: Date = new Date(),
): Promise<CodigoEmitido> {
  const codigo = generarCodigo();
  const expiraEn = new Date(ahora.getTime() + SEGUNDOS_DE_VIDA_CODIGO * 1000);

  await db.insert(codigosSello).values({ localId, tagId, codigo, expiraEn });

  return { codigo, expiraEn };
}

export type ResultadoConsumo =
  | { ok: true; tagId: string; localId: string }
  | { ok: false; motivo: 'inexistente' | 'usado' | 'expirado' };

/**
 * Consume un código. Solo el primero en llegar lo logra.
 *
 * El `update ... where usado_en is null` hace el trabajo: es una sola
 * operación atómica en la base, así que dos personas escaneando el mismo QR a
 * la vez no pueden ganar las dos. Comprobar y luego marcar en dos pasos
 * dejaría una ventana para que ambas pasaran.
 */
export async function consumirCodigo(
  codigo: string,
  clienteId: string | null,
  db: BaseDeDatos = dbPorDefecto,
  ahora: Date = new Date(),
): Promise<ResultadoConsumo> {
  const filas = await db
    .update(codigosSello)
    .set({ usadoEn: ahora, usadoPorClienteId: clienteId })
    .where(
      and(
        eq(codigosSello.codigo, codigo),
        isNull(codigosSello.usadoEn),
        gte(codigosSello.expiraEn, ahora),
      ),
    )
    .returning({ tagId: codigosSello.tagId, localId: codigosSello.localId });

  if (filas.length > 0) {
    return { ok: true, tagId: filas[0].tagId, localId: filas[0].localId };
  }

  // No se pudo consumir: se mira por qué, para dar un mensaje útil.
  const existentes = await db
    .select({ usadoEn: codigosSello.usadoEn, expiraEn: codigosSello.expiraEn })
    .from(codigosSello)
    .where(eq(codigosSello.codigo, codigo))
    .limit(1);

  const resultado = validarCodigo(existentes[0] ?? null, ahora);
  if (resultado.valido) {
    // Existía y parecía válido, pero el update no lo tomó: alguien ganó la
    // carrera en el instante entre las dos consultas.
    return { ok: false, motivo: 'usado' };
  }

  return { ok: false, motivo: resultado.motivo };
}

/** Borra los códigos ya vencidos. Los llama el cron, para no acumular. */
export async function limpiarCodigosVencidos(
  db: BaseDeDatos = dbPorDefecto,
  ahora: Date = new Date(),
): Promise<number> {
  // Con el operador de Drizzle y no con SQL crudo: interpolar una fecha en
  // una plantilla pierde el tipo y el controlador la rechaza.
  const borrados = await db
    .delete(codigosSello)
    .where(lt(codigosSello.expiraEn, new Date(ahora.getTime() - 86_400_000)))
    .returning({ id: codigosSello.id });

  return borrados.length;
}

/* ------------------------------------------------- contador del chip */

export type ResultadoChip =
  | { ok: true }
  | { ok: false; motivo: 'contador_repetido' };

/**
 * Valida y avanza el contador de un chip NTAG 424 DNA (RN-04).
 *
 * Si el contador no avanza, alguien está reproduciendo una lectura vieja. Se
 * registra la alerta y se rechaza el sello: este es el único caso en que el
 * antifraude SÍ bloquea, porque no es una sospecha sino una prueba.
 */
export async function validarYAvanzarContador(
  opciones: {
    tagId: string;
    localId: string;
    clienteId: string | null;
    contadorRecibido: number | null | undefined;
  },
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResultadoChip> {
  const [tag] = await db
    .select({ ultimoContador: tags.ultimoContador })
    .from(tags)
    .where(and(eq(tags.id, opciones.tagId), eq(tags.localId, opciones.localId)))
    .limit(1);

  if (!tag) return { ok: true };

  const resultado = validarContador(opciones.contadorRecibido, tag.ultimoContador);
  if (resultado === null) return { ok: true };

  if (!resultado.valido) {
    await registrarAlerta(
      {
        localId: opciones.localId,
        clienteId: opciones.clienteId,
        motivo: 'contador_repetido',
        detalle:
          resultado.motivo === 'repetido'
            ? `El chip envió el contador ${opciones.contadorRecibido}, que ya se había visto.`
            : `El chip envió el contador ${opciones.contadorRecibido}, menor que el último visto (${tag.ultimoContador}).`,
      },
      db,
    );

    return { ok: false, motivo: 'contador_repetido' };
  }

  await db
    .update(tags)
    .set({ ultimoContador: resultado.contador })
    .where(eq(tags.id, opciones.tagId));

  return { ok: true };
}

/* ------------------------------------------------------------ alertas */

export async function registrarAlerta(
  datos: {
    localId: string;
    clienteId?: string | null;
    selloId?: string | null;
    motivo: MotivoAlerta;
    detalle: string;
  },
  db: BaseDeDatos = dbPorDefecto,
): Promise<void> {
  await db.insert(alertasFraude).values({
    localId: datos.localId,
    clienteId: datos.clienteId ?? null,
    selloId: datos.selloId ?? null,
    motivo: datos.motivo,
    detalle: datos.detalle,
  });
}

/**
 * Mira si este sello levanta sospechas y, si las levanta, las registra.
 *
 * RN-09: **avisa, no bloquea**. Un falso positivo que impide sumar un sello
 * delante del cliente hace más daño que el fraude que evitaría.
 */
export async function revisarSello(
  opciones: {
    localId: string;
    clienteId: string;
    /** El sello concreto, si se conoce. Las alertas sirven igual sin él. */
    selloId?: string | null;
    horaLocal: number;
    ahora?: Date;
  },
  db: BaseDeDatos = dbPorDefecto,
): Promise<number> {
  const ahora = opciones.ahora ?? new Date();
  const desde = new Date(ahora.getTime() - MINUTOS_DE_RAFAGA * 60_000);

  const [[sellosRecientes], [altasRecientes]] = await Promise.all([
    db
      .select({ n: count() })
      .from(sellos)
      .where(and(eq(sellos.localId, opciones.localId), gte(sellos.creadoEn, desde))),
    db
      .select({ n: count() })
      .from(clientes)
      .where(and(eq(clientes.localId, opciones.localId), gte(clientes.creadoEn, desde))),
  ]);

  const alertas = alertasDeSello({
    sellosRecientes: sellosRecientes.n,
    altasRecientes: altasRecientes.n,
    horaLocal: opciones.horaLocal,
  });

  for (const alerta of alertas) {
    await registrarAlerta(
      {
        localId: opciones.localId,
        clienteId: opciones.clienteId,
        selloId: opciones.selloId,
        motivo: alerta.motivo,
        detalle: alerta.detalle,
      },
      db,
    );
  }

  return alertas.length;
}

/** Las alertas que el local todavía no revisó (RF-29). */
export async function alertasSinRevisar(localId: string, db: BaseDeDatos = dbPorDefecto) {
  return db
    .select({
      id: alertasFraude.id,
      motivo: alertasFraude.motivo,
      detalle: alertasFraude.detalle,
      creadoEn: alertasFraude.creadoEn,
      clienteId: alertasFraude.clienteId,
      clienteNombre: clientes.nombre,
    })
    .from(alertasFraude)
    .leftJoin(clientes, eq(alertasFraude.clienteId, clientes.id))
    .where(and(eq(alertasFraude.localId, localId), eq(alertasFraude.estado, 'nueva')))
    .orderBy(sql`${alertasFraude.creadoEn} desc`)
    .limit(100);
}

export async function marcarAlerta(
  localId: string,
  alertaId: string,
  estado: 'revisada' | 'descartada',
  db: BaseDeDatos = dbPorDefecto,
): Promise<boolean> {
  const filas = await db
    .update(alertasFraude)
    .set({ estado })
    .where(and(eq(alertasFraude.id, alertaId), eq(alertasFraude.localId, localId)))
    .returning({ id: alertasFraude.id });

  return filas.length > 0;
}

export async function contarAlertas(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<number> {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(alertasFraude)
    .where(and(eq(alertasFraude.localId, localId), eq(alertasFraude.estado, 'nueva')));

  return fila?.n ?? 0;
}
