import { expect, test } from '@playwright/test';

test('las barras de masa y el aviso de colapso; ESPACIO colapsa', async ({ page }) => {
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await expect(page.locator('.hud .race')).toBeVisible();
  await page.evaluate(() => { const w = window.__GAME__!.world; w.star.mass = 2000; w.bh.mass = 1; });
  await expect(page.locator('.hud .note')).toContainText('COLAPSO DISPONIBLE', { timeout: 5_000 });
  await page.screenshot({ path: 'artifacts/e2e/colapso-disponible.png' });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__GAME__!.world.phase === 1, undefined, { timeout: 5_000 });
});

test('supernova, caza, fusión y cartel de victoria', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => { const w = window.__GAME__!.world; w.star.mass = 2000; w.bh.mass = 1; });
  await expect(page.locator('.hud .note')).toContainText('COLAPSO DISPONIBLE', { timeout: 5_000 });
  await page.screenshot({ path: 'artifacts/e2e/hipergigante.png' });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__GAME__!.world.phaseTime > 2.15, undefined, { timeout: 8_000 });
  await page.screenshot({ path: 'artifacts/e2e/supernova.png' });
  await page.waitForFunction(() => window.__GAME__!.world.phaseTime > 4.5, undefined, { timeout: 8_000 });
  await page.screenshot({ path: 'artifacts/e2e/nacimiento.png' });
  await page.waitForFunction(() => window.__GAME__!.world.phase === 2, undefined, { timeout: 8_000 });
  await expect(page.locator('.hud .note')).toContainText('CAZA');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/e2e/caza.png' });
  await page.evaluate(() => { const w = window.__GAME__!.world; w.bh.x = w.bh.prevX = w.star.x + 3; w.bh.y = w.bh.prevY = w.star.y; });
  await page.waitForFunction(() => window.__GAME__!.world.phaseTime > 3, undefined, { timeout: 8_000 });
  await page.screenshot({ path: 'artifacts/e2e/fusion.png' });
  await page.waitForFunction(() => window.__GAME__!.world.over === 4, undefined, { timeout: 8_000 });
  await expect(page.locator('.gameover.on .title')).toHaveText('FUSIÓN', { timeout: 6_000 });
  await page.waitForTimeout(1300);   // termina el fundido
  await page.screenshot({ path: 'artifacts/e2e/victoria.png' });
  expect(errors).toEqual([]);
});
