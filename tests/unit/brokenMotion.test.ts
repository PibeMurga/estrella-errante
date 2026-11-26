import { describe, expect, it } from 'vitest';
import { breakHeat, capCentroid, capVolume, cutOffset, halfSeparation, halfTumble } from '../../src/render/bodies/brokenPlanets';

// El planeta partido evoluciona muy despacio: las mitades se siguen alejando y volcando durante minutos.
describe('movimiento del planeta partido', () => {
  it('las mitades se separan de golpe al partirse y después muy despacio, sin parar', () => {
    expect(halfSeparation(0)).toBe(0);
    expect(halfSeparation(3)).toBeGreaterThan(0.3);
    let prev = halfSeparation(3);
    for (let t = 30; t <= 900; t += 30) { const s = halfSeparation(t); expect(s).toBeGreaterThan(prev); prev = s; }
    expect(halfSeparation(60) - halfSeparation(30)).toBeLessThan(0.15);  // lento: poco más de un décimo de radio cada medio minuto
    expect(halfSeparation(1e5)).toBeLessThan(2);                         // y no se dispersan para siempre
  });

  it('el vuelco arranca en cero, es suave y da menos de una vuelta en cinco minutos', () => {
    const rate = 0.015;   // el más rápido
    expect(halfTumble(0, rate)).toBe(0);
    expect(halfTumble(1, rate)).toBeLessThan(0.01);
    expect(halfTumble(300, rate)).toBeGreaterThan(1);
    expect(halfTumble(300, rate)).toBeLessThan(2 * Math.PI);
  });

  it('el calor baja con el tiempo hasta un rescoldo y después se apaga', () => {
    expect(breakHeat(0)).toBeCloseTo(1);
    expect(breakHeat(120)).toBeLessThan(0.2);    // a los dos minutos queda un rescoldo
    expect(breakHeat(120)).toBeGreaterThan(0.1);
    expect(breakHeat(900)).toBeLessThan(0.01);   // y a los quince ya está frío
  });

  it('el corte cae a distintas alturas: pedazos de tamaños distintos', () => {
    let lo = 1, hi = -1;
    for (let i = 0; i < 200; i++) { const h = cutOffset((i * 0.6180339) % 1); lo = Math.min(lo, h); hi = Math.max(hi, h); expect(Math.abs(h)).toBeLessThanOrEqual(0.45); }
    expect(lo).toBeLessThan(-0.3);
    expect(hi).toBeGreaterThan(0.3);
  });

  it('los volúmenes de los dos pedazos suman el planeta y el centro de masa de una mitad está a 3/8', () => {
    for (const h of [-0.4, -0.1, 0, 0.25, 0.45]) expect(capVolume(h) + capVolume(-h)).toBeCloseTo(1, 10);
    expect(capVolume(0)).toBeCloseTo(0.5, 10);
    expect(capCentroid(0)).toBeCloseTo(3 / 8, 10);
    expect(capCentroid(0.4)).toBeGreaterThan(capCentroid(0));   // el pedazo chico tiene su centro más afuera
  });
});
