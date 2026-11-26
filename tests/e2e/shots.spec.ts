import { test } from '@playwright/test';

const dir = 'artifacts/hito-0';

test('capturas para el puntaje visual', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?seed=20261124');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 120, undefined, { timeout: 60_000 });
  await page.screenshot({ path: `${dir}/1-inicio.png` });

  for (let k = 0; k < 220; k++) {
    const a = k * 0.09;
    await page.mouse.move(960 + Math.cos(a) * 640, 540 + Math.sin(a) * 340);
    await page.waitForTimeout(50);
  }
  await page.screenshot({ path: `${dir}/2-sistema-creciendo.png` });

  await page.goto('/lab.html');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 120, undefined, { timeout: 60_000 });
  await page.evaluate(() => {
    const p = window.__LAB__!.params;
    p.blackHoleX = 30; p.blackHoleY = 25; p.blackHoleRadius = 7;
    window.__LAB__!.apply();
  });
  await page.addStyleTag({ content: '.tp-dfwv, canvas[style*="position: fixed"], div[style*="z-index: 10000"] { display: none !important; }' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/3-agujero-negro-cerca.png` });
});
