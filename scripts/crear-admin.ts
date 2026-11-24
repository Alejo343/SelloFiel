/**
 * Crea un administrador de Sello Fiel, o le genera una contraseña nueva si ya
 * existe (sirve también para recuperar el acceso).
 *
 *   npm run admin:crear -- correo@ejemplo.com "Nombre"
 *
 * La contraseña se genera al azar y se muestra UNA sola vez.
 */

import 'dotenv/config';

import { crearConexion } from '../src/db';
import { crearAdmin } from '../src/servicios/admin';

async function principal() {
  const [email, nombre] = process.argv.slice(2);
  if (!email || !nombre || !email.includes('@')) {
    console.error('Uso: npm run admin:crear -- correo@ejemplo.com "Nombre"');
    process.exit(1);
  }

  const { cliente: sql, db } = crearConexion(process.env.DATABASE_URL, 1);
  try {
    const contrasena = await crearAdmin({ email, nombre }, db);
    console.log(`\nAdministrador listo: ${email}`);
    console.log(`Contraseña: ${contrasena}`);
    console.log('Guárdala ahora: no se vuelve a mostrar.\n');
  } finally {
    await sql.end();
  }
}

principal().catch((e) => {
  console.error('Falló:', e);
  process.exit(1);
});
