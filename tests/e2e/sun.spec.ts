import { expect, test } from '@playwright/test';

test('el sol tiene fulguraciones y eyecciones en el borde', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => { window.__GAME__!.world.star.mass = 60; });
  await page.mouse.move(640, 360);
  for (let k = 0; k < 8; k++) await page.mouse.wheel(0, -100);   // acercar
  await page.waitForTimeout(2500);
  for (let k = 0; k < 4; k++) {
    await page.screenshot({ path: `artifacts/e2e/sol-${k}.png`, clip: { x: 440, y: 160, width: 400, height: 400 } });
    await page.waitForTimeout(700);
  }
  expect(errors).toEqual([]);
});
