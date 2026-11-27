import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputController } from '../../src/input/controller';
import { applyDeadzone } from '../../src/input/gamepad';

describe('applyDeadzone', () => {
  const out = { x: 0, y: 0 };
  it('dentro de la zona muerta da cero', () => {
    expect(applyDeadzone(0.1, 0.1, 0.2, out)).toEqual({ x: 0, y: 0 });
  });
  it('a fondo da 1', () => {
    expect(applyDeadzone(1, 0, 0.2, out)).toEqual({ x: 1, y: 0 });
  });
  it('reescala entre la zona muerta y el máximo', () => {
    const r = applyDeadzone(0.6, 0, 0.2, out);
    expect(r.x).toBeCloseTo(0.5, 10);
    expect(r.y).toBe(0);
  });
  it('valores inválidos dan cero', () => {
    expect(applyDeadzone(Number.NaN, 0.5, 0.2, out)).toEqual({ x: 0, y: 0 });
  });
});

function fakeElement() {
  const listeners: Record<string, (e: { clientX: number; clientY: number }) => void> = {};
  const el = {
    addEventListener: (type: string, fn: (e: { clientX: number; clientY: number }) => void) => { listeners[type] = fn; },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  return { el: el as unknown as HTMLElement, listeners };
}

const toWorld = (sx: number, sy: number, out: { x: number; y: number }): boolean => { out.x = sx / 10; out.y = -sy / 10; return true; };

describe('InputController', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin entrada no hay objetivo', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el } = fakeElement();
    expect(new InputController(el, toWorld).poll(0, 0).hasTarget).toBe(false);
  });

  it('el mouse es la mira; con el izquierdo apretado también es hacia donde vas, y al soltar se sigue de largo', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el, listeners } = fakeElement();
    const input = new InputController(el, toWorld);
    const ev = (t: string, e: Record<string, unknown>): void => (listeners[t] as unknown as (e: Record<string, unknown>) => void)(e);
    ev('pointermove', { clientX: 100, clientY: 50 });
    expect(input.poll(0, 0)).toMatchObject({ aimX: 10, aimY: -5, hasAim: true, hasTarget: false });
    ev('pointerdown', { clientX: 100, clientY: 50, button: 0, buttons: 1, pointerId: 1 });
    expect(input.poll(0, 0)).toMatchObject({ targetX: 10, targetY: -5, hasTarget: true });
    ev('pointerup', { button: 0, buttons: 0 });
    expect(input.poll(0, 0).hasTarget).toBe(false);
  });

  it('si el puntero apunta por encima del horizonte mantiene el objetivo anterior', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el, listeners } = fakeElement();
    let ok = true;
    const input = new InputController(el, (sx, sy, out) => { if (!ok) return false; out.x = sx; out.y = sy; return true; });
    (listeners['pointerdown'] as unknown as (e: Record<string, unknown>) => void)({ clientX: 4, clientY: 6, button: 0, buttons: 1, pointerId: 1 });
    expect(input.poll(0, 0)).toMatchObject({ targetX: 4, targetY: 6, hasTarget: true });
    ok = false;
    (listeners['pointermove'] as unknown as (e: Record<string, unknown>) => void)({ clientX: 400, clientY: 600, buttons: 1 });
    expect(input.poll(0, 0)).toMatchObject({ targetX: 4, targetY: 6, hasTarget: true });
  });

  it('el joystick mueve el objetivo desde la estrella y al soltarlo la estrella frena', () => {
    const pad = { axes: [1, 0] };
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    const { el } = fakeElement();
    const input = new InputController(el, toWorld, 40);
    expect(input.poll(10, 5)).toMatchObject({ targetX: 50, targetY: 5, hasTarget: true });
    pad.axes = [0, 0];
    expect(input.poll(12, 6)).toMatchObject({ targetX: 12, targetY: 6, hasTarget: true });
  });

  it('ejes NaN del joystick no producen NaN', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [{ axes: [Number.NaN, Number.NaN] }] });
    const { el } = fakeElement();
    const r = new InputController(el, toWorld).poll(3, 4);
    expect(Number.isFinite(r.targetX) && Number.isFinite(r.targetY)).toBe(true);
  });

  it('con dos joysticks responde al que se mueve aunque el primero esté quieto', () => {
    const pad0 = { axes: [0, 0] };
    const pad1 = { axes: [1, 0] };
    vi.stubGlobal('navigator', { getGamepads: () => [pad0, pad1] });
    const { el } = fakeElement();
    const input = new InputController(el, toWorld, 40);
    expect(input.poll(0, 0)).toMatchObject({ targetX: 40, targetY: 0 });
    expect(input.poll(5, 0)).toMatchObject({ targetX: 45, targetY: 0 });
    pad1.axes = [0, 0];
    expect(input.poll(7, 1)).toMatchObject({ targetX: 7, targetY: 1 });
  });

  it('se puede mover con el izquierdo y cargar con el derecho al mismo tiempo', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el, listeners } = fakeElement();
    const input = new InputController(el, toWorld);
    const ev = (t: string, e: Record<string, unknown>): void => (listeners[t] as unknown as (e: Record<string, unknown>) => void)(e);
    ev('pointerdown', { clientX: 100, clientY: 50, button: 0, buttons: 1, pointerId: 1 });
    ev('pointerdown', { clientX: 100, clientY: 50, button: 2, buttons: 3, pointerId: 1 });
    const it = input.poll(0, 0);
    expect(it.hasTarget).toBe(true);
    expect(it.hold).toBe(true);
    ev('pointermove', { clientX: 120, clientY: 50, buttons: 3 });
    expect(input.poll(0, 0)).toMatchObject({ hasTarget: true, hold: true });
  });

  it('el clic derecho es el botón de lanzar: cuenta aunque se suelte antes del poll, y mantenido sigue apretado', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el, listeners } = fakeElement();
    const input = new InputController(el, toWorld);
    listeners['pointermove']!({ clientX: 10, clientY: 20 });
    expect(input.poll(0, 0).hold).toBe(false);
    const down = listeners['pointerdown'] as unknown as (e: { clientX: number; clientY: number; button: number; pointerId: number }) => void;
    const up = listeners['pointerup'] as unknown as (e: { button: number; type: string }) => void;
    down({ clientX: 10, clientY: 20, button: 2, pointerId: 1 }); up({ button: 2, type: 'pointerup' });
    expect(input.poll(0, 0).hold).toBe(true);    // clic más corto que un cuadro: igual cuenta una vez (toque)
    expect(input.poll(0, 0).hold).toBe(false);
    down({ clientX: 10, clientY: 20, button: 2, pointerId: 1 });
    expect(input.poll(0, 0).hold).toBe(true);
    expect(input.poll(0, 0).hold).toBe(true);    // mantenido: carga el bólido
    up({ button: 2, type: 'pointerup' });
    expect(input.poll(0, 0).hold).toBe(false);
  });

  it('el botón no queda trabado: soltar el izquierdo con otro apretado, o perder la captura, lo suelta', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el, listeners } = fakeElement();
    const input = new InputController(el, toWorld);
    const ev = (t: string, e: Record<string, unknown>): void => (listeners[t] as unknown as (e: Record<string, unknown>) => void)(e);
    ev('pointerdown', { clientX: 10, clientY: 20, button: 2, buttons: 2, pointerId: 1 });
    input.poll(0, 0);
    ev('pointermove', { clientX: 10, clientY: 20, buttons: 1 });   // soltó el derecho, el izquierdo sigue apretado
    expect(input.poll(0, 0).hold).toBe(false);
    ev('pointerdown', { clientX: 10, clientY: 20, button: 2, buttons: 2, pointerId: 1 });
    input.poll(0, 0);
    ev('lostpointercapture', { pointerId: 1 });
    expect(input.poll(0, 0).hold).toBe(false);
  });

  it('el gatillo derecho del joystick es el botón de lanzar mientras se mantiene', () => {
    const pad = { axes: [1, 0], buttons: [] as { pressed: boolean }[] };
    for (let k = 0; k < 8; k++) pad.buttons.push({ pressed: false });
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    const { el } = fakeElement();
    const input = new InputController(el, toWorld);
    pad.buttons[7]!.pressed = true;
    expect(input.poll(0, 0).hold).toBe(true);
    expect(input.poll(0, 0).hold).toBe(true);
    pad.buttons[7]!.pressed = false;
    expect(input.poll(0, 0).hold).toBe(false);
  });

  it('el stick derecho del joystick da una mira propia para la honda', () => {
    const pad = { axes: [0, 0, 0, -1], buttons: [] as { pressed: boolean }[] };
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    const { el } = fakeElement();
    const r = new InputController(el, toWorld, 40).poll(5, 5);
    expect(r.hasAim).toBe(true);
    expect(r.aimX).toBe(5);
    expect(r.aimY).toBe(45);   // stick hacia arriba = y positivo en la simulación
  });
});
