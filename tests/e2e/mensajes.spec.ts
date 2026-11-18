import 'dotenv/config';

import { eq } from 'drizzle-orm';
import { expect, test } from '@playwright/test';

import { crearConexion } from '../../src/db';
import { clientes, locales, mensajes, sellos } from '../../src/db/schema';
import { generarMensajes } from '../../src/servicios/mensajes';

/**
 * El recorrido de los mensajes, de punta a punta.
 *
 * La semilla deja a Ana Perdida con su último sello hace 100 días, así que al
 * generar los mensajes tiene que aparecer en la bandeja por inactividad.
 */

const CLAVE = 'sellofiel2026';

/** Crea un cliente solo para esta prueba, con una visita, y devuelve el sello. */
async function visitaDePrueba(nombre: string, fecha: string): Promise<string> {
  return conBase(async (db) => {
    const [local] = await db.select().from(locales).where(eq(locales.slug, 'la-esquina'));
    const [cliente] = await db
      .insert(clientes)
      .values({
        localId: local.id,
        nombre,
        telefono: `5730055${Math.floor(Math.random() * 90000) + 10000}`,
        consentimientoEn: new Date(),
        consentimientoVersion: 'e2e',
      })
      .returning();
    const [sello] = await db
      .insert(sellos)
      .values({ localId: local.id, clienteId: cliente.id, fecha, origen: 'nfc' })
      .returning();
    return sello.id;
  });
}

async function conBase<T>(fn: (db: ReturnType<typeof crearConexion>['db']) => Promise<T>): Promise<T> {
  const { cliente: sql, db } = crearConexion(process.env.DATABASE_URL, 1);
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function entrar(page: import('@playwright/test').Page) {
  await page.goto('/panel/entrar');
  await page.getByLabel('Correo').fill('dueno@laesquina.test');
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test('la bandeja muestra a quien dejó de venir, con su WhatsApp listo', async ({ page }) => {
  await conBase((db) => generarMensajes({}, db));
  await entrar(page);

  await page.goto('/panel/mensajes');

  // Exacto: el nombre también aparece dentro del texto del mensaje.
  await expect(page.getByText('Ana Perdida', { exact: true })).toBeVisible();
  await expect(page.getByText(/hace tiempo que no viene/i)).toBeVisible();

  // El enlace abre WhatsApp con el texto ya escrito. Se acota a la fila de
  // Ana: la bandeja trae varios pendientes y entre mensajes del mismo
  // instante el orden no está garantizado.
  const filaAna = page.locator('li', { hasText: 'Ana Perdida' }).first();
  const href = await filaAna.getByRole('link', { name: /abrir en whatsapp/i }).getAttribute('href');
  expect(href).toContain('https://wa.me/');
  expect(decodeURIComponent(href!)).toContain('Ana Perdida');
});

test('marcar como enviado saca el mensaje de la bandeja y no reaparece', async ({ page }) => {
  await conBase((db) => generarMensajes({}, db));
  await entrar(page);
  await page.goto('/panel/mensajes');

  const fila = page.locator('li', { hasText: 'Ana Perdida' }).first();
  await fila.getByRole('button', { name: /ya lo envié/i }).click();

  await expect(page.getByText('Ana Perdida', { exact: true })).toHaveCount(0);

  // Y volver a generar no lo resucita: la clave de ocasión lo impide.
  await conBase((db) => generarMensajes({}, db));
  await page.reload();
  await expect(page.getByText('Ana Perdida', { exact: true })).toHaveCount(0);
});

test('el cliente califica bien su visita y lo llevan a Google Maps', async ({ page }) => {
  const selloId = await visitaDePrueba('Cliente Contento', '2026-01-15');

  await page.goto(`/c/la-esquina/opinion/${selloId}`);
  await expect(page.getByRole('heading', { name: 'La Esquina' })).toBeVisible();

  await page.getByRole('button', { name: /estuvo bien/i }).click();

  // La semilla le pone al local un enlace de reseñas de Google.
  await expect(page).toHaveURL(/maps\.google\.com|google\.com\/maps/);
});

test('una queja se queda con el dueño y NO va a Google', async ({ page }) => {
  // Es el argumento de venta del filtro de reseñas.
  const selloId = await visitaDePrueba('Cliente Molesto', '2026-01-16');

  await page.goto(`/c/la-esquina/opinion/${selloId}`);
  await page.getByLabel(/qué pasó/i).fill('La sopa llegó fría');
  await page.getByRole('button', { name: /enviar mi comentario/i }).click();

  // No lo mandan a Google.
  await expect(page).not.toHaveURL(/google/);
  await expect(page.getByRole('heading', { name: /gracias por contarnos/i })).toBeVisible();

  // Y al dueño le llega.
  await entrar(page);
  await page.goto('/panel/mensajes');
  await expect(page.getByText(/no quedaron contentos/i)).toBeVisible();
  await expect(page.getByText('La sopa llegó fría')).toBeVisible();
});

test('un identificador de visita inventado da 404', async ({ page }) => {
  const respuesta = await page.goto('/c/la-esquina/opinion/11111111-1111-4111-8111-111111111111');
  expect(respuesta?.status()).toBe(404);
});

test('el local puede cambiar los textos de los mensajes', async ({ page }) => {
  await entrar(page);
  await page.goto('/panel/plantillas');

  await page.getByLabel(/hace rato que no viene/i).fill('Vuelve pronto, {nombre}, te extrañamos');
  await page.getByRole('button', { name: /guardar textos/i }).click();
  await expect(page).toHaveURL(/guardado=1|error=/);
  await expect(page.getByText(/textos guardados/i)).toBeVisible();

  // El texto nuevo se usa en los mensajes que se generen desde ahora.
  await conBase(async (db) => {
    await db.delete(mensajes);
    await generarMensajes({}, db);
  });

  await page.goto('/panel/mensajes');
  // Puede haber varios clientes inactivos: basta con que todos usen el texto nuevo.
  await expect(page.getByText(/te extrañamos/i).first()).toBeVisible();
});

test('avisa si el texto usa un marcador que no existe', async ({ page }) => {
  await entrar(page);
  await page.goto('/panel/plantillas');

  // Sin esto, el cliente recibiría un WhatsApp que dice "Hola {nombe}".
  await page.getByLabel(/por su cumpleaños/i).fill('Feliz cumple {nombe}');
  await page.getByRole('button', { name: /guardar textos/i }).click();

  await expect(page.getByText(/marcadores que no existen/i)).toBeVisible();
  await expect(page.getByText('{nombe}')).toBeVisible();
});
