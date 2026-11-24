'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { slugDesde } from '@/dominio/slug';

import { accionCrearLocal, type EstadoCrearLocal } from '../../acciones';
import { BotonCopiar } from '@/app/panel/chips/copiar';

export function FormularioNuevoLocal({ urlPublica }: { urlPublica: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoCrearLocal, FormData>(accionCrearLocal, {});
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);

  if (estado.creado) {
    const { creado } = estado;
    const mensaje =
      `Hola, ya está listo tu club en Sello Fiel.\n` +
      `Entra a ${urlPublica}/panel/entrar\n` +
      `Correo: ${creado.email}\n` +
      `Contraseña temporal: ${creado.clave}\n` +
      `Al entrar te pedirá elegir una tuya.`;

    return (
      <div className="pila">
        <p className="aviso aviso--exito">Local creado.</p>
        <section className="hoja">
          <h2>Datos para el dueño</h2>
          <p className="ayuda">
            La contraseña se muestra <strong>solo esta vez</strong>. Si se pierde, genera otra
            desde la ficha del local.
          </p>
          <p className="fila__cita" style={{ whiteSpace: 'pre-line' }}>{mensaje}</p>
          <BotonCopiar texto={mensaje} />
        </section>
        <Link href={`/admin/locales/${creado.localId}`} className="boton boton--secundario">
          Ir a la ficha del local
        </Link>
      </div>
    );
  }

  return (
    <form action={accion}>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}

      <section className="hoja">
        <h2>El local</h2>
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            name="nombre"
            required
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (!slugTocado) setSlug(slugDesde(e.target.value));
            }}
          />
        </div>
        <div className="campo">
          <label htmlFor="slug">Dirección del club</label>
          <input
            id="slug"
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value);
            }}
          />
          <small>
            {urlPublica}/c/{slug || '...'} — va impresa en los QR: no se puede cambiar después.
          </small>
        </div>
        <div className="campo">
          <label htmlFor="colorPrimario">Color</label>
          <input id="colorPrimario" name="colorPrimario" type="color" defaultValue="#1f2a44" />
        </div>
        <div className="campo">
          <label htmlFor="logoUrl">Logo (opcional)</label>
          <input id="logoUrl" name="logoUrl" type="url" placeholder="https://..." />
        </div>
        <div className="campo">
          <label htmlFor="whatsapp">WhatsApp del local (opcional)</label>
          <input id="whatsapp" name="whatsapp" type="tel" />
        </div>
      </section>

      <section className="hoja">
        <h2>El premio</h2>
        <div className="campo">
          <label htmlFor="sellosObjetivo">Sellos para el premio</label>
          <input id="sellosObjetivo" name="sellosObjetivo" type="number" min={1} max={50} defaultValue={10} required />
        </div>
        <div className="campo">
          <label htmlFor="premio">Qué se gana</label>
          <input id="premio" name="premio" required />
        </div>
      </section>

      <section className="hoja">
        <h2>El dueño</h2>
        <div className="campo">
          <label htmlFor="duenoNombre">Nombre</label>
          <input id="duenoNombre" name="duenoNombre" required />
        </div>
        <div className="campo">
          <label htmlFor="duenoEmail">Correo</label>
          <input id="duenoEmail" name="duenoEmail" type="email" required />
          <small>Con este correo entra a su panel.</small>
        </div>
      </section>

      <section className="hoja">
        <div className="campo casilla">
          <input id="emitePases" name="emitePases" type="checkbox" value="si" />
          <label htmlFor="emitePases">
            Emitir tarjetas de Google Wallet. Déjalo apagado en locales de prueba: lo que se
            crea en Google no se puede borrar.
          </label>
        </div>
      </section>

      <button type="submit" disabled={pendiente}>{pendiente ? 'Creando...' : 'Crear local'}</button>
    </form>
  );
}
