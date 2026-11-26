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
