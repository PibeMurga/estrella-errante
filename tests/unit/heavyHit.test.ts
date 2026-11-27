import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { step } from '../../src/sim/step';
import { addBody, createWorld, KIND_ASTEROID, KIND_ROCKY, ORBITING, starSize } from '../../src/sim/world';

const cfg = { ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false, cometFirst: 1e9 };

describe('choque pesado contra un planeta más grande', () => {
  it('no rebota como una pelota, y seguir empujando no te pega una y otra vez', () => {
    const w = createWorld(cfg, 3, 120);
    w.star.mass = 60;
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * Math.PI * 2;
      const i = addBody(w, { x: Math.cos(a) * 9, y: Math.sin(a) * 9, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
      w.state[i] = ORBITING; w.orbitR[i] = 9; w.orbitTarget[i] = 9; w.orbitAngle[i] = a; w.orbitingCount++;
    }
    const E = starSize(w.star.mass);
    const p = addBody(w, { x: 60, y: 0, vx: 0, vy: 0, radius: E * 1.3, kind: KIND_ROCKY });
    let maxBack = 0, hit = false;
    for (let k = 0; k < 300; k++) {
      step(w, { targetX: w.x[p], targetY: w.y[p], hasTarget: true });   // empujando siempre contra el planeta
      if (w.hits > 0 && !hit) hit = true;
      if (hit) maxBack = Math.max(maxBack, -w.star.vx);
    }
    expect(hit).toBe(true);
    expect(maxBack).toBeLessThan(DEFAULT_CONFIG.starMaxSpeed * 0.4);   // sale despedida despacio, no como una pelota
    expect(w.hits).toBeLessThanOrEqual(3);   // en 5 s empujando, como mucho uno cada vez que se termina la invulnerabilidad
  });
});
