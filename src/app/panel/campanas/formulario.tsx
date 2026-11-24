'use client';

import { useActionState, useState } from 'react';

import { MARCADORES } from '@/dominio/mensajes';
import { LARGO_MAXIMO_TEXTO, SEGMENTOS, type Segmento } from '@/dominio/segmentos';

import { accionCrearCampana, type EstadoCampana } from './acciones';

export function FormularioCampana({ conteo }: { conteo: Record<Segmento, number> }) {
  const [estado, accion, pendiente] = useActionState<EstadoCampana, FormData>(accionCrearCampana, {});
  const [segmento, setSegmento] = useState<Segmento>('todos');
  const [nombre, setNombre] = useState('');
  const [texto, setTexto] = useState('{nombre}, ');
  const cuantos = conteo[segmento];

  return (
    <form action={accion} className="hoja">
      <h2>Nueva campaña</h2>
      {estado.error && (
        <p className="error" role="alert">
          {estado.error}
        </p>
      )}

      <div className="campo">
        <label htmlFor="nombre">Nombre (solo lo ves tú)</label>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={80}
          placeholder="Día de la milanesa"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      <fieldset className="campo">
        <legend>¿A quién?</legend>
        {(Object.keys(SEGMENTOS) as Segmento[]).map((s) => (
          <div className="campo casilla" key={s}>
            <input
              type="radio"
              id={`segmento-${s}`}
              name="segmento"
              value={s}
              checked={segmento === s}
              onChange={() => setSegmento(s)}
              disabled={conteo[s] === 0}
            />
            <label htmlFor={`segmento-${s}`}>
              {SEGMENTOS[s].nombre} ({conteo[s]})
              <br />
              <small>{SEGMENTOS[s].descripcion}</small>
            </label>
          </div>
        ))}
        <small>Quien pidió no recibir mensajes nunca entra, en ningún grupo.</small>
      </fieldset>

      <div className="campo">
        <label htmlFor="texto">Mensaje</label>
        <textarea
          id="texto"
          name="texto"
          rows={4}
          required
          maxLength={LARGO_MAXIMO_TEXTO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <small>
          Puedes usar{' '}
          {Object.keys(MARCADORES).map((m, i) => (
            <span key={m}>
              {i > 0 && ', '}
              <code>{`{${m}}`}</code>
            </span>
          ))}
          . Corto y con una razón concreta para venir funciona mejor.
        </small>
      </div>

      <p className="ayuda">
        Se crearán <strong>{cuantos}</strong> {cuantos === 1 ? 'mensaje' : 'mensajes'} en tu bandeja, listos
        para enviar por WhatsApp.
      </p>
      <button type="submit" disabled={pendiente || cuantos === 0}>
        {pendiente ? 'Creando…' : 'Crear campaña'}
      </button>
    </form>
  );
}
