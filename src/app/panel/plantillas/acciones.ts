'use server';

import { redirect } from 'next/navigation';

import { marcadoresDesconocidos, type TipoMensaje } from '@/dominio/mensajes';
import { exigirSesion } from '@/lib/cookies-panel';
import { guardarPlantilla } from '@/servicios/mensajes';

const TIPOS: TipoMensaje[] = ['bienvenida', 'cumpleanos', 'inactividad', 'post_visita'];

export async function accionGuardarPlantillas(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();

  for (const tipo of TIPOS) {
    const texto = String(datos.get(tipo) ?? '').trim();
    if (!texto) continue;

    // Un marcador mal escrito saldría tal cual en el WhatsApp del cliente.
    // Mejor avisar antes de guardar que mandar "Hola {nombe}".
    const malos = marcadoresDesconocidos(texto);
    if (malos.length > 0) {
      redirect(
        `/panel/plantillas?error=${encodeURIComponent(
          `En "${tipo}" hay marcadores que no existen: ${malos.map((m) => `{${m}}`).join(', ')}`,
        )}`,
      );
    }

    if (tipo === 'post_visita' && !texto.includes('{enlace}')) {
      redirect(
        '/panel/plantillas?error=' +
          encodeURIComponent(
            'El mensaje de después de la visita necesita {enlace}: es donde el cliente califica.',
          ),
      );
    }

    await guardarPlantilla(sesion.localId, tipo, texto);
  }

  redirect('/panel/plantillas?guardado=1');
}
