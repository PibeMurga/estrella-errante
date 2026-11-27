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
