import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { IGNITION_MASS, STAGE_HYPER, STAGE_IGNITION, STAGES, stageFor, stageProgress } from '../../src/sim/stages';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, KIND_ASTEROID, starSize } from '../../src/sim/world';

describe('etapas: de planeta gaseoso a hipergigante', () => {
  it('cada umbral de masa da su etapa', () => {
    expect(STAGES[stageFor(1)]!.name).toBe('PLANETA GASEOSO');
    expect(STAGES[stageFor(8)]!.name).toBe('GIGANTE GASEOSO');
    expect(STAGES[stageFor(18)]!.name).toBe('ENANA MARRÓN');
    expect(stageFor(IGNITION_MASS)).toBe(STAGE_IGNITION);
    expect(STAGES[STAGE_IGNITION]!.name).toBe('ENANA ROJA');
    expect(STAGES[stageFor(70)]!.name).toBe('ENANA AMARILLA');
    expect(STAGES[stageFor(120)]!.name).toBe('ESTRELLA BLANCA');   // una enana blanca es una estrella muerta: no va
    expect(STAGES[stageFor(175)]!.name).toBe('GIGANTE AZUL');
    expect(STAGES[stageFor(235)]!.name).toBe('SUPERGIGANTE');
    expect(stageFor(1e9)).toBe(STAGES.length - 1);
  });

  it('la hipergigante es la última etapa, desde masa 310', () => {
    expect(STAGES[STAGE_HYPER]!.name).toBe('HIPERGIGANTE');
    expect(STAGES.length - 1).toBe(STAGE_HYPER);
    expect(stageFor(309.9)).toBe(STAGE_HYPER - 1);
    expect(stageFor(310)).toBe(STAGE_HYPER);
  });

  it('el tamaño crece sin saltos hacia atrás: planeta chico, estrella después', () => {
    expect(starSize(1)).toBeLessThan(2.6);                 // más chico que los planetas comunes (2,5 a 7)
    let prev = 0;
    for (let m = 0.5; m < 400; m += 0.5) { const z = starSize(m); expect(z).toBeGreaterThan(prev); prev = z; }
  });

  it('masa negativa o inválida es la primera etapa', () => {
    expect(stageFor(-5)).toBe(0);
    expect(stageFor(Number.NaN)).toBe(0);
  });

  it('el progreso va de 0 a 1 dentro de cada etapa y es 1 en la última', () => {
    expect(stageProgress(0)).toBe(0);
    expect(stageProgress(4)).toBeCloseTo(0.5, 6);
    expect(stageProgress(8)).toBe(0);
    expect(stageProgress(5000)).toBe(1);
  });

  it('al cruzar un umbral la simulación sube de etapa y lo cuenta', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0 }, 1, 10);
    w.star.mass = 7.9;
    expect(w.stage).toBe(0);
    addBody(w, { x: 2, y: 0, vx: 0, vy: 0, radius: 1, kind: KIND_ASTEROID });   // suma 0,75: cruza los 8
    const none: Intent = { targetX: 0, targetY: 0, hasTarget: false };
    step(w, none);
    expect(w.stage).toBe(1);
    expect(w.stageUps).toBe(1);
  });
});

describe('masa máxima de la partida', () => {
  it('recuerda la mayor masa alcanzada aunque después baje', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0, blackHole: false }, 1, 10);
    const none: Intent = { targetX: 0, targetY: 0, hasTarget: false };
    w.star.mass = 40;
    step(w, none);
    w.star.mass = 10;
    step(w, none);
    expect(w.maxMass).toBe(40);
  });
});
