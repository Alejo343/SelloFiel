/**
 * Lo que responde el cliente cuando se le pregunta cómo estuvo su visita.
 *
 * El valor del producto está en la bifurcación (RF-28): si estuvo bien, se le
 * lleva a dejar la reseña en Google Maps; si estuvo mal, la queja llega al
 * dueño y NO a Google. En los reels: "está bueno las quejas, porque las quejas
 * no llevan al cliente, nos llevan a nosotros directamente".
 */

import { and, desc, eq, isNull } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { clientes, locales, opiniones, sellos } from '../db/schema';
import type { BaseDeDatos } from './tipos';

export interface VisitaParaOpinar {
  selloId: string;
  clienteId: string;
  clienteNombre: string;
  localNombre: string;
  googleMapsUrl: string | null;
  logoUrl: string | null;
  colorPrimario: string;
  /** Si el cliente ya opinó sobre esta visita */
  yaOpino: boolean;
}

/**
 * Resuelve el enlace `/c/[slug]/opinion/[selloId]`.
 *
 * El identificador del sello es la credencial: es un UUID aleatorio que solo
 * conoce quien recibió el mensaje. Devuelve null si no existe o si no es de
 * este local, sin decir cuál de las dos cosas.
 */
export async function visitaParaOpinar(
  localSlug: string,
  selloId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<VisitaParaOpinar | null> {
  const filas = await db
    .select({
      selloId: sellos.id,
      clienteId: clientes.id,
      clienteNombre: clientes.nombre,
      localNombre: locales.nombre,
      googleMapsUrl: locales.googleMapsUrl,
      logoUrl: locales.logoUrl,
      colorPrimario: locales.colorPrimario,
    })
    .from(sellos)
    .innerJoin(clientes, eq(sellos.clienteId, clientes.id))
    .innerJoin(locales, eq(sellos.localId, locales.id))
    .where(and(eq(sellos.id, selloId), eq(locales.slug, localSlug)))
    .limit(1);

  const visita = filas[0];
  if (!visita) return null;

  const previas = await db
    .select({ id: opiniones.id })
    .from(opiniones)
    .where(eq(opiniones.selloId, selloId))
    .limit(1);

  return { ...visita, yaOpino: previas.length > 0 };
}

/** Guarda la opinión. Es idempotente: el enlace se puede abrir varias veces. */
export async function registrarOpinion(
  datos: {
    localSlug: string;
    selloId: string;
    calificacion: 'buena' | 'mala';
    comentario?: string | null;
  },
  db: BaseDeDatos = dbPorDefecto,
): Promise<{ ok: boolean; googleMapsUrl: string | null }> {
  const visita = await visitaParaOpinar(datos.localSlug, datos.selloId, db);
  if (!visita) return { ok: false, googleMapsUrl: null };

  const [fila] = await db
    .select({ localId: sellos.localId })
    .from(sellos)
    .where(eq(sellos.id, datos.selloId))
    .limit(1);

  await db
    .insert(opiniones)
    .values({
      localId: fila.localId,
      clienteId: visita.clienteId,
      selloId: datos.selloId,
      calificacion: datos.calificacion,
      comentario: datos.comentario?.trim() || null,
    })
    .onConflictDoUpdate({
      target: [opiniones.clienteId, opiniones.selloId],
      set: {
        calificacion: datos.calificacion,
        comentario: datos.comentario?.trim() || null,
      },
    });

  return { ok: true, googleMapsUrl: visita.googleMapsUrl };
}

/** Las quejas que el dueño todavía no ha revisado (RF-28). */
export async function quejasSinRevisar(localId: string, db: BaseDeDatos = dbPorDefecto) {
  return db
    .select({
      id: opiniones.id,
      comentario: opiniones.comentario,
      creadoEn: opiniones.creadoEn,
      clienteId: clientes.id,
      clienteNombre: clientes.nombre,
      telefono: clientes.telefono,
    })
    .from(opiniones)
    .innerJoin(clientes, eq(opiniones.clienteId, clientes.id))
    .where(
      and(
        eq(opiniones.localId, localId),
        eq(opiniones.calificacion, 'mala'),
        isNull(opiniones.revisadaEn),
      ),
    )
    .orderBy(desc(opiniones.creadoEn));
}

export async function marcarQuejaRevisada(
  localId: string,
  opinionId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<boolean> {
  const filas = await db
    .update(opiniones)
    .set({ revisadaEn: new Date() })
    .where(and(eq(opiniones.id, opinionId), eq(opiniones.localId, localId)))
    .returning({ id: opiniones.id });

  return filas.length > 0;
}

/** Resumen para la portada del panel. */
export async function resumenOpiniones(localId: string, db: BaseDeDatos = dbPorDefecto) {
  const filas = await db
    .select({ calificacion: opiniones.calificacion })
    .from(opiniones)
    .where(eq(opiniones.localId, localId));

  return {
    buenas: filas.filter((f) => f.calificacion === 'buena').length,
    malas: filas.filter((f) => f.calificacion === 'mala').length,
  };
}
