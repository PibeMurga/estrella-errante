import { expect, type Page, test } from '@playwright/test';

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
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

test('se adapta al cambiar el tamaño de la ventana', async ({ page }) => {
  await boot(page);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.waitForFunction(() => {
    const d = window.__GAME__!.diagnostics;
    const dpr = Math.min(window.devicePixelRatio, 2);
    return d.canvasWidth === Math.floor(800 * dpr) && d.canvasHeight === Math.floor(600 * dpr);
  }, undefined, { timeout: 10_000 });
});
