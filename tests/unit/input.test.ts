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

  it('el mouse define el objetivo en coordenadas del mundo y lo mantiene si sale de la ventana', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el, listeners } = fakeElement();
    const input = new InputController(el, toWorld);
    listeners['pointermove']!({ clientX: 100, clientY: 50 });
    expect(input.poll(0, 0)).toMatchObject({ targetX: 10, targetY: -5, hasTarget: true });
    expect(input.poll(0, 0)).toMatchObject({ targetX: 10, targetY: -5, hasTarget: true });
  });

  it('si el puntero apunta por encima del horizonte mantiene el objetivo anterior', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el, listeners } = fakeElement();
    let ok = true;
    const input = new InputController(el, (sx, sy, out) => { if (!ok) return false; out.x = sx; out.y = sy; return true; });
    listeners['pointermove']!({ clientX: 4, clientY: 6 });
    expect(input.poll(0, 0)).toMatchObject({ targetX: 4, targetY: 6, hasTarget: true });
    ok = false;
    listeners['pointermove']!({ clientX: 400, clientY: 600 });
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

  it('el clic dispara la honda una sola vez hasta que se use', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const { el, listeners } = fakeElement();
    const input = new InputController(el, toWorld);
    listeners['pointermove']!({ clientX: 10, clientY: 20 });
    expect(input.poll(0, 0).fire).toBeFalsy();
    (listeners['pointerdown'] as unknown as (e: { clientX: number; clientY: number; button: number }) => void)({ clientX: 10, clientY: 20, button: 0 });
    const r = input.poll(0, 0);
    expect(r.fire).toBe(true);
    r.fire = false;   // el bucle lo apaga después de usarlo en un paso
    expect(input.poll(0, 0).fire).toBe(false);
  });

  it('el gatillo derecho del joystick dispara al apretarlo, no mientras se mantiene', () => {
    const pad = { axes: [1, 0], buttons: [] as { pressed: boolean }[] };
    for (let k = 0; k < 8; k++) pad.buttons.push({ pressed: false });
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    const { el } = fakeElement();
    const input = new InputController(el, toWorld);
    pad.buttons[7]!.pressed = true;
    const r = input.poll(0, 0);
    expect(r.fire).toBe(true);
    r.fire = false;
    expect(input.poll(0, 0).fire).toBe(false);
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
