import { describe, expect, it } from 'vitest';
import { CameraRig, toWorld } from '../../src/render/cameraRig';

describe('toWorld', () => {
  it('pasa del plano de la simulación al plano XZ', () => {
    expect(toWorld(3, 4, { x: 0, y: 0, z: 0 })).toEqual({ x: 3, y: 0, z: -4 });
  });
});

describe('CameraRig', () => {
  it('ubica la cámara inclinada a la distancia pedida', () => {
    const rig = new CameraRig({ tiltDeg: 35, distance: 150 });
    rig.snap(0, 0);
    expect(rig.position.y).toBeCloseTo(150 * Math.sin((35 * Math.PI) / 180), 8);
    expect(Math.hypot(rig.position.x, rig.position.y, rig.position.z)).toBeCloseTo(150, 8);
  });

  it('el centro de la pantalla cae en el foco', () => {
    const rig = new CameraRig();
    rig.aspect = 16 / 9;
    rig.snap(10, 20);
    const out = { x: 0, y: 0 };
    expect(rig.screenToSim(0, 0, out)).toBe(true);
    expect(out.x).toBeCloseTo(10, 6);
    expect(out.y).toBeCloseTo(20, 6);
  });

  it('arriba en pantalla es más lejos, abajo más cerca y a la derecha más x', () => {
    const rig = new CameraRig();
    rig.aspect = 16 / 9;
    rig.snap(0, 0);
    const up = { x: 0, y: 0 }, down = { x: 0, y: 0 }, right = { x: 0, y: 0 };
    rig.screenToSim(0, 0.5, up);
    rig.screenToSim(0, -0.5, down);
    rig.screenToSim(0.5, 0, right);
    expect(up.y).toBeGreaterThan(0);
    expect(down.y).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
  });

  it('con pantalla más ancha el borde derecho llega más lejos', () => {
    const a = new CameraRig(); a.aspect = 1; a.snap(0, 0);
    const b = new CameraRig(); b.aspect = 2; b.snap(0, 0);
    const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
    a.screenToSim(1, 0, pa);
    b.screenToSim(1, 0, pb);
    expect(pb.x).toBeGreaterThan(pa.x);
  });

  it('el seguimiento no se pasa, no se mueve con dt 0 y no produce NaN', () => {
    const rig = new CameraRig();
    rig.snap(0, 0);
    rig.update(100, 0, 0);
    expect(rig.focus.x).toBe(0);
    rig.update(100, 0, 1000);
    expect(rig.focus.x).toBeLessThanOrEqual(100);
    expect(rig.focus.x).toBeCloseTo(100, 6);
    rig.update(Number.NaN, 5, 0.016);
    rig.update(5, 5, Number.NaN);
    expect(Number.isFinite(rig.focus.x) && Number.isFinite(rig.focus.y)).toBe(true);
    expect(Number.isFinite(rig.position.x) && Number.isFinite(rig.position.z)).toBe(true);
  });

  it('se aleja de a poco a medida que la estrella gana masa', () => {
    const rig = new CameraRig({ distance: 150 });
    rig.snap(0, 0);
    const d0 = rig.distance;
    rig.followMass(1, 1000);
    expect(rig.distance).toBeCloseTo(d0, 6);
    rig.followMass(100, 0.1);
    const d1 = rig.distance;
    expect(d1).toBeGreaterThan(d0);
    rig.followMass(100, 1000);
    expect(rig.distance).toBeGreaterThan(d1);
    expect(rig.distance).toBeLessThanOrEqual(d0 * rig.options.maxZoom + 1e-6);
    rig.followMass(Number.NaN, 0.1);
    expect(Number.isFinite(rig.distance)).toBe(true);
  });

  it('un rayo por encima del horizonte no toca el plano ni cambia la salida', () => {
    const rig = new CameraRig({ tiltDeg: 5 });
    rig.aspect = 16 / 9;
    rig.snap(0, 0);
    const out = { x: 7, y: 9 };
    expect(rig.screenToSim(0, 1, out)).toBe(false);
    expect(out).toEqual({ x: 7, y: 9 });
  });
});

describe('zoom del jugador', () => {
  it('acerca y aleja un poco, de a poco, sin pasar el tope que esconde la costura del mapa', () => {
    const rig = new CameraRig();
    const d0 = rig.distance;
    rig.nudgeZoom(-10);   // acercar todo lo posible
    for (let k = 0; k < 300; k++) rig.followMass(1, 1 / 60);
    expect(rig.distance).toBeLessThan(d0 * 0.8);
    expect(rig.distance).toBeGreaterThan(d0 * 0.6);
    rig.nudgeZoom(10);    // alejar todo lo posible
    for (let k = 0; k < 600; k++) rig.followMass(1e6, 1 / 60);
    expect(rig.distance).toBeLessThanOrEqual(rig.options.distance * rig.options.maxZoom + 1e-6);
  });
});
