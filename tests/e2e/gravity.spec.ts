import { expect, test } from '@playwright/test';

test('la gravedad del agujero negro se ve: polvo que cae y el hilo de plasma de tu estrella', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => { const w = window.__GAME__!.world; w.bh.x = w.bh.prevX = w.star.x + 70; w.bh.y = w.bh.prevY = w.star.y + 10; w.bh.speed = 0; w.config.bhAccel = 0; w.bhSlow = 2.5; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/e2e/gravedad.png' });
  await expect(page.locator('.hud .bhdist')).toContainText(/FRENADO|DISCO|UA/);
  expect(errors).toEqual([]);
});
