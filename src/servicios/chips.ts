/**
 * Gestión de los tags del local desde el panel (RF-30): chips NFC, QR impresos
 * y pantallas de caja.
 *
 * Antes de esto, dar de alta un chip exigía tocar la base a mano. Ahora el
 * dueño lo registra, copia la dirección, la graba con una app como NFC Tools
 * y lo da de baja si se pierde.
 */

import { randomBytes } from 'node:crypto';

import { and, desc, eq, max } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { esViolacionUnica } from '../db/errores';
import { sellos, tags } from '../db/schema';
import type { TipoTag } from '../dominio/fraude';
import type { BaseDeDatos } from './tipos';

/**
 * Token de la dirección que se graba en el chip.
 *
 * Aleatorio y largo a propósito (RNF-06). Los de la semilla, como
 * "tag-esquina-caja", se adivinan; uno así permitiría a cualquiera fabricar la
 * dirección de un chip ajeno sin haberlo tocado nunca.
 *
 * 12 bytes dan 16 caracteres: imposible de adivinar y cabe holgado en un
 * NTAG213, el chip más chico que se usa.
 */
export function generarToken(): string {
  return randomBytes(12).toString('base64url');
}

export interface ChipDelPanel {
  id: string;
  token: string;
  objeto: string | null;
  tipo: TipoTag;
  activo: boolean;
  ultimoContador: number | null;
  /** Último sello sumado con este tag. Null si nunca se usó. */
  ultimoUso: Date | null;
  creadoEn: Date;
}

export async function listarChips(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ChipDelPanel[]> {
  const usos = db
    .select({ tagId: sellos.tagId, ultimoUso: max(sellos.creadoEn).as('ultimo_uso') })
    .from(sellos)
    .where(eq(sellos.localId, localId))
    .groupBy(sellos.tagId)
    .as('usos');

  const filas = await db
    .select({
      id: tags.id,
      token: tags.token,
      objeto: tags.objeto,
      tipo: tags.tipo,
      activo: tags.activo,
      ultimoContador: tags.ultimoContador,
      ultimoUso: usos.ultimoUso,
      creadoEn: tags.creadoEn,
    })
    .from(tags)
    .leftJoin(usos, eq(usos.tagId, tags.id))
    .where(eq(tags.localId, localId))
    .orderBy(desc(tags.activo), desc(tags.creadoEn));

  return filas.map((f) => ({ ...f, ultimoUso: f.ultimoUso ? new Date(f.ultimoUso) : null }));
}

export async function obtenerChip(
  localId: string,
  chipId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ChipDelPanel | null> {
  const todos = await listarChips(localId, db);
  return todos.find((c) => c.id === chipId) ?? null;
}

export async function crearChip(
  datos: { localId: string; objeto: string; tipo: TipoTag },
  db: BaseDeDatos = dbPorDefecto,
): Promise<{ id: string; token: string }> {
  // El token es único en toda la tabla. Una colisión con 96 bits al azar es
  // prácticamente imposible, pero si pasara se reintenta en vez de fallar.
  for (let intento = 0; intento < 3; intento += 1) {
    try {
      const [fila] = await db
        .insert(tags)
        .values({
          localId: datos.localId,
          objeto: datos.objeto.trim(),
          tipo: datos.tipo,
          token: generarToken(),
        })
        .returning({ id: tags.id, token: tags.token });
      return fila;
    } catch (error) {
      if (!esViolacionUnica(error)) throw error;
    }
  }
  throw new Error('No se pudo generar un identificador único para el chip');
}

/**
 * Activa o desactiva un tag. Desactivado, deja de sumar al instante: es lo
 * que se hace con un chip perdido o robado. No se borra, para conservar el
 * historial de los sellos que se sumaron con él.
 */
export async function cambiarEstadoChip(
  localId: string,
  chipId: string,
  activo: boolean,
  db: BaseDeDatos = dbPorDefecto,
): Promise<boolean> {
  const filas = await db
    .update(tags)
    .set({ activo })
    .where(and(eq(tags.id, chipId), eq(tags.localId, localId)))
    .returning({ id: tags.id });
  return filas.length > 0;
}

export async function renombrarChip(
  localId: string,
  chipId: string,
  objeto: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<boolean> {
  const filas = await db
    .update(tags)
    .set({ objeto: objeto.trim() })
    .where(and(eq(tags.id, chipId), eq(tags.localId, localId)))
    .returning({ id: tags.id });
  return filas.length > 0;
}

/** La dirección que hay que grabar en el chip o imprimir en el QR. */
export function direccionDelChip(token: string): string {
  const base = process.env.URL_PUBLICA ?? 'http://localhost:3011';
  return `${base}/t/${token}`;
}
