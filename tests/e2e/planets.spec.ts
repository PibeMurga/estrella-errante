import { expect, test } from '@playwright/test';

test('marcas de peligro alrededor de los planetas cercanos, y el visor del sistema', async ({ page }) => {
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await expect(page.locator('.hud .sys')).toContainText('PLANETAS');
  // Acercar a la estrella un planeta de cada escalón (sin que la toquen).
  await page.evaluate(() => {
    const w = window.__GAME__!.world; const s = w.star; const E = 4 + 0.5 * Math.sqrt(s.mass);
    const set = (k: number, dx: number, dy: number, r: number): void => { const p = w.planets[k]!; w.x[p] = w.prevX[p] = s.x + dx; w.y[p] = w.prevY[p] = s.y + dy; w.vx[p] = 0; w.vy[p] = 0; w.radius[p] = r; w.mass[p] = r ** 3; };
    set(0, 22, 0, E * 0.8); set(1, -24, 0, E * 1.3); set(2, 0, 26, E * 1.8);
  });
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.__GAME__!.diagnostics.dangerMarks)).toBeGreaterThanOrEqual(3);   // puede haber otro planeta cerca en el mapa
  await page.screenshot({ path: 'artifacts/e2e/marcas-de-peligro.png' });
});
