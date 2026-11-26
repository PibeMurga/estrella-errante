import { it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { type Intent, step } from '../../src/sim/step';
import { createWorld, FREE, KIND_ASTEROID, MAX_COMETS } from '../../src/sim/world';
import { STAGES } from '../../src/sim/stages';

// Bot de balance: juega 5 partidas sin pantalla e informa cuánto dura, crece y pelea. Correr con: npm run balance
it('bot de balance', () => {
  for (const seed of [11, 22, 33, 44, 55]) {
    const w = createWorld(DEFAULT_CONFIG, seed);
    const intent: Intent = { targetX: 0, targetY: 0, hasTarget: true, fire: false };
    let tgt = -1;
    const t0 = performance.now();
    let worst = 0;
    for (let k = 0; k < 60 * 600 && w.over === 0; k++) {
      const s = w.star, bh = w.bh;
      const dbh = Math.hypot(bh.x - s.x, bh.y - s.y);
      if (dbh < 130) { intent.targetX = s.x - (bh.x - s.x) * 3; intent.targetY = s.y - (bh.y - s.y) * 3; }
      else {
        if (k % 30 === 0 || tgt < 0 || w.state[tgt] !== FREE) {
          let best = Infinity; tgt = -1;
          for (let i = 0; i < w.count; i++) {
            if (w.state[i] !== FREE || w.kind[i] !== KIND_ASTEROID) continue;
            const d = (w.x[i] - s.x) ** 2 + (w.y[i] - s.y) ** 2;
            if (d < best) { best = d; tgt = i; }
          }
        }
        if (tgt >= 0) { intent.targetX = w.x[tgt]; intent.targetY = w.y[tgt]; }
      }
      intent.fire = false;
      for (let c = 0; c < MAX_COMETS; c++) if (w.comets.mode[c] === 1 && Math.hypot(w.comets.x[c]! - s.x, w.comets.y[c]! - s.y) < 70) {
        intent.targetX = w.comets.x[c]!; intent.targetY = w.comets.y[c]!; intent.fire = true;
      }
      const a = performance.now();
      step(w, intent);
      worst = Math.max(worst, performance.now() - a);
    }
    const ms = (performance.now() - t0) / (w.tick || 1);
    console.log(`semilla ${seed}: ${(w.tick / 60).toFixed(0)} s, fin=${w.over}, masaMax=${w.maxMass.toFixed(0)}, etapa=${STAGES[w.stage]!.name}, eclipses=${w.eclipses}, cometas muertos=${w.cometKills}, robos=${w.cometSteals}, choques=${w.hits}, disparos=${w.shots}, órbita=${w.orbitingCount}, absorbidos=${w.absorbed}, bh r=${w.bh.radius.toFixed(1)}, paso medio=${ms.toFixed(3)} ms, peor=${worst.toFixed(2)} ms`);
  }
}, 600_000);
