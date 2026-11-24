/**
 * A quién va una campaña (RF-31).
 *
 * "Día de la milanesa" no se le manda igual a todos: al que viene cada semana
 * le sobra, y al que se perdió hace tres meses le da una razón para volver.
 * Los segmentos permiten elegir.
 *
 * Funciones puras sobre datos ya calculados: se prueban sin base de datos.
 */

import { diasEntre, type Dia } from './fechas';
import { estaInactivo, type ReglasDelPrograma } from './inactividad';

export type Segmento = 'todos' | 'frecuentes' | 'inactivos' | 'con_premio' | 'cumplen_este_mes';

export const SEGMENTOS: Record<Segmento, { nombre: string; descripcion: string }> = {
  todos: { nombre: 'Todos', descripcion: 'Todo el club' },
  frecuentes: {
    nombre: 'Los que vienen seguido',
    descripcion: 'Vinieron en los últimos 30 días',
  },
  inactivos: {
    nombre: 'Los que se perdieron',
    descripcion: 'Hace tiempo que no vienen, según tu configuración',
  },
  con_premio: {
    nombre: 'Con premio sin reclamar',
    descripcion: 'Ya juntaron los sellos y no han canjeado',
  },
  cumplen_este_mes: { nombre: 'Cumplen este mes', descripcion: 'Su cumpleaños cae este mes' },
};

export interface ClienteSegmentable {
  ultimoSello: Dia | null;
  fechaNacimiento: Dia | null;
  sellosDisponibles: number;
  dadoDeBaja: boolean;
}

export const DIAS_FRECUENTE = 30;

/**
 * Si el cliente entra en el segmento.
 *
 * RN-08: quien pidió la baja NUNCA entra, en ningún segmento, ni siquiera en
 * "todos". Es la regla que no se puede romper con una campaña.
 */
export function enSegmento(
  cliente: ClienteSegmentable,
  segmento: Segmento,
  contexto: { hoy: Dia; sellosObjetivo: number; reglas: ReglasDelPrograma },
): boolean {
  if (cliente.dadoDeBaja) return false;

  switch (segmento) {
    case 'todos':
      return true;
    case 'frecuentes':
      return cliente.ultimoSello !== null && diasEntre(cliente.ultimoSello, contexto.hoy) <= DIAS_FRECUENTE;
    case 'inactivos':
      return estaInactivo(
        { ultimoSello: cliente.ultimoSello, fechaNacimiento: cliente.fechaNacimiento, dadoDeBaja: false },
        contexto.hoy,
        contexto.reglas,
      );
    case 'con_premio':
      return cliente.sellosDisponibles >= contexto.sellosObjetivo;
    case 'cumplen_este_mes':
      return cliente.fechaNacimiento !== null && cliente.fechaNacimiento.slice(5, 7) === contexto.hoy.slice(5, 7);
  }
}

export function esSegmento(valor: unknown): valor is Segmento {
  return typeof valor === 'string' && Object.hasOwn(SEGMENTOS, valor);
}

export const LARGO_MAXIMO_TEXTO = 700;

/**
 * Lo que tiene que cumplir una campaña antes de llenar la bandeja.
 *
 * El texto se revisa con el mismo cuidado que las plantillas: un `{nombe}`
 * mal escrito saldría tal cual en cientos de WhatsApp. `{enlace}` no vale
 * acá: solo existe para la pregunta de después de la visita.
 */
export function validarCampana(
  datos: { nombre: string; texto: string; segmento: string },
  marcadoresMalos: string[],
): { ok: true } | { ok: false; motivo: string } {
  if (!datos.nombre.trim()) return { ok: false, motivo: 'Ponle un nombre a la campaña, para reconocerla después' };
  if (datos.nombre.trim().length > 80) return { ok: false, motivo: 'El nombre es muy largo (máximo 80 caracteres)' };
  if (!esSegmento(datos.segmento)) return { ok: false, motivo: 'Elige a quién va la campaña' };
  if (!datos.texto.trim()) return { ok: false, motivo: 'Escribe el mensaje' };
  if (datos.texto.trim().length > LARGO_MAXIMO_TEXTO) {
    return { ok: false, motivo: `El mensaje es muy largo (máximo ${LARGO_MAXIMO_TEXTO} caracteres)` };
  }
  const malos = [...marcadoresMalos, ...(datos.texto.includes('{enlace}') ? ['enlace'] : [])];
  if (malos.length > 0) {
    return {
      ok: false,
      motivo: `El mensaje tiene marcadores que no existen: ${malos.map((m) => `{${m}}`).join(', ')}`,
    };
  }
  return { ok: true };
}
