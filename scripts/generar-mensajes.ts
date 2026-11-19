/**
 * Calcula los mensajes del día y los deja en la bandeja de cada local.
 *
 * Pensado para correr por cron cada hora. Cada hora y no una vez al día por
 * la pregunta de después de la visita, que depende de cuándo vino el cliente:
 * con una sola corrida diaria, a quien viene por la tarde se le preguntaría
 * al día siguiente.
 *
 *   0 * * * * cd /home/claude/proyectos/fidelizacion && npm run mensajes:generar >> /home/claude/logs/sellofiel-mensajes.log 2>&1
 *
 * Es seguro ejecutarlo de nuevo: cada mensaje tiene una clave de ocasión que
 * impide duplicarlo.
 */

import 'dotenv/config';

import { crearConexion } from '../src/db';
import { generarMensajes } from '../src/servicios/mensajes';

async function principal() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en el .env');

  const { cliente: sql, db } = crearConexion(url, 2);

  try {
    const resultado = await generarMensajes({}, db);

    // Corre cada hora: sin esto el log se llena de "mensajes nuevos=0".
    if (resultado.creados === 0) return;

    const detalle = Object.entries(resultado.porTipo)
      .map(([tipo, n]) => `${tipo}=${n}`)
      .join(' ');

    console.log(
      `[${new Date().toISOString()}] mensajes nuevos=${resultado.creados}` +
        (detalle ? ` (${detalle})` : ''),
    );
  } finally {
    await sql.end();
  }
}

principal().catch((error) => {
  console.error('Falló la generación de mensajes:', error);
  process.exit(1);
});
