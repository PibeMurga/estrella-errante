import { expect, test } from '@playwright/test';

test('al empezar elegís el nombre de tu mundo; aparece en el visor y se recuerda', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=20261124');
  const screen = page.locator('.namescreen');
  await expect(screen).toBeVisible();
  // Mientras elegís, la partida no avanza.
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__GAME__!.world.tick)).toBe(0);
  // Sugerir pone un nombre.
  await page.locator('.namescreen .suggest').click();
  expect((await page.locator('.namescreen input').inputValue()).length).toBeGreaterThan(2);
  await page.locator('.namescreen input').fill('táuride');
  await page.screenshot({ path: 'artifacts/e2e/nombre.png' });
  await page.keyboard.press('Enter');
  await expect(screen).toBeHidden();
  await expect(page.locator('.hud .pname')).toHaveText('TÁURIDE');
  await page.waitForFunction(() => window.__GAME__!.world.tick > 30);
  // La próxima vez aparece ya escrito.
  await page.goto('/?seed=20261124');
  await expect(page.locator('.namescreen input')).toHaveValue('TÁURIDE');
  // Un nombre vacío no se acepta: se usa una sugerencia.
  await page.locator('.namescreen input').fill('   ');
  await page.keyboard.press('Enter');
  expect(((await page.locator('.hud .pname').textContent()) ?? '').trim().length).toBeGreaterThan(2);
  expect(errors).toEqual([]);
});

test('al reiniciar no vuelve a preguntar', async ({ page }) => {
  await page.goto('/?seed=20261124&n=1');
  await expect(page.locator('.namescreen')).toBeHidden();
  await page.waitForFunction(() => (window.__GAME__?.world.tick ?? 0) > 30, undefined, { timeout: 45_000 });
});
