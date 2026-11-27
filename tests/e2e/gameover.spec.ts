import { expect, test } from '@playwright/test';

test('al terminar la partida aparece el cartel y el clic arranca una nueva', async ({ page }) => {
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => window.__GAME__!.forceOver!(1));
  await expect(page.locator('.gameover.on .title')).toHaveText('ESTRELLA TRAGADA', { timeout: 5_000 });
  await expect(page.locator('.gameover .stats')).toContainText('MASA MÁXIMA');
  await expect(page.locator('.hud')).toBeHidden();
  await page.waitForTimeout(1300);   // termina el fundido
  await page.screenshot({ path: 'artifacts/e2e/fin-de-partida.png' });
  await page.mouse.click(640, 360);
  await page.waitForURL((u) => u.searchParams.get('seed') !== '20261124', { timeout: 10_000 });
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  expect(await page.evaluate(() => window.__GAME__!.world.over)).toBe(0);
  await expect(page.locator('.gameover.on')).toHaveCount(0);
});

test('la tecla R también reinicia', async ({ page }) => {
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => window.__GAME__!.forceOver!(2));
  await expect(page.locator('.gameover.on .title')).toHaveText('ESTRELLA APAGADA', { timeout: 5_000 });
  await page.keyboard.press('r');
  await page.waitForURL((u) => u.searchParams.get('seed') !== '20261124', { timeout: 10_000 });
});
