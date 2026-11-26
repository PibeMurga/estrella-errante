import { describe, expect, it } from 'vitest';
import { FrameTimeRecorder } from '../../src/perf/frameTimes';
import { QualityGovernor } from '../../src/perf/qualityGovernor';
import { lowerQuality } from '../../src/render/quality';

describe('FrameTimeRecorder', () => {
  it('calcula promedio y percentiles', () => {
    const r = new FrameTimeRecorder(200);
    for (let i = 1; i <= 100; i++) r.push(i);
    expect(r.average()).toBeCloseTo(50.5, 10);
    expect(r.percentile(99)).toBe(99);
    expect(r.percentile(50)).toBe(50);
  });

  it('ignora valores inválidos', () => {
    const r = new FrameTimeRecorder(10);
    r.push(Number.NaN); r.push(-3); r.push(10);
    expect(r.count).toBe(1);
    expect(r.average()).toBe(10);
  });

  it('pisa lo más viejo cuando se llena', () => {
    const r = new FrameTimeRecorder(3);
    r.push(1); r.push(2); r.push(3); r.push(4);
    expect(r.count).toBe(3);
    expect(r.average()).toBeCloseTo(3, 10);
  });

  it('vacío devuelve 0', () => {
    const r = new FrameTimeRecorder(3);
    expect(r.average()).toBe(0);
    expect(r.percentile(99)).toBe(0);
  });
});

describe('QualityGovernor', () => {
  const opts = { budgetMs: 18, windowFrames: 180, cooldownFrames: 300 };

  it('baja un nivel cuando el rendimiento empeora respecto de lo normal, una sola vez por ventana', () => {
    const g = new QualityGovernor('high', opts);
    const changes: (string | null)[] = [];
    for (let i = 0; i < 180; i++) g.sample(16);
    for (let i = 0; i < 300; i++) { const c = g.sample(30); if (c) changes.push(c); }
    expect(changes).toEqual(['medium']);
    expect(g.current).toBe('medium');
  });

  it('con el cuadro limitado a 30 Hz desde el arranque no baja la calidad', () => {
    const g = new QualityGovernor('high', opts);
    for (let i = 0; i < 3000; i++) expect(g.sample(33.3)).toBeNull();
  });

  it('no cambia si los cuadros entran en el presupuesto', () => {
    const g = new QualityGovernor('high', opts);
    for (let i = 0; i < 2000; i++) expect(g.sample(16)).toBeNull();
  });

  it('en baja no puede bajar más', () => {
    const g = new QualityGovernor('low', opts);
    for (let i = 0; i < 2000; i++) expect(g.sample(40)).toBeNull();
    expect(lowerQuality('low')).toBeNull();
  });
});
