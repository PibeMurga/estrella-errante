import { expect, test } from '@playwright/test';

test('arrancás como planeta gaseoso, pasás por enana marrón y te encendés: ignición', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=20261124&n=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await expect(page.locator('.hud .stage .name')).toHaveText('PLANETA GASEOSO');
  await page.mouse.move(640, 360);
  for (let k = 0; k < 6; k++) await page.mouse.wheel(0, -100);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/e2e/ign-0-planeta.png' });
  await page.evaluate(() => { window.__GAME__!.world.star.mass = 25; });
  await page.waitForTimeout(1500);
  await expect(page.locator('.hud .stage .name')).toHaveText('ENANA MARRÓN');
  await page.screenshot({ path: 'artifacts/e2e/ign-1-enana-marron.png' });
  await page.evaluate(() => { window.__GAME__!.world.star.mass = 30.2; });
  await page.waitForFunction(() => window.__GAME__!.world.phase === 4, undefined, { timeout: 5_000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/e2e/ign-2-compresion.png' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'artifacts/e2e/ign-3-destello.png' });
  await page.waitForFunction(() => window.__GAME__!.world.ignited, undefined, { timeout: 8_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/e2e/ign-4-estrella.png' });
  await expect(page.locator('.hud .stage .name')).toHaveText('ENANA ROJA');
  expect(errors).toEqual([]);
});
