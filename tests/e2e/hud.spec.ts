import { expect, type Page, test } from '@playwright/test';

async function boot(page: Page): Promise<void> {
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
}

test('el visor muestra la etapa, el tiempo y lo que hay en órbita', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.hud .stage .name')).toHaveText('ENANA ROJA');
  await expect(page.locator('.hud .worlds')).toContainText('EN ÓRBITA');
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
  await page.evaluate(() => { const w = window.__GAME__!.world; w.star.mass = 50; w.invuln = 99; });   // la mitad de la enana roja (de 30 a 70); sin golpes que la cambien
  await expect(page.locator('.hud .stage .pct')).toHaveText('50%');
  expect(await page.locator('.hud .seg i:not(.o)').count()).toBe(12);
});

test('la flecha apunta hacia donde está el agujero negro en pantalla', async ({ page }) => {
  await boot(page);
  // Arriba en el mapa (lejos, hacia el horizonte): la flecha va al borde de arriba, centrada.
  await page.evaluate(() => { const w = window.__GAME__!.world; w.bh.x = w.bh.prevX = w.star.x; w.bh.y = w.bh.prevY = w.star.y + 260; });
  await page.waitForTimeout(300);
  const up = await page.locator('.hud .arrow').boundingBox();
  expect(up!.y).toBeLessThan(120);
  expect(Math.abs(up!.x + up!.width / 2 - 640)).toBeLessThan(120);
  // Abajo a la izquierda: la flecha queda en la mitad izquierda e inferior.
  await page.evaluate(() => { const w = window.__GAME__!.world; w.bh.x = w.bh.prevX = w.star.x - 300; w.bh.y = w.bh.prevY = w.star.y - 220; });
  await page.waitForTimeout(300);
  const dl = await page.locator('.hud .arrow').boundingBox();
  expect(dl!.x).toBeLessThan(640);
  expect(dl!.y).toBeGreaterThan(360);
});
