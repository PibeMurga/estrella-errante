import { afterEach, describe, expect, it } from 'vitest';
import { InputController } from '../../src/input/controller';

// El control escucha el teclado en la ventana; en Node se simula una ventana mínima.
type Handler = (e: Partial<KeyboardEvent> & { preventDefault(): void }) => void;
const handlers: Handler[] = [];
const g = globalThis as unknown as { window?: unknown };

function setup(): InputController {
  g.window = { addEventListener: (t: string, h: Handler) => { if (t === 'keydown') handlers.push(h); } };
  const el = { addEventListener: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLElement;
  return new InputController(el, () => false);
}
const key = (k: Partial<KeyboardEvent>): boolean => {
  let prevented = false;
  for (const h of handlers) h({ repeat: false, ctrlKey: false, metaKey: false, altKey: false, target: null, ...k, preventDefault: () => { prevented = true; } });
  return prevented;
};
afterEach(() => { handlers.length = 0; delete g.window; });

describe('tecla de colapso', () => {
  it('ESPACIO pide el colapso una vez', () => {
    const c = setup();
    key({ key: ' ' });
    expect(c.poll(0, 0).collapse).toBe(true);
  });
  it('la autorrepetición, Ctrl+C y lo que se escribe en un campo de texto no colapsan', () => {
    const c = setup();
    key({ key: ' ', repeat: true });
    key({ key: 'c', ctrlKey: true });
    const prevented = key({ key: 'c', target: { tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget });
    expect(prevented).toBe(false);
    expect(c.poll(0, 0).collapse).toBe(false);
  });
  it('la C no bloquea la tecla (sólo el espacio, para que no desplace la página)', () => {
    setup();
    expect(key({ key: 'c' })).toBe(false);
    expect(key({ key: ' ' })).toBe(true);
  });
});
