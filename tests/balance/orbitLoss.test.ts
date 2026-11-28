import { it } from 'vitest';
import { GAME_CONFIG } from '../../src/sim/config';
import { chooseUpgrade } from '../../src/sim/upgrades';
import { type Intent, step } from '../../src/sim/step';
import { createWorld, FREE, KIND_ASTEROID } from '../../src/sim/world';

// Diagnóstico: ¿dónde pierde la órbita muchos cuerpos de golpe? Corre un bot y anota las caídas grandes con los
// contadores que cambiaron en ese segundo.
it('caídas de órbita', () => {
  const keys = ['fractures', 'cometSteals', 'rockHits', 'hits', 'graveHits', 'planetSteals', 'smallHits', 'shots', 'bolts', 'starBurns', 'planetCrashes', 'contactHits', 'diskGrazes', 'tidalBreaks', 'absorbed', 'disintegrated'] as const;
  for (const seed of [11, 22, 33, 44, 55]) {
    const w = createWorld({ ...GAME_CONFIG, upgrades: true }, seed) as any;
    const intent: Intent = { targetX: 0, targetY: 0, hasTarget: true, fire: false };
    let tgt = -1;
    const hist: number[] = [];
    const snaps: Record<string, number>[] = [];
    for (let k = 0; k < 60 * 420 && w.over === 0; k++) {
      const s = w.star;
      if (k % 30 === 0 || tgt < 0 || w.state[tgt] !== FREE) {
        let best = Infinity; tgt = -1;
        for (let i = 0; i < w.count; i++) {
          if (w.state[i] !== FREE || w.kind[i] !== KIND_ASTEROID) continue;
          const d = (w.x[i] - s.x) ** 2 + (w.y[i] - s.y) ** 2;
          if (d < best) { best = d; tgt = i; }
        }
      }
      if (tgt >= 0) { intent.targetX = w.x[tgt]; intent.targetY = w.y[tgt]; }
      intent.hasTarget = (k % 600) < 420;   // a ratos suelto (va suelto y lo acopla lo que más tira)
      if (w.choosing) chooseUpgrade(w, 0);
      const orb: number[] = []; if (w.orbitingCount > 8) for (let i = 0; i < w.count; i++) if (w.state[i] === 1) orb.push(i);
      const ph = w.phase, oc = w.orbitingCount;
      step(w, intent);
      if (oc - w.orbitingCount >= 5) {
        const st: Record<number, number> = {}; for (const i of orb) if (w.state[i] !== 1) st[w.state[i]] = (st[w.state[i]] ?? 0) + 1;
        console.log(`  paso t=${(k / 60).toFixed(2)} órbita ${oc}→${w.orbitingCount} fase ${ph}→${w.phase} estados nuevos ${JSON.stringify(st)} carga ${w.charge.toFixed(2)} juntados ${w.gathered} escudo ${w.shielding}`);
      }
      hist.push(w.orbitingCount);
      const snap: Record<string, number> = {}; for (const key of keys) snap[key] = w[key] ?? 0; snap['tide'] = w.tide; snap['inDisk'] = w.inDisk; snap['integrity'] = w.integrity;
      snaps.push(snap);
      if (hist.length > 60) {
        const before = hist[hist.length - 61]!, now = w.orbitingCount;
        if (before - now >= 10 && before - now >= before * 0.3) {
          const a = snaps[snaps.length - 61]!, diff: string[] = [];
          for (const key of Object.keys(snap)) if (snap[key] !== a[key]) diff.push(`${key} ${typeof a[key] === 'number' ? a[key].toFixed(2) : a[key]}→${snap[key]!.toFixed(2)}`);
          console.log(`semilla ${seed} t=${(k / 60).toFixed(1)} s · órbita ${before}→${now} · masa ${s.mass.toFixed(1)} · ignited ${w.ignited} · ${diff.join(', ')}`);
          hist.length = 0; snaps.length = 0;
        }
      }
    }
  }
}, 600_000);
