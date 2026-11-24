import 'dotenv/config';

import AxeBuilder from '@axe-core/playwright';
import { eq } from 'drizzle-orm';
import { expect, test, type Page } from '@playwright/test';

import { crearConexion } from '../../src/db';
import { locales, sellos } from '../../src/db/schema';
import { generarMensajes } from '../../src/servicios/mensajes';

/**
 * Auditoría de accesibilidad con axe, el estándar de facto.
 *
 * Se exige cero violaciones **graves o críticas** en WCAG 2.1 A y AA, que es
 * lo que de verdad impide usar una pantalla: texto sin contraste suficiente,
 * campos sin etiqueta, botones sin nombre.
 *
 * Importa más de lo habitual en este producto porque se usa en condiciones
 * difíciles: de pie, con una mano, a menudo con poca luz en un salón (RNF-12),
 * y por clientes de cualquier edad.
 */

const NIVELES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function auditar(page: Page, nombre: string) {
  const resultado = await new AxeBuilder({ page })
    .withTags(NIVELES)
    // El indicador del servidor de desarrollo de Next no es parte de la app.
    .exclude('nextjs-portal')
    .analyze();

  const graves = resultado.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

  // Si falla, el mensaje dice qué regla y en qué elemento, para arreglarlo
  // sin tener que reproducirlo a mano.
  const resumen = graves.map(
    (v) =>
      `[${v.impact}] ${v.id}: ${v.help}\n` +
      v.nodes
        .slice(0, 3)
        .map((n) => `    ${n.target.join(' ')}`)
        .join('\n'),
  );

  expect(graves, `${nombre}:\n${resumen.join('\n')}`).toEqual([]);
}

async function entrarAlPanel(page: Page) {
  await page.goto('/panel/entrar');
  await page.getByLabel('Correo').fill('dueno@laesquina.test');
  await page.getByLabel('Contraseña').fill('sellofiel2026');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test.describe('pantallas del cliente', () => {
  test('el tap de un cliente nuevo', async ({ page }) => {
    await page.goto('/t/tag-esquina-caja');
    await auditar(page, 'tap');
  });

  test('el formulario de alta', async ({ page }) => {
    await page.goto('/c/la-esquina/alta');
    await auditar(page, 'alta');
  });

  test('la tarjeta con sellos', async ({ page }) => {
    await page.goto('/c/la-esquina/alta');
    await page.getByLabel('Tu nombre').fill('Cliente Accesible');
    await page.getByLabel('Tu WhatsApp').fill(`30088${Math.floor(Math.random() * 90000) + 10000}`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /unirme al club/i }).click();
    await expect(page).toHaveURL(/tarjeta$/);
    await auditar(page, 'tarjeta');
  });

  test('la política de datos', async ({ page }) => {
    await page.goto('/c/la-esquina/politica');
    await auditar(page, 'política');
  });

  test('la pregunta de después de la visita', async ({ page }) => {
    const { cliente: sql, db } = crearConexion(process.env.DATABASE_URL, 1);
    let selloId: string;
    try {
      const [local] = await db.select().from(locales).where(eq(locales.slug, 'la-esquina'));
      const [sello] = await db.select().from(sellos).where(eq(sellos.localId, local.id)).limit(1);
      selloId = sello.id;
    } finally {
      await sql.end();
    }
    await page.goto(`/c/la-esquina/opinion/${selloId}`);
    await auditar(page, 'opinión');
  });
});

test.describe('panel del dueño', () => {
  test('el login', async ({ page }) => {
    await page.goto('/panel/entrar');
    await auditar(page, 'login');
  });

  for (const [nombre, ruta] of [
    ['portada', '/panel'],
    ['clientes', '/panel/clientes'],
    ['mensajes', '/panel/mensajes'],
    ['configuración', '/panel/programa'],
    ['textos', '/panel/plantillas'],
    ['pantalla de la caja', '/panel/pantalla'],
    ['alertas', '/panel/alertas'],
    ['chips', '/panel/chips'],
    ['campañas', '/panel/campanas'],
    ['sucursales', '/panel/sucursales'],
  ] as const) {
    test(nombre, async ({ page }) => {
      if (ruta === '/panel/mensajes') {
        // Con mensajes pendientes de verdad: vacía, la bandeja no muestra sus
        // etiquetas, y un fallo de contraste en ellas pasó desapercibido.
        const { cliente: sql, db } = crearConexion(process.env.DATABASE_URL, 1);
        try {
          await generarMensajes({}, db);
        } finally {
          await sql.end();
        }
      }
      await entrarAlPanel(page);
      await page.goto(ruta);
      await auditar(page, nombre);
    });
  }
});

test.describe('panel de administrador', () => {
  test('login y lista de locales', async ({ page }) => {
    await page.goto('/admin/entrar');
    await auditar(page, 'login admin');
    await page.getByLabel('Correo').fill('admin@sellofiel.test');
    await page.getByLabel('Contraseña').fill('sellofiel2026');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await auditar(page, 'locales');
    await page.goto('/admin/locales/nuevo');
    await auditar(page, 'nuevo local');
  });
});

test.describe('cualquier color que elija el local queda legible', () => {
  /**
   * El color lo pone el dueño y puede ser cualquiera. Estos son los peores
   * casos realistas: un amarillo pálido (texto blanco encima sería ilegible),
   * un verde menta muy claro y un azul casi negro.
   *
   * Se cambia el color de La Esquina en la base de PRUEBAS y se audita la
   * pantalla que más color lleva: la del tap, con su botón principal.
   */
  for (const color of ['#ffe066', '#c8f7dc', '#0b1a33']) {
    test(`con el color ${color}`, async ({ page }) => {
      const { cliente: sql, db } = crearConexion(process.env.DATABASE_URL, 1);
      let original = '#8b1e1e';
      try {
        const [local] = await db.select().from(locales).where(eq(locales.slug, 'la-esquina'));
        original = local.colorPrimario;
        await db
          .update(locales)
          .set({ colorPrimario: color })
          .where(eq(locales.slug, 'la-esquina'));

        await page.goto('/t/tag-esquina-caja');
        await auditar(page, `tap con ${color}`);

        await page.goto('/c/la-esquina/alta');
        await auditar(page, `alta con ${color}`);
      } finally {
        // Se deja como estaba, para no afectar a las demás pruebas.
        await db
          .update(locales)
          .set({ colorPrimario: original })
          .where(eq(locales.slug, 'la-esquina'));
        await sql.end();
      }
    });
  }
});
