/**
 * Los textos de los mensajes: /panel/plantillas (RF-25)
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MARCADORES, type TipoMensaje } from '@/dominio/mensajes';
import { exigirSesion } from '@/lib/cookies-panel';
import { plantillasDelLocal } from '@/servicios/mensajes';
import { obtenerLocalDelPanel } from '@/servicios/panel';

import { accionGuardarPlantillas } from './acciones';

const CAMPOS: Array<{ tipo: TipoMensaje; titulo: string; ayuda: string }> = [
  {
    tipo: 'bienvenida',
    titulo: 'Cuando alguien se une al club',
    ayuda: 'El primer mensaje. Sirve para confirmarle que quedó dentro.',
  },
  {
    tipo: 'cumpleanos',
    titulo: 'Por su cumpleaños',
    ayuda: 'Se manda unos días antes, para que le dé tiempo de hacer planes.',
  },
  {
    tipo: 'inactividad',
    titulo: 'Cuando hace rato que no viene',
    ayuda: 'El que más clientes recupera. Dale una razón concreta para volver.',
  },
  {
    tipo: 'post_visita',
    titulo: 'Unas horas después de su visita',
    ayuda: 'Tiene que incluir {enlace}: es donde el cliente dice si estuvo bien o mal.',
  },
];

export default async function PaginaPlantillas({ searchParams }: PageProps<'/panel/plantillas'>) {
  const sesion = await exigirSesion();
  const { guardado, error } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const textos = await plantillasDelLocal(sesion.localId);

  return (
    <main>
      <p>
        <Link href="/panel/mensajes">← Volver a los mensajes</Link>
      </p>

      <h1>Textos de los mensajes</h1>

      {guardado && <p>Textos guardados.</p>}
      {typeof error === 'string' && <p className="error">{error}</p>}

      <p>
        Puedes usar estos marcadores, que se reemplazan por los datos de cada cliente:
      </p>
      <ul>
        {Object.entries(MARCADORES).map(([clave, descripcion]) => (
          <li key={clave}>
            <code>{`{${clave}}`}</code> — {descripcion}
          </li>
        ))}
      </ul>

      <form action={accionGuardarPlantillas}>
        {CAMPOS.map((campo) => (
          <div className="campo" key={campo.tipo}>
            <label htmlFor={campo.tipo}>{campo.titulo}</label>
            <textarea id={campo.tipo} name={campo.tipo} rows={3} defaultValue={textos[campo.tipo]} />
            <small>{campo.ayuda}</small>
          </div>
        ))}

        <button type="submit">Guardar textos</button>
      </form>
    </main>
  );
}

export const metadata = { title: 'Textos de los mensajes · Sello Fiel' };
export const dynamic = 'force-dynamic';
