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
