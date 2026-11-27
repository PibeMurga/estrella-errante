import { expect, test } from '@playwright/test';

test('mantener el clic arma un bólido y al soltar sale', async ({ page }) => {
  // Para que capture rápido: la estrella se mueve en círculo por zonas con asteroides.
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  for (let k = 0; k < 160 && (await page.evaluate(() => window.__GAME__!.world.orbitingCount)) < 15; k++) {
    const a = k * 0.15; await page.mouse.move(640 + Math.cos(a) * 420, 360 + Math.sin(a) * 220); await page.waitForTimeout(50);
  }
  await page.mouse.move(900, 360);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await expect(page.locator('.hud .sling')).toContainText('BÓLIDO');
  await page.screenshot({ path: 'artifacts/e2e/bolido-cargando.png' });
  await page.mouse.up();
  await page.waitForFunction(() => window.__GAME__!.world.bolts === 1, undefined, { timeout: 3_000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/e2e/bolido-sale.png' });
  expect(await page.evaluate(() => window.__GAME__!.world.lastBoltSize)).toBeGreaterThan(3);
});

test('un clic rápido es un toque (honda), y soltar fuera de la ventana no deja el botón trabado', async ({ page }) => {
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  for (let k = 0; k < 160 && (await page.evaluate(() => window.__GAME__!.world.orbitingCount)) < 5; k++) {
    const a = k * 0.15; await page.mouse.move(640 + Math.cos(a) * 420, 360 + Math.sin(a) * 220); await page.waitForTimeout(50);
  }
  await page.mouse.click(900, 360);
  await page.waitForFunction(() => window.__GAME__!.world.shots >= 1, undefined, { timeout: 3_000 });
  await page.mouse.move(900, 360); await page.mouse.down(); await page.mouse.move(1500, 900); await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__GAME__!.world.charge)).toBe(0);
});
