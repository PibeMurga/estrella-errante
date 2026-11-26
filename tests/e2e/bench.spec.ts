import { expect, test } from '@playwright/test';

test('banco de estrés: 2.000 asteroides y 300 cuerpos', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const quality = process.env['BENCH_QUALITY'] ?? 'high';
  await page.goto(`/bench.html?seconds=10&quality=${quality}`);
  const handle = await page.waitForFunction(() => window.__BENCH_RESULT__, undefined, { timeout: 120_000 });
  const result = (await handle.jsonValue())!;
  await testInfo.attach('resultado', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  console.log(`RESULTADO DEL BANCO ${JSON.stringify(result)}`);
  expect(errors).toEqual([]);
  expect(result.asteroids).toBe(2000);
  expect(result.bodies).toBe(300);
  expect(result.frames).toBeGreaterThan(100);
  if (process.env['BENCH_STRICT'] === '1') {
    expect(result.avgMs).toBeLessThanOrEqual(16.9);
    expect(result.p99Ms).toBeLessThanOrEqual(20);
  }
});
