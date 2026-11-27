import { expect, test } from '@playwright/test';

test('las barras de masa; superar al rival siendo hipergigante colapsa solo', async ({ page }) => {
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await expect(page.locator('.hud .race')).toBeVisible();
  await page.evaluate(() => { const w = window.__GAME__!.world; w.star.mass = 2000; w.bh.mass = 1; });
  await page.waitForFunction(() => window.__GAME__!.world.phase === 1, undefined, { timeout: 5_000 });   // sin apretar nada
});

test('supernova, caza, fusión y cartel de victoria', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => { const w = window.__GAME__!.world; w.star.mass = 2000; w.bh.mass = 1; });
  await page.waitForFunction(() => window.__GAME__!.world.phase === 1, undefined, { timeout: 5_000 });   // colapsa solo
  await page.waitForFunction(() => window.__GAME__!.world.phaseTime > 2.15, undefined, { timeout: 8_000 });
  await page.screenshot({ path: 'artifacts/e2e/supernova.png' });
  await page.waitForFunction(() => window.__GAME__!.world.phaseTime > 4.5, undefined, { timeout: 8_000 });
  await page.screenshot({ path: 'artifacts/e2e/nacimiento.png' });
  await page.waitForFunction(() => window.__GAME__!.world.phase === 2, undefined, { timeout: 8_000 });
  await expect(page.locator('.hud .note')).toContainText('CAZA');
  await expect(page.locator('.hud .banner.on')).toContainText('ATRAPÁ AL RIVAL');   // aviso claro al empezar la caza
  await expect(page.locator('.hud.hunting')).toHaveCount(1);   // las alertas del rival pasan a verde
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

test('en la partida normal la capa de cinemática no toca la página en cada cuadro', async ({ page }) => {
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  const writes = await page.evaluate(() => new Promise<number>((resolve) => {
    let n = 0;
    const obs = new MutationObserver((list) => { n += list.length; });
    obs.observe(document.querySelector('.cine')!, { attributes: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(n); }, 1500);
  }));
  expect(writes).toBe(0);
});
