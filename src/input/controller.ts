import type { Intent } from '../sim/step';
import { applyDeadzone } from './gamepad';

// Convierte un píxel (relativo al elemento) a coordenadas de la simulación.
// Devuelve false si el punto no corta el plano de juego (por encima del horizonte).
export type ToWorld = (sx: number, sy: number, out: { x: number; y: number }) => boolean;

export class InputController {
  private readonly intent: Intent = { targetX: 0, targetY: 0, hasTarget: false, fire: false };
  private readonly world = { x: 0, y: 0 };
  private readonly stick = { x: 0, y: 0 };
  private pointerX = 0;
  private pointerY = 0;
  private hasPointer = false;
  private usingGamepad = false;
  private firePending = false;   // clic o gatillo todavía no entregado
  private triggerHeld = false;

  constructor(el: HTMLElement, private readonly toWorld: ToWorld, private readonly reach = 40) {
    el.addEventListener('pointermove', (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointerX = e.clientX - r.left;
      this.pointerY = e.clientY - r.top;
      this.hasPointer = true;
      this.usingGamepad = false;
    });
    // Clic izquierdo: honda. El disparo queda en la intención hasta que el bucle lo use en un paso.
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0) return;
      const r = el.getBoundingClientRect();
      this.pointerX = e.clientX - r.left;
      this.pointerY = e.clientY - r.top;
      this.hasPointer = true;
      this.firePending = true;
    });
  }

  poll(starX: number, starY: number): Intent {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    // Gatillo derecho (botón 7) de cualquier joystick: dispara al apretarlo.
    let trigger = false;
    for (let k = 0; k < pads.length; k++) if (pads[k]?.buttons?.[7]?.pressed) trigger = true;
    if (trigger && !this.triggerHeld) this.firePending = true;
    this.triggerHeld = trigger;
    this.intent.fire = this.intent.fire === true || this.firePending;
    this.firePending = false;
    // Se revisan todos los joysticks: manda el primero que tenga el stick movido.
    for (let k = 0; k < pads.length; k++) {
      const p = pads[k];
      if (!p) continue;
      applyDeadzone(p.axes[0] ?? 0, p.axes[1] ?? 0, 0.2, this.stick);
      if (this.stick.x !== 0 || this.stick.y !== 0) {
        this.usingGamepad = true;
        this.intent.targetX = starX + this.stick.x * this.reach;
        this.intent.targetY = starY - this.stick.y * this.reach;   // en el joystick, Y positivo es abajo
        this.intent.hasTarget = true;
        return this.intent;
      }
    }
    // Ningún stick activo: si se venía jugando con joystick, la estrella frena.
    if (this.usingGamepad) {
      this.intent.targetX = starX;
      this.intent.targetY = starY;
      this.intent.hasTarget = true;
      return this.intent;
    }
    if (this.hasPointer && this.toWorld(this.pointerX, this.pointerY, this.world)) {
      this.intent.targetX = this.world.x;
      this.intent.targetY = this.world.y;
      this.intent.hasTarget = true;
    }
    return this.intent;
  }
}
