import { expect, test } from '@playwright/test';

test('el laboratorio carga con su panel y acepta cambios', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/lab.html');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await expect(page.getByText('Laboratorio visual')).toBeVisible();
  await page.evaluate(() => {
    window.__LAB__!.params.diskIntensity = 8;
    window.__LAB__!.setTilt(50);
    window.__LAB__!.apply();
  });
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/e2e/laboratorio.png' });
});

test('con el agujero negro detrás de la cámara la lente se apaga', async ({ page }) => {
  await page.goto('/lab.html');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => { window.__LAB__!.params.blackHoleX = 0; window.__LAB__!.params.blackHoleY = -200; window.__LAB__!.apply(); });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__GAME__!.diagnostics.lensEnabled)).toBe(0);
});

test('bajar la calidad baja el detalle de los planetas, no sólo la resolución', async ({ page }) => {
  await page.goto('/lab.html');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  expect(await page.evaluate(() => window.__GAME__!.diagnostics.planetOctaves)).toBe(8);
  await page.evaluate(() => window.__LAB__!.setQuality('low'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__GAME__!.diagnostics.planetOctaves)).toBe(4);
});

test('dibuja un cometa cazador', async ({ page }) => {
  await page.goto('/lab.html');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  const before = await page.evaluate(() => window.__GAME__!.diagnostics.calls);
  await page.evaluate(() => {
    const c = window.__GAME__!.world.comets;
    c.mode[0] = 1; c.hp[0] = 3; c.x[0] = c.prevX[0] = 40; c.y[0] = c.prevY[0] = -10; c.vx[0] = -20; c.vy[0] = 8; c.carry[0] = -1;
  });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__GAME__!.diagnostics.calls)).toBeGreaterThan(before);
  await page.screenshot({ path: 'artifacts/e2e/cometa.png' });
});
