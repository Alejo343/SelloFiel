import { expect, test } from '@playwright/test';

/**
 * Manejo de errores.
 *
 * Reproduce lo que vivió David el 2026-11-24: al enviar el alta apareció la
 * pantalla genérica de Next, en inglés, y en el servidor no quedó rastro.
 */

test('si el envío del alta falla, sale nuestra pantalla en español y se puede reintentar', async ({
  page,
}) => {
  await page.goto('/c/la-esquina/alta');
  await page.getByLabel('Tu nombre').fill('Cliente Sin Conexion');
  await page.getByLabel('Tu WhatsApp').fill(`30044${Math.floor(Math.random() * 90000) + 10000}`);
  await page.getByRole('checkbox').check();

  // Se corta la conexión justo al enviar, como un celular que pierde la señal.
  await page.route('**/c/la-esquina/alta', (ruta) =>
    ruta.request().method() === 'POST' ? ruta.abort('internetdisconnected') : ruta.continue(),
  );

  const reporte = page.waitForRequest((r) => r.url().endsWith('/api/errores'));
  await page.getByRole('button', { name: /unirme al club/i }).click();

  await expect(page.getByRole('heading', { name: /algo no salió bien/i })).toBeVisible();
  await expect(page.getByText(/this page couldn/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /reintentar/i })).toBeVisible();

  // Y el error nos llega, aunque haya ocurrido en el navegador.
  const enviado = await reporte;
  expect(enviado.postData() ?? '').toContain('/c/la-esquina/alta');
});

test.describe('el receptor de errores', () => {
  test('acepta un reporte normal', async ({ request }) => {
    const r = await request.post('/api/errores', {
      data: { ruta: '/prueba', mensaje: 'error de prueba', navegador: 'playwright' },
    });
    expect(r.status()).toBe(204);
  });

  test('rechaza basura y reportes gigantes, para que no se pueda llenar el registro', async ({
    request,
  }) => {
    expect((await request.post('/api/errores', { data: 'esto no es json' })).status()).toBe(400);
    expect(
      (await request.post('/api/errores', { data: { mensaje: 'x'.repeat(20_000) } })).status(),
    ).toBe(413);
  });
});
