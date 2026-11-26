import { expect, type Page, test } from '@playwright/test';

async function boot(page: Page): Promise<void> {
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
}

test('el visor muestra la etapa, el tiempo y los mundos', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.hud .stage .name')).toHaveText('ENANA ROJA');
  await expect(page.locator('.hud .worlds')).toContainText('MUNDOS');
  await expect(page.locator('.hud .bhinfo')).toContainText('UA');
});

test('con el agujero negro fuera de pantalla aparece la flecha en el borde', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.hud .arrow')).toBeVisible();
  await expect(page.locator('.hud .brackets')).toBeHidden();
  await page.evaluate(() => { const bh = window.__GAME__!.world.bh; bh.x = bh.prevX = 55; bh.y = bh.prevY = 35; });
  await expect(page.locator('.hud .brackets')).toBeVisible();
  await expect(page.locator('.hud .arrow')).toBeHidden();
  await page.screenshot({ path: 'artifacts/e2e/visor.png' });
});

test('la barra de etapa avanza con la masa', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { window.__GAME__!.world.star.mass = 10; });
  await expect(page.locator('.hud .stage .pct')).toHaveText('50%');
  expect(await page.locator('.hud .seg i:not(.o)').count()).toBe(12);
});
