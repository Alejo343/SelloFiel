import 'dotenv/config';

import { eq } from 'drizzle-orm';
import { expect, test } from '@playwright/test';

import { crearConexion } from '../../src/db';
import { locales, tags } from '../../src/db/schema';
import { emitirCodigo } from '../../src/servicios/antifraude';

/**
 * Las defensas contra sellos falsos, vistas desde el celular.
 *
 * Tags de la semilla en La Esquina:
 *   tag-esquina-caja      — nfc, suma sellos
 *   tag-esquina-mesa4     — qr_impreso, SOLO sirve para unirse
 *   tag-esquina-pantalla  — pantalla, códigos de un solo uso
 */

const CLAVE = 'sellofiel2026';

async function conBase<T>(fn: (db: ReturnType<typeof crearConexion>['db']) => Promise<T>) {
  const { cliente: sql, db } = crearConexion(process.env.DATABASE_URL, 1);
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

function telefonoUnico() {
  return `30077${Math.floor(Math.random() * 90000) + 10000}`;
}

/** Entra al panel y espera a que la sesión esté lista. */
async function entrarAlPanel(page: import('@playwright/test').Page) {
  await page.goto('/panel/entrar');
  await page.getByLabel('Correo').fill('dueno@laesquina.test');
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: /entrar/i }).click();
  // Sin esperar la redirección, el goto siguiente corre sin sesión.
  await expect(page).toHaveURL(/\/panel$/);
}

/** Deja al navegador dentro del club de La Esquina. */
async function unirseAlClub(page: import('@playwright/test').Page, nombre: string) {
  await page.goto('/c/la-esquina/alta');
  await page.getByLabel('Tu nombre').fill(nombre);
  await page.getByLabel('Tu WhatsApp').fill(telefonoUnico());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /unirme al club/i }).click();
  await expect(page).toHaveURL(/\/c\/la-esquina\/tarjeta$/);
}

test('un QR impreso NO suma sellos, por más veces que se escanee (RN-10)', async ({ page }) => {
  // El fallo que originó esta fase: un QR impreso es una URL fija que el
  // cliente fotografía y usaría desde su casa todos los días.
  await unirseAlClub(page, 'Cliente Con QR Impreso');
  await expect(page.getByText('0 de 10 sellos')).toBeVisible();

  for (let i = 0; i < 3; i += 1) {
    await page.goto('/t/tag-esquina-mesa4');
    await expect(page.getByText(/el sello de esta visita te lo suma el personal/i)).toBeVisible();
  }

  await page.goto('/c/la-esquina/tarjeta');
  await expect(page.getByText('0 de 10 sellos')).toBeVisible();
});

test('el chip NFC sí suma, una vez al día', async ({ page }) => {
  await unirseAlClub(page, 'Cliente Con Chip');

  await page.goto('/t/tag-esquina-caja');
  await expect(page.getByText('1 de 10 sellos')).toBeVisible();

  await page.goto('/t/tag-esquina-caja');
  await expect(page.getByText(/ya sumaste tu visita de hoy/i)).toBeVisible();
  await expect(page.getByText('1 de 10 sellos')).toBeVisible();
});

test('el código de pantalla suma una vez y nunca más (RN-11)', async ({ page }) => {
  await unirseAlClub(page, 'Cliente Con Pantalla');

  const codigo = await conBase(async (db) => {
    const [local] = await db.select().from(locales).where(eq(locales.slug, 'la-esquina'));
    const [tag] = await db.select().from(tags).where(eq(tags.token, 'tag-esquina-pantalla'));
    const emitido = await emitirCodigo(tag.id, local.id, db);
    return emitido.codigo;
  });

  await page.goto(`/s/${encodeURIComponent(codigo)}`);
  await expect(page.getByText('1 de 10 sellos')).toBeVisible();

  // Una foto del mismo QR no sirve para repetir: esta es la idea central.
  await page.goto(`/s/${encodeURIComponent(codigo)}`);
  await expect(page.getByText(/ya se usó/i)).toBeVisible();
});

test('un código vencido no sirve aunque nadie lo haya usado', async ({ page }) => {
  // El hueco que el "un solo uso" no cubre solo: fotografiarlo y usarlo
  // de noche desde casa.
  await unirseAlClub(page, 'Cliente Con Codigo Viejo');

  const codigo = await conBase(async (db) => {
    const [local] = await db.select().from(locales).where(eq(locales.slug, 'la-esquina'));
    const [tag] = await db.select().from(tags).where(eq(tags.token, 'tag-esquina-pantalla'));
    const hace10Minutos = new Date(Date.now() - 10 * 60_000);
    const emitido = await emitirCodigo(tag.id, local.id, db, hace10Minutos);
    return emitido.codigo;
  });

  await page.goto(`/s/${encodeURIComponent(codigo)}`);
  await expect(page.getByText(/venció/i)).toBeVisible();
  await expect(page.getByText(/el que esté en pantalla ahora/i)).toBeVisible();
});

test('un código inventado no suma nada', async ({ page }) => {
  await unirseAlClub(page, 'Cliente Curioso');

  await page.goto('/s/me-lo-invente-yo-mismo');
  await expect(page.getByText(/no es válido/i)).toBeVisible();
});

test('la pantalla de la caja muestra un QR y lo renueva', async ({ page }) => {
  await entrarAlPanel(page);
  await page.goto('/panel/pantalla');

  // El primer código llega ya dibujado del servidor: nada de esperas
  // delante de un cliente.
  const qr = page.getByAltText(/código para sumar/i);
  await expect(qr).toBeVisible();

  const primero = await qr.getAttribute('src');
  expect(primero).toContain('/api/codigo/qr?c=');
  await expect(page.getByText(/se renueva cada/i)).toBeVisible();
});

test('las alertas se ven en el panel y no bloquean nada', async ({ page }) => {
  await entrarAlPanel(page);
  await page.goto('/panel/alertas');
  await expect(page.getByRole('heading', { name: /cosas para revisar/i })).toBeVisible();
});
