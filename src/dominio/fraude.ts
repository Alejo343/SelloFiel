/**
 * Defensas contra sellos falsos.
 *
 * El problema, detectado por David el 2026-11-13: un QR impreso es una URL
 * fija. El cliente la fotografía y suma un sello diario desde su casa. Un chip
 * NTAG213 tiene exactamente el mismo problema, aunque sea NFC, porque también
 * guarda una URL fija.
 *
 * Y el daño mayor no es el café regalado: son los sellos falsos ensuciando la
 * tasa de retorno, que es justo el número que se le vende al local. Un dueño
 * creyendo que la gente vuelve cuando no vuelve está peor que sin sistema.
 *
 * Tres capas, como las que describen los reels:
 *  1. El mecanismo no se puede copiar (tipo de tag + códigos de un solo uso).
 *  2. Un sello por día por cliente.
 *  3. Alertas al local cuando algo huele raro. **Avisan, no bloquean** (RN-09).
 */

import { diasEntre, type Dia } from './fechas';

export type TipoTag = 'nfc' | 'qr_impreso' | 'pantalla';

/* ------------------------------------------- qué puede hacer cada tag */

export type CapacidadTag = 'solo_unirse' | 'suma_sellos';

/**
 * RN-10: un QR impreso NO suma sellos.
 *
 * Es la regla más importante de esta fase y la más fácil de romper por
 * descuido, porque técnicamente "funcionaría". Por eso vive aquí, en una
 * función que se puede probar, y no en un `if` perdido dentro de una pantalla.
 */
export function capacidadDe(tipo: TipoTag): CapacidadTag {
  return tipo === 'qr_impreso' ? 'solo_unirse' : 'suma_sellos';
}

export function puedeSumarSellos(tipo: TipoTag): boolean {
  return capacidadDe(tipo) === 'suma_sellos';
}

/* --------------------------------------- contador del chip (NTAG 424) */

export type ResultadoContador =
  | { valido: true; contador: number }
  | { valido: false; motivo: 'repetido' | 'retrocede' };

/**
 * RN-04. El NTAG 424 DNA incluye un contador de lecturas que sube en cada
 * toque. Si llega uno repetido o menor que el último visto, alguien está
 * reproduciendo una lectura antigua.
 *
 * Sin esta comprobación el chip caro no sirve de nada: su ventaja es
 * justamente que el servidor pueda rechazar repeticiones.
 */
export function validarContador(
  contadorRecibido: number | null | undefined,
  ultimoVisto: number | null | undefined,
): ResultadoContador | null {
  // El tag no manda contador (QR o chip simple): no hay nada que validar.
  if (contadorRecibido === null || contadorRecibido === undefined) return null;

  if (ultimoVisto === null || ultimoVisto === undefined) {
    return { valido: true, contador: contadorRecibido };
  }

  if (contadorRecibido === ultimoVisto) return { valido: false, motivo: 'repetido' };
  if (contadorRecibido < ultimoVisto) return { valido: false, motivo: 'retrocede' };

  return { valido: true, contador: contadorRecibido };
}

/* ------------------------------------------------------------ alertas */

export type MotivoAlerta =
  | 'contador_repetido'
  | 'rafaga_de_sellos'
  | 'altas_en_rafaga'
  | 'horario_improbable';

export interface Alerta {
  motivo: MotivoAlerta;
  detalle: string;
}

/** Cuántos sellos seguidos en pocos minutos resultan sospechosos. */
export const SELLOS_EN_RAFAGA = 8;
export const MINUTOS_DE_RAFAGA = 5;

/** Horas en que un local gastronómico casi nunca suma sellos. */
export const HORA_IMPROBABLE_DESDE = 3;
export const HORA_IMPROBABLE_HASTA = 6;

export interface ContextoAlertas {
  /** Sellos del local en los últimos `MINUTOS_DE_RAFAGA` minutos */
  sellosRecientes: number;
  /** Clientes nuevos del local en los últimos `MINUTOS_DE_RAFAGA` minutos */
  altasRecientes: number;
  /** Hora local del sello, 0 a 23 */
  horaLocal: number;
}

/**
 * Qué conviene que el local revise. Nunca bloquea: un falso positivo que
 * impide sumar un sello delante del cliente es peor que el fraude que evita.
 */
export function alertasDeSello(contexto: ContextoAlertas): Alerta[] {
  const alertas: Alerta[] = [];

  if (contexto.sellosRecientes >= SELLOS_EN_RAFAGA) {
    alertas.push({
      motivo: 'rafaga_de_sellos',
      detalle: `${contexto.sellosRecientes} sellos en ${MINUTOS_DE_RAFAGA} minutos. Puede ser una fila real, o alguien sumando de más.`,
    });
  }

  if (contexto.altasRecientes >= SELLOS_EN_RAFAGA) {
    alertas.push({
      motivo: 'altas_en_rafaga',
      detalle: `${contexto.altasRecientes} clientes nuevos en ${MINUTOS_DE_RAFAGA} minutos.`,
    });
  }

  if (contexto.horaLocal >= HORA_IMPROBABLE_DESDE && contexto.horaLocal < HORA_IMPROBABLE_HASTA) {
    alertas.push({
      motivo: 'horario_improbable',
      detalle: `Un sello a las ${String(contexto.horaLocal).padStart(2, '0')}:00, cuando el local suele estar cerrado.`,
    });
  }

  return alertas;
}

/** Texto para el panel: qué pasó y qué mirar. */
export function explicarAlerta(motivo: MotivoAlerta): string {
  switch (motivo) {
    case 'contador_repetido':
      return 'Alguien repitió una lectura antigua del chip. Es la señal más clara de copia: revisa quién fue y si el chip sigue en su sitio.';
    case 'rafaga_de_sellos':
      return 'Muchos sellos en pocos minutos. Puede ser una fila normal a la hora pico, o alguien pasando el chip varias veces.';
    case 'altas_en_rafaga':
      return 'Muchos clientes nuevos de golpe. Normal si repartiste el QR en un evento; raro un martes cualquiera.';
    case 'horario_improbable':
      return 'Un sello a una hora en que el local suele estar cerrado.';
  }
}

/* ----------------------------------------- códigos de un solo uso */

export type ResultadoCodigo =
  | { valido: true }
  | { valido: false; motivo: 'inexistente' | 'usado' | 'expirado' };

/**
 * RN-11. La idea es de David: que el código se restablezca en cada lectura.
 *
 * Pero un solo uso no basta por sí solo. Si el cliente fotografía el código y
 * nadie más lo usa, ese código sigue vivo y le sirve esa noche desde su casa.
 * Un solo uso impide *reutilizar*; la caducidad impide *usar más tarde*. Hacen
 * falta las dos.
 */
export function validarCodigo(
  codigo: { usadoEn: Date | null; expiraEn: Date } | null,
  ahora: Date,
): ResultadoCodigo {
  if (!codigo) return { valido: false, motivo: 'inexistente' };
  if (codigo.usadoEn !== null) return { valido: false, motivo: 'usado' };
  if (codigo.expiraEn.getTime() <= ahora.getTime()) {
    return { valido: false, motivo: 'expirado' };
  }
  return { valido: true };
}

/** Cuánto vive un código de pantalla. */
export const SEGUNDOS_DE_VIDA_CODIGO = 45;

/** Cada cuánto la pantalla pide uno nuevo. Menor que la vida, para solapar. */
export const SEGUNDOS_DE_REFRESCO = 30;

export function mensajeCodigoInvalido(motivo: 'inexistente' | 'usado' | 'expirado'): string {
  switch (motivo) {
    case 'usado':
      return 'Ese código ya se usó. Pídele al personal que muestre el código otra vez.';
    case 'expirado':
      return 'Ese código ya venció. Los códigos cambian cada pocos segundos: escanea el que esté en pantalla ahora.';
    case 'inexistente':
      return 'Ese código no es válido. Pídele ayuda al personal del local.';
  }
}

/* ------------------------------------------------- inactividad de días */

/** Días sin que un cliente aparezca, para el detalle de las alertas. */
export function diasDesde(dia: Dia, hoy: Dia): number {
  return diasEntre(dia, hoy);
}
