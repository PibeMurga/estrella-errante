import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--disable-3d-apis'] } });

test('sin WebGL2 muestra un aviso en español', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.fatal')).toContainText('WebGL2');
});
