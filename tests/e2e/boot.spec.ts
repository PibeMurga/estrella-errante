import { expect, test } from '@playwright/test';

test('la página del juego carga con su título y su canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('MAGNAR');
  await expect(page.locator('canvas#game')).toBeVisible();
});
