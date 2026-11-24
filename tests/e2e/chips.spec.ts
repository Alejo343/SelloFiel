import { expect, test } from '@playwright/test';

/**
 * El dueño registra un chip, copia su dirección y lo usa.
 */

async function entrar(page: import('@playwright/test').Page) {
  await page.goto('/panel/entrar');
  await page.getByLabel('Correo').fill('dueno@laesquina.test');
  await page.getByLabel('Contraseña').fill('sellofiel2026');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test('registrar un chip, obtener su dirección y sumar un sello con ella', async ({
  page,
  browser,
}) => {
  await entrar(page);
  await page.getByRole('link', { name: /chips y códigos/i }).click();

  await page.getByLabel(/dónde va/i).fill('Corona de la barra');
  await page.getByLabel('Tipo').selectOption('nfc');
  await page.getByRole('button', { name: /registrar/i }).click();

  // Queda en la ficha, con las instrucciones para grabarlo.
  await expect(page.getByRole('heading', { name: 'Corona de la barra' })).toBeVisible();
  await expect(page.getByText(/ahora toca grabarlo/i)).toBeVisible();
  await expect(page.getByText(/NFC Tools/).first()).toBeVisible();
  await expect(page.getByText(/bloquéalo/i)).toBeVisible();

  const direccion = (await page.locator('code').first().innerText()).trim();
  expect(direccion).toMatch(/\/t\/[A-Za-z0-9_-]{16}$/);

  // Un cliente apoya el celular en ese chip: lo que haría la dirección grabada.
  const cliente = await browser.newContext();
  const pestana = await cliente.newPage();
  await pestana.goto(new URL(direccion).pathname);
  await expect(pestana.getByText(/ya registramos tu visita/i)).toBeVisible();
  await cliente.close();
});

test('un chip dado de baja deja de sumar', async ({ page, browser }) => {
  await entrar(page);
  await page.goto('/panel/chips');
  await page.getByLabel(/dónde va/i).fill('Chip que se pierde');
  await page.getByRole('button', { name: /registrar/i }).click();
  const ruta = new URL((await page.locator('code').first().innerText()).trim()).pathname;

  await page.getByRole('button', { name: /dar de baja/i }).click();
  await expect(page.getByText(/dado de baja/i).first()).toBeVisible();

  // Un cliente del club intenta sumar con el chip perdido.
  const cliente = await browser.newContext();
  const pestana = await cliente.newPage();
  await pestana.goto('/c/la-esquina/alta');
  await pestana.getByLabel('Tu nombre').fill('Cliente Del Chip Perdido');
  await pestana.getByLabel('Tu WhatsApp').fill(`30066${Math.floor(Math.random() * 90000) + 10000}`);
  await pestana.getByRole('checkbox').check();
  await pestana.getByRole('button', { name: /unirme al club/i }).click();
  await expect(pestana).toHaveURL(/tarjeta$/);

  await pestana.goto(ruta);
  await expect(pestana.getByText(/ya no está activo/i)).toBeVisible();
  await cliente.close();
});

test('no se puede abrir el chip de otro local', async ({ page }) => {
  await entrar(page);
  const respuesta = await page.goto('/panel/chips/00000000-0000-4000-8000-000000000000');
  expect(respuesta?.status()).toBe(404);
});
