import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * Campañas desde el panel (RF-31): se crea, aparece en la bandeja con su
 * nombre, y lo que no se envió se puede quitar.
 */

async function entrar(page: import('@playwright/test').Page) {
  await page.goto('/panel/entrar');
  await page.getByLabel('Correo').fill('dueno@laesquina.test');
  await page.getByLabel('Contraseña').fill('sellofiel2026');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test('el dueño lanza una campaña a los que se perdieron y la envía desde la bandeja', async ({ page }) => {
  await entrar(page);
  await page.getByRole('link', { name: /campañas/i }).click();
  await expect(page).toHaveURL(/\/panel\/campanas$/);

  const nombre = `Milanesa ${Date.now()}`;
  await page.getByLabel(/^nombre/i).fill(nombre);
  await page.getByLabel(/los que se perdieron/i).check();
  await page.getByLabel('Mensaje').fill('{nombre}, hoy milanesa 2x1 en {local}');
  await page.getByRole('button', { name: /crear campaña/i }).click();

  await expect(page.getByText(/campaña creada/i)).toBeVisible();
  await page.getByRole('link', { name: /ir a enviarlos/i }).click();

  const fila = page.locator('li', { hasText: `Campaña: ${nombre}` });
  await expect(fila.first()).toContainText('Ana Perdida');
  await expect(fila.first()).toContainText('Ana Perdida, hoy milanesa 2x1 en La Esquina');
  // Pedro pidió la baja: nunca.
  await expect(page.locator('li', { hasText: `Campaña: ${nombre}` }).filter({ hasText: 'Pedro Baja' })).toHaveCount(0);

  // Quitar lo pendiente desde la lista de campañas.
  await page.goto('/panel/campanas');
  const item = page.locator('li', { hasText: nombre });
  await item.getByRole('button', { name: /quitar de la bandeja/i }).click();
  await expect(page.locator('li', { hasText: nombre })).toContainText('0 de');
  await page.goto('/panel/mensajes');
  await expect(page.getByText(`Campaña: ${nombre}`)).toHaveCount(0);
});

test('un marcador mal escrito no crea nada y conserva lo escrito', async ({ page }) => {
  await entrar(page);
  await page.goto('/panel/campanas');
  await page.getByLabel(/^nombre/i).fill('Con error');
  await page.getByLabel('Mensaje').fill('Hola {nombe}');
  await page.getByRole('button', { name: /crear campaña/i }).click();
  await expect(page.locator('p.error')).toContainText('{nombe}');
  await expect(page.getByLabel(/^nombre/i)).toHaveValue('Con error');
  await expect(page.getByLabel('Mensaje')).toHaveValue('Hola {nombe}');
});
