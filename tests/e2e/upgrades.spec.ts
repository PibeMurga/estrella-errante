import { expect, test } from '@playwright/test';

test('al subir de etapa aparece la elección de mejora; con una tecla se toma y sigue la partida', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=20261124&n=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => { window.__GAME__!.world.star.mass = 6.5; });
  await expect(page.locator('.upgrades')).toHaveClass(/on/);
  await expect(page.locator('.upgrades .card .n').first()).not.toBeEmpty();
  await page.screenshot({ path: 'artifacts/e2e/mejoras.png' });
  const t0 = await page.evaluate(() => window.__GAME__!.world.tick);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__GAME__!.world.tick)).toBe(t0);   // en pausa
  await page.keyboard.press('2');
  await expect(page.locator('.upgrades')).not.toHaveClass(/on/);
  expect(await page.evaluate(() => window.__GAME__!.world.upgradesTaken)).toBe(1);
  await page.waitForFunction((t) => window.__GAME__!.world.tick > t, t0);
  expect(errors).toEqual([]);
});
