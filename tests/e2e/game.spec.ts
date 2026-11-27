import { expect, type Page, test } from '@playwright/test';

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 60, undefined, { timeout: 45_000 });
  return errors;
}

test('arranca sin errores y dibuja la escena', async ({ page }) => {
  const errors = await boot(page);
  const d = await page.evaluate(() => window.__GAME__!.diagnostics);
  expect(d.calls).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/e2e/juego.png' });
});

test('dibuja varios tipos de planeta', async ({ page }) => {
  await boot(page);
  const d = await page.evaluate(() => window.__GAME__!.diagnostics);
  expect(d.planetTypes).toBeGreaterThanOrEqual(3);
});

test('al mover el mouse la estrella captura asteroides', async ({ page }) => {
  await boot(page);
  await page.mouse.move(640, 360); await page.mouse.down();   // izquierdo mantenido: mover
  for (let k = 0; k < 120; k++) {
    const a = k * 0.15;
    await page.mouse.move(640 + Math.cos(a) * 420, 360 + Math.sin(a) * 220);
    await page.waitForTimeout(50);
  }
  const orbiting = await page.evaluate(() => window.__GAME__!.diagnostics.orbiting);
  expect(orbiting).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/e2e/capturas.png' });
  // Con mundos en órbita, el clic derecho los lanza con la honda.
  await page.mouse.up();
  await page.mouse.click(900, 300, { button: 'right' });
  await page.waitForFunction(() => window.__GAME__!.world.shots > 0, undefined, { timeout: 5_000 });
});

test('el agujero negro en pantalla activa la lente', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { const bh = window.__GAME__!.world.bh; bh.x = bh.prevX = 55; bh.y = bh.prevY = 35; });
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => window.__GAME__!.diagnostics);
  expect(d.lensEnabled).toBe(1);
  expect(d.lensRadius).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/e2e/agujero-negro.png' });
});

test('se adapta al cambiar el tamaño de la ventana', async ({ page }) => {
  await boot(page);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.waitForFunction(() => {
    const d = window.__GAME__!.diagnostics;
    const dpr = Math.min(window.devicePixelRatio, 2);
    return d.canvasWidth === Math.floor(800 * dpr) && d.canvasHeight === Math.floor(600 * dpr);
  }, undefined, { timeout: 10_000 });
});

test('sin bordes: lejos del centro sigue habiendo cuerpos alrededor y nada falla', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const w = window.__GAME__!.world;
    w.star.x = w.star.prevX = 5000; w.star.y = w.star.prevY = -3000;
    w.bh.active = false;
  });
  await page.waitForTimeout(5000);   // la cámara sigue a la estrella con suavidad
  const near = await page.evaluate(() => {
    const w = window.__GAME__!.world;
    let n = 0;
    for (let i = 0; i < w.count; i++) if (w.state[i] === 0 && Math.hypot(w.x[i]! - w.star.x, w.y[i]! - w.star.y) < 150) n++;
    return n;
  });
  expect(near).toBeGreaterThan(20);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/e2e/lejos.png' });
});
