/**
 * Los mensajes que hacen volver al cliente.
 *
 * Esta es la parte del producto que de verdad se le vende al local. En los
 * reels la frase era: "la herramienta, además de guardar a los clientes que
 * pasan por el local, les escribe para que vuelvan".
 *
 * Todo lo de aquí es puro: arma textos y enlaces, no decide a quién escribir
 * (eso está en `inactividad.ts`) ni envía nada (eso es de la Fase 9, cuando
 * entre la API de WhatsApp; por ahora el local hace clic en un enlace).
 */

import type { Dia } from './fechas';
import type { Telefono } from './telefono';

export type TipoMensaje =
  | 'bienvenida'
  | 'cumpleanos'
  | 'inactividad'
  | 'post_visita'
  | 'evento'
  | 'campana';

/* ----------------------------------------------------------- plantillas */

/** Lo que el local puede meter entre llaves en su plantilla. */
export const MARCADORES = {
  nombre: 'El nombre del cliente',
  local: 'El nombre del local',
  sellos: 'Cuántos sellos tiene',
  faltan: 'Cuántos le faltan para el premio',
  premio: 'Qué se gana',
} as const;

export type Marcador = keyof typeof MARCADORES;

export interface DatosPlantilla {
  nombre: string;
  local: string;
  sellos: number;
  faltan: number;
  premio: string;
  /** Solo para post_visita: el enlace donde el cliente califica */
  enlaceOpinion?: string;
}

/**
 * Reemplaza los marcadores de una plantilla.
 *
 * Un marcador desconocido se deja tal cual, en vez de borrarse: si el local
 * escribe `{nombe}` por error, prefiere ver el error en el mensaje antes de
 * enviarlo que mandar una frase con un hueco silencioso.
 */
export function renderizarPlantilla(texto: string, datos: DatosPlantilla): string {
  return texto.replace(/\{(\w+)\}/g, (original, clave: string) => {
    switch (clave) {
      case 'nombre':
        return datos.nombre;
      case 'local':
        return datos.local;
      case 'sellos':
        return String(datos.sellos);
      case 'faltan':
        return String(datos.faltan);
      case 'premio':
        return datos.premio;
      case 'enlace':
        return datos.enlaceOpinion ?? '';
      default:
        return original;
    }
  });
}

/** Marcadores usados en un texto que no existen. Para avisar en el panel. */
export function marcadoresDesconocidos(texto: string): string[] {
  const validos = new Set([...Object.keys(MARCADORES), 'enlace']);
  const usados = [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(usados.filter((u) => !validos.has(u)))];
}

/**
 * Textos de partida para un local nuevo.
 *
 * Están escritos en el tono de los reels: cortos, de tú, y con una razón
 * concreta para volver. Un mensaje largo se lee como publicidad y se ignora.
 */
export const PLANTILLAS_POR_DEFECTO: Record<TipoMensaje, string> = {
  bienvenida: '¡Bienvenido al club de {local}, {nombre}! Ya tienes {sellos} sello. Con {faltan} más te ganas: {premio}.',
  cumpleanos: '¡Feliz cumpleaños, {nombre}! En {local} te queremos celebrar. Pásate esta semana y te tenemos algo.',
  inactividad: '{nombre}, hace rato no te vemos por {local}. Tienes {sellos} sellos guardados, te faltan {faltan} para {premio}. Te esperamos.',
  post_visita: '{nombre}, gracias por venir a {local}. ¿Cómo estuvo todo? Cuéntanos acá: {enlace}',
  evento: '{nombre}, en {local} tenemos algo especial esta semana. ¡Te esperamos!',
  campana: '{nombre}, en {local} tenemos una promoción que te va a gustar.',
};

/* ------------------------------------------------------ enlace WhatsApp */

/**
 * El enlace que abre WhatsApp con el mensaje ya escrito (RF-26).
 *
 * El local hace clic y WhatsApp se abre con el texto listo; solo tiene que
 * darle a enviar. No escala a cientos de locales —para eso está la API, en la
 * Fase 9— pero sirve para validar que los mensajes funcionan sin pagar ni
 * pedirle a Meta que apruebe plantillas.
 */
export function enlaceWhatsApp(telefono: Telefono, texto: string): string {
  // wa.me exige el número en formato internacional y solo dígitos. Si llegara
  // con signos, WhatsApp abre un chat vacío sin decir por qué.
  const digitos = telefono.replace(/\D/g, '');
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

/* --------------------------------------------------- claves de ocasión */

/**
 * La clave que impide duplicar un mensaje.
 *
 * Hace falta porque el trabajo diario corre todos los días y la ventana de
 * cumpleaños dura una semana: sin clave, el cliente recibiría siete
 * felicitaciones. Cada tipo define cuál es su "ocasión".
 */
export function claveDeOcasion(
  tipo: TipoMensaje,
  contexto: { hoy: Dia; ultimoSello?: Dia | null; diaDeLaVisita?: Dia },
): string {
  switch (tipo) {
    case 'bienvenida':
      // Uno en la vida del cliente.
      return 'bienvenida';

    case 'cumpleanos':
      // Uno por año. Se usa el año de hoy, no el de nacimiento.
      return `cumpleanos:${contexto.hoy.slice(0, 4)}`;

    case 'inactividad':
      // Uno por racha de ausencia: si vuelve y se vuelve a ir, el último
      // sello cambia y por tanto la clave, así que recibe otro.
      return `inactividad:${contexto.ultimoSello ?? 'nunca'}`;

    case 'post_visita':
      // Uno por visita.
      return `post_visita:${contexto.diaDeLaVisita ?? contexto.hoy}`;

    default:
      // Eventos y campañas los dispara el local a mano, cuando quiere.
      return `${tipo}:${contexto.hoy}`;
  }
}

/* ------------------------------------------------- texto para el panel */

/** Por qué aparece este mensaje en la bandeja, en una frase. */
export function motivoLegible(tipo: TipoMensaje, contexto: { faltan?: number } = {}): string {
  switch (tipo) {
    case 'bienvenida':
      return 'Se acaba de unir al club';
    case 'cumpleanos':
      return 'Está de cumpleaños';
    case 'inactividad':
      return 'Hace tiempo que no viene';
    case 'post_visita':
      return 'Vino hoy: pregúntale cómo estuvo';
    case 'evento':
      return 'Invitación a un evento';
    case 'campana':
      return contexto.faltan === 0 ? 'Tiene premio disponible' : 'Campaña';
  }
}
