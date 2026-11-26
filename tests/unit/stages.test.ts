import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/sim/config';
import { STAGES, stageFor, stageProgress } from '../../src/sim/stages';
import { type Intent, step } from '../../src/sim/step';
import { addBody, createWorld, KIND_ASTEROID } from '../../src/sim/world';

describe('etapas de la estrella', () => {
  it('cada umbral de masa da su etapa', () => {
    expect(stageFor(0)).toBe(0);
    expect(stageFor(24.9)).toBe(0);
    expect(stageFor(25)).toBe(1);
    expect(stageFor(80)).toBe(2);
    expect(stageFor(200)).toBe(3);
    expect(stageFor(450)).toBe(4);
    expect(stageFor(1e9)).toBe(STAGES.length - 1);
  });

  it('masa negativa o inválida es la primera etapa', () => {
    expect(stageFor(-5)).toBe(0);
    expect(stageFor(Number.NaN)).toBe(0);
  });

  it('el progreso va de 0 a 1 dentro de cada etapa y es 1 en la última', () => {
    expect(stageProgress(0)).toBe(0);
    expect(stageProgress(12.5)).toBeCloseTo(0.5, 6);
    expect(stageProgress(25)).toBe(0);
    expect(stageProgress(5000)).toBe(1);
  });

  it('al cruzar un umbral la simulación sube de etapa y lo cuenta', () => {
    const w = createWorld({ ...DEFAULT_CONFIG, asteroidCount: 0, planetCount: 0 }, 1, 10);
    w.star.mass = 24.9;
    expect(w.stage).toBe(0);
    addBody(w, { x: 2, y: 0, vx: 0, vy: 0, radius: 0.5, kind: KIND_ASTEROID });
    const none: Intent = { targetX: 0, targetY: 0, hasTarget: false };
    step(w, none);
    expect(w.stage).toBe(1);
    expect(w.stageUps).toBe(1);
  });
});
