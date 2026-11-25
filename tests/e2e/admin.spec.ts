import 'dotenv/config';

import { expect, test, type Page } from '@playwright/test';

/**
 * El administrador crea un local real y su dueño lo empieza a usar.
 */

async function entrarAdmin(page: Page) {
  await page.goto('/admin/entrar');
  await page.getByLabel('Correo').fill('admin@sellofiel.test');
  await page.getByLabel('Contraseña').fill('sellofiel2026');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('sin sesión de administrador no se entra', async ({ page }) => {
  for (const ruta of ['/admin', '/admin/locales/nuevo']) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/admin\/entrar$/);
  }
});

test('la sesión de un DUEÑO no abre el panel de administrador', async ({ page }) => {
  await page.goto('/panel/entrar');
  await page.getByLabel('Correo').fill('dueno@laesquina.test');
  await page.getByLabel('Contraseña').fill('sellofiel2026');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/panel$/);

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/entrar$/);
});

test('crear un local, entregar la clave y que el dueño la cambie al entrar', async ({
  page,
  browser,
}) => {
  const sufijo = Math.random().toString(36).slice(2, 7);
  await entrarAdmin(page);
  await page.getByRole('link', { name: /crear un local/i }).click();

  // La dirección se sugiere sola a partir del nombre.
  await page.getByLabel('Nombre', { exact: true }).first().fill(`El Barril ${sufijo}`);
  await expect(page.getByLabel(/dirección del club/i)).toHaveValue(`el-barril-${sufijo}`);

  await page.getByLabel('Qué se gana').fill('Una cerveza artesanal');
  await page.locator('#duenoNombre').fill('Dueño del Barril');
  await page.getByLabel('Correo').fill(`dueno-${sufijo}@elbarril.test`);
  await page.getByRole('button', { name: /crear local/i }).click();

  await expect(page.getByText(/local creado/i)).toBeVisible();
  const datos = await page.locator('.fila__cita').innerText();
  const clave = datos.match(/Contraseña temporal: (\S+)/)?.[1];
  expect(clave).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  // La contraseña nunca viaja en la dirección de la página.
  expect(page.url()).not.toContain(clave!);

  // El dueño entra con la temporal y queda obligado a cambiarla.
  const dueno = await browser.newContext();
  const p2 = await dueno.newPage();
  await p2.goto('/panel/entrar');
  await p2.getByLabel('Correo').fill(`dueno-${sufijo}@elbarril.test`);
  await p2.getByLabel('Contraseña').fill(clave!);
  await p2.getByRole('button', { name: /entrar/i }).click();
  await expect(p2).toHaveURL(/\/panel\/cuenta$/);

  // No puede saltarse el cambio yendo a otra pantalla.
  await p2.goto('/panel/clientes');
  await expect(p2).toHaveURL(/\/panel\/cuenta$/);

  await p2.getByLabel(/contraseña temporal/i).fill(clave!);
  await p2.getByLabel('Nueva contraseña', { exact: true }).fill('mi-clave-del-barril');
  await p2.getByLabel(/repite/i).fill('mi-clave-del-barril');
  await p2.getByRole('button', { name: /guardar contraseña/i }).click();

  await expect(p2).toHaveURL(/\/panel/);
  await expect(p2.getByRole('heading', { name: `El Barril ${sufijo}` })).toBeVisible();
  await dueno.close();
});

test('el administrador registra un chip del local desde su ficha', async ({ page }) => {
  await entrarAdmin(page);
  await page.getByRole('link', { name: 'La Esquina' }).click();

  await page.getByLabel(/dónde va/i).fill('Barril del mozo 2');
  await page.getByRole('button', { name: /^registrar$/i }).click();

  const fila = page.locator('li', { hasText: 'Barril del mozo 2' });
  await expect(fila).toBeVisible();
  await expect(fila.locator('code')).toContainText(/\/t\/[A-Za-z0-9_-]{16}/);
});

test('el diseño de la tarjeta rechaza direcciones que Google no puede descargar', async ({ page }) => {
  await entrarAdmin(page);
  await page.getByRole('link', { name: 'La Esquina' }).click();
  await page.getByLabel('Imagen principal').fill('http://inseguro.test/sellos-{sellos}.jpg');
  await page.getByRole('button', { name: /guardar diseño/i }).click();
  await expect(page.locator('p.error')).toContainText(/https/);
  // Lo escrito no se pierde.
  await expect(page.getByLabel('Imagen principal')).toHaveValue('http://inseguro.test/sellos-{sellos}.jpg');
});

test('con diseño a medida, la tarjeta web muestra la misma imagen que Wallet', async ({ page }) => {
  const { crearConexion } = await import('../../src/db');
  const { locales } = await import('../../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { cliente: sql, db } = crearConexion(process.env.DATABASE_URL, 1);
  try {
    await db
      .update(locales)
      .set({ plantillaImagenUrl: 'https://sellofiel.app/tarjetas/prueba/v1/sellos-{sellos}.jpg' })
      .where(eq(locales.slug, 'cafe-vecino'));
    await page.goto('/c/cafe-vecino/alta');
    await page.getByLabel('Tu nombre').fill('Cliente Diseño');
    await page.getByLabel('Tu WhatsApp').fill(`30066${Math.floor(Math.random() * 90000) + 10000}`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /unirme al club/i }).click();
    await expect(page).toHaveURL(/tarjeta$/);
    await expect(page.locator('img.tarjeta-sellos__imagen')).toHaveAttribute('src', /sellos-0\.jpg$/);
  } finally {
    await db.update(locales).set({ plantillaImagenUrl: null }).where(eq(locales.slug, 'cafe-vecino'));
    await sql.end();
  }
});
