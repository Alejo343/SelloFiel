import 'dotenv/config';

import { expect, test, type Page } from '@playwright/test';

/**
 * Varias sucursales (RF-32). La semilla deja a La Esquina con dos sedes,
 * Centro (tag-esquina-caja) y Norte (tag-esquina-norte).
 */

const telefono = () => `30077${Math.floor(Math.random() * 90000) + 10000}`;

async function entrar(page: Page) {
  await page.goto('/panel/entrar');
  await page.getByLabel('Correo').fill('dueno@laesquina.test');
  await page.getByLabel('Contraseña').fill('sellofiel2026');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test('una tarjeta para las dos sedes, y un sello por día entre las dos', async ({ page }) => {
  // Se une en la sede Norte: esa visita suma.
  await page.goto('/t/tag-esquina-norte');
  await page.getByRole('link', { name: /unirme al club/i }).click();
  await page.getByLabel('Tu nombre').fill('Cliente Dos Sedes');
  await page.getByLabel('Tu WhatsApp').fill(telefono());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /unirme al club/i }).click();
  await expect(page.getByText(/^1 de \d+ sellos$/)).toBeVisible();

  // El mismo día en el Centro: misma tarjeta, y no suma otro.
  await page.goto('/t/tag-esquina-caja');
  await expect(page.getByText(/ya sumaste tu visita de hoy/i)).toBeVisible();
  await expect(page.getByText(/^1 de \d+ sellos$/)).toBeVisible();
});

test('el dueño ve sus sedes, agrega una, la edita y la cierra', async ({ page }) => {
  await entrar(page);
  // Con dos sedes, la portada muestra los sellos de cada una.
  await expect(page.getByRole('list', { name: /sellos por sucursal/i })).toContainText('Norte');

  await page.getByRole('link', { name: /^sucursales/i }).click();
  await expect(page.getByRole('link', { name: 'Centro' })).toBeVisible();

  const nombre = `Sur ${Date.now() % 100000}`;
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByLabel('Latitud').fill('4.60');
  // Falta la longitud: error, y lo escrito no se pierde.
  await page.getByRole('button', { name: /agregar sucursal/i }).click();
  await expect(page.locator('p.error')).toContainText(/latitud y longitud/i);
  await expect(page.getByLabel('Nombre')).toHaveValue(nombre);

  await page.getByLabel('Longitud').fill('-74.08');
  await page.getByRole('button', { name: /agregar sucursal/i }).click();
  await expect(page.getByText(/sucursal agregada/i)).toBeVisible();

  await page.getByRole('link', { name: nombre }).click();
  await expect(page.getByRole('heading', { name: nombre })).toBeVisible();
  await page.getByLabel('Dirección (opcional)').fill('Av. Sur 1');
  await page.getByRole('button', { name: /guardar cambios/i }).click();
  await expect(page.getByText(/cambios guardados/i)).toBeVisible();
  await expect(page.getByLabel('Dirección (opcional)')).toHaveValue('Av. Sur 1');

  await page.getByRole('button', { name: /cerrar esta sucursal/i }).click();
  await expect(page.getByText('Cerrada')).toBeVisible();
});

test('con varias sedes, el chip nuevo y el sello a mano preguntan dónde', async ({ page }) => {
  await entrar(page);
  await page.goto('/panel/chips');
  await page.getByLabel('¿Dónde va?').fill('Caja Norte 2');
  await page.getByLabel('¿En qué sucursal?').selectOption({ label: 'Norte' });
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('Sucursal Norte')).toBeVisible();

  await page.goto('/panel/clientes');
  await page.getByRole('link', { name: 'Lucía Nueva' }).click();
  await expect(page.getByLabel(/en qué sucursal está/i)).toBeVisible();
});

test('la sede de otro local da 404', async ({ page }) => {
  await entrar(page);
  const r = await page.goto('/panel/sucursales/00000000-0000-0000-0000-000000000000');
  expect(r?.status()).toBe(404);
});
