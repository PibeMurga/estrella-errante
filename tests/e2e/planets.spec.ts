import { expect, test } from '@playwright/test';

test('marcas de peligro alrededor de los planetas cercanos, y el visor del sistema', async ({ page }) => {
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await expect(page.locator('.hud .sys')).toContainText('PLANETAS');
  // Acercar a la estrella un planeta de cada escalón (sin que la toquen).
  await page.evaluate(() => {
    const w = window.__GAME__!.world; const s = w.star; const E = s.mass < 30 ? 0.6 + Math.sqrt(s.mass) + 0.13 * s.mass : 11 + 0.75 * Math.sqrt(s.mass);
    const set = (k: number, dx: number, dy: number, r: number): void => { const p = w.planets[k]!; w.x[p] = w.prevX[p] = s.x + dx; w.y[p] = w.prevY[p] = s.y + dy; w.vx[p] = 0; w.vy[p] = 0; w.radius[p] = r; w.mass[p] = r ** 3; };
    set(0, 22, 0, E * 0.8); set(1, -24, 0, E * 1.3); set(2, 0, 26, E * 1.8);
  });
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.__GAME__!.diagnostics.dangerMarks)).toBeGreaterThanOrEqual(3);   // puede haber otro planeta cerca en el mapa
  await page.screenshot({ path: 'artifacts/e2e/marcas-de-peligro.png' });
});

test('los planetas partidos conservan el aspecto de su tipo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => {
    const w = window.__GAME__!.world; const s = w.star;
    // Partir cuatro planetas rocosos o helados y ponerlos a la vista (sin tocar la estrella).
    let n = 0;
    for (let q = 0; q < w.planets.length && n < 4; q++) {
      const p = w.planets[q]!;
      if (w.kind[p] !== 1 && w.kind[p] !== 2) continue;
      const a = n * 1.6;
      w.x[p] = w.prevX[p] = s.x + Math.cos(a) * 24; w.y[p] = w.prevY[p] = s.y + Math.sin(a) * 24;
      w.vx[p] = 0; w.vy[p] = 0; w.radius[p] = 4; w.mass[p] = 64;
      w.broken[p] = 40; w.breakAx[p] = 1; w.breakAy[p] = 0.3;
      n++;
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/e2e/planetas-partidos.png' });
  expect(errors).toEqual([]);
});

test('los dos pedazos de un planeta partido se ven separados, cada uno por su lado', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => {
    const w = window.__GAME__!.world; const s = w.star;
    let n = 0;
    for (let q = 0; q < w.planets.length && n < 3; q++) {
      const p = w.planets[q]!, t = w.twin[p]!;
      if ((w.kind[p] !== 1 && w.kind[p] !== 2) || t < 0) continue;
      const a = n * 2.1, cx = s.x + Math.cos(a) * 26, cy = s.y + Math.sin(a) * 26;
      // Como lo deja la simulación al partirlo: dos cuerpos con medio volumen cada uno, separados por el eje.
      for (const [b, sd] of [[p, 1], [t, -1]] as const) {
        w.state[b] = 0; w.parent[b] = -1; w.halfSide[b] = sd; w.broken[b] = 20; w.breakAx[b] = 1; w.breakAy[b] = 0.2;
        w.x[b] = w.prevX[b] = cx + sd * 3.5; w.y[b] = w.prevY[b] = cy + sd * 0.7; w.vx[b] = 0; w.vy[b] = 0;
        w.radius[b] = 3.2; w.mass[b] = 3.2 ** 3;
      }
      n++;
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/e2e/pedazos-sueltos.png' });
  expect(errors).toEqual([]);
});

test('un asteroide que le pega a un planeta deja una pequeña explosión en el terreno', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => {
    const w = window.__GAME__!.world; const s = w.star;
    const p = w.planets[0]!;
    w.x[p] = w.prevX[p] = s.x + 26; w.y[p] = w.prevY[p] = s.y; w.vx[p] = w.vy[p] = 0;
    // Dos golpes: uno de honda y uno de bólido, en dos puntos del terreno.
    const put = (k: number, ang: number, sz: number): void => { w.impacts[k * 4] = p; w.impacts[k * 4 + 1] = ang; w.impacts[k * 4 + 2] = sz; };
    put(w.impactCount % 16, Math.PI, 0.45); put((w.impactCount + 1) % 16, 2.2, 1);
    w.impactCount += 2;
  });
  for (const ms of [60, 250, 600]) {
    await page.waitForTimeout(ms === 60 ? 60 : ms === 250 ? 190 : 350);
    await page.screenshot({ path: `artifacts/e2e/impacto-terreno-${ms}.png`, clip: { x: 640, y: 220, width: 320, height: 280 } });
  }
  expect(errors).toEqual([]);
});

test('los golpes dejan cráteres en el planeta y, en los que se pueden partir, grietas al rojo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  await page.evaluate(() => {
    const w = window.__GAME__!.world; const s = w.star;
    let p = -1;
    for (let q = 0; q < w.planets.length; q++) { const i = w.planets[q]!; if (w.kind[i] === 1 || w.kind[i] === 2) { p = i; break; } }
    w.x[p] = w.prevX[p] = s.x + 24; w.y[p] = w.prevY[p] = s.y; w.vx[p] = w.vy[p] = 0; w.radius[p] = 6; w.mass[p] = 216;
    w.planetDmg[p] = 12;
    for (let k = 0; k < 4; k++) {
      const o = (w.impactCount % 16) * 4;
      w.impacts[o] = p; w.impacts[o + 1] = Math.PI + (k - 1.5) * 0.35; w.impacts[o + 2] = k % 2 ? 1 : 0.45;
      w.impactCount++;
    }
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'artifacts/e2e/crateres.png', clip: { x: 640, y: 200, width: 360, height: 320 } });
  expect(errors).toEqual([]);
});

test('cada ruptura de un planeta tiene su propia explosión', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?seed=20261124&estrella=1');
  await page.waitForFunction(() => (window.__GAME__?.diagnostics.frames ?? 0) > 30, undefined, { timeout: 45_000 });
  for (let k = 0; k < 4; k++) {
    await page.evaluate((kind) => {
      const w = window.__GAME__!.world; const s = w.star;
      w.breakFxCount += 1; w.breakFxX = s.x + 22; w.breakFxY = s.y; w.breakFxR = 5; w.breakFxKind = kind; w.breakFxAx = 0.8; w.breakFxAy = 0.6;
    }, [1, 2, 3, 1][k]!);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `artifacts/e2e/ruptura-${k}.png`, clip: { x: 640, y: 180, width: 360, height: 360 } });
  }
  expect(errors).toEqual([]);
});
