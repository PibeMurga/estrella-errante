import { expect, test } from '@playwright/test';

test('ESC pausa la partida y la retoma', async ({ page }) => {
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause.on')).toBeVisible();
  const t0 = await page.evaluate(() => window.__GAME__!.world.tick);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__GAME__!.world.tick)).toBe(t0);
  await page.screenshot({ path: 'artifacts/e2e/pausa.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause.on')).toHaveCount(0);
  await page.waitForFunction((t) => window.__GAME__!.world.tick > t + 10, t0, { timeout: 5_000 });
});
