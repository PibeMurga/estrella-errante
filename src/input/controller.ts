import type { Intent } from '../sim/step';
import { applyDeadzone } from './gamepad';

// Convierte un píxel (relativo al elemento) a coordenadas de la simulación.
// Devuelve false si el punto no corta el plano de juego (por encima del horizonte).
export type ToWorld = (sx: number, sy: number, out: { x: number; y: number }) => boolean;

export class InputController {
  private readonly intent: Intent = { targetX: 0, targetY: 0, hasTarget: false, fire: false, aimX: 0, aimY: 0, hasAim: false };
  private readonly aimStick = { x: 0, y: 0 };
  private readonly world = { x: 0, y: 0 };
  private readonly stick = { x: 0, y: 0 };
  private pointerX = 0;
  private pointerY = 0;
  private hasPointer = false;
  private usingGamepad = false;
  private pointerHeld = false;    // clic derecho apretado ahora (disparo)
  private pressPending = false;   // hubo un clic derecho desde el último poll (aunque ya se haya soltado)
  private moveHeld = false;       // clic izquierdo apretado: tu cuerpo va hacia el mouse
  private hadWorld = false;       // hubo al menos un punto válido del puntero

  constructor(el: HTMLElement, private readonly toWorld: ToWorld, private readonly reach = 40) {
    el.addEventListener('pointermove', (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointerX = e.clientX - r.left;
      this.pointerY = e.clientY - r.top;
      this.hasPointer = true;
      this.usingGamepad = false;
      // Si se soltó un botón con otro apretado, no llega pointerup: se mira qué botones siguen abajo.
      if (typeof e.buttons === 'number') { if ((e.buttons & 2) === 0) this.pointerHeld = false; if ((e.buttons & 1) === 0) this.moveHeld = false; }
    });
    // Clic izquierdo mantenido: tu cuerpo va hacia el mouse (al soltar sigue con su inercia).
    // Clic derecho: lanzar hacia el mouse. Un toque es la honda; mantenido carga el bólido (lo decide la simulación).
    // Se captura el puntero para que soltar fuera de la ventana también llegue y el botón no quede trabado.
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      const r = el.getBoundingClientRect();
      this.pointerX = e.clientX - r.left;
      this.pointerY = e.clientY - r.top;
      this.hasPointer = true;
      this.usingGamepad = false;
      if (e.button === 0) this.moveHeld = true;
      else { this.pointerHeld = true; this.pressPending = true; }
      (el as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());   // el derecho es para disparar
    const release = (e: PointerEvent): void => {
      if (typeof e.buttons === 'number') { if ((e.buttons & 2) === 0) this.pointerHeld = false; if ((e.buttons & 1) === 0) this.moveHeld = false; }
      else if (e.button === 2) this.pointerHeld = false;
      else if (e.button === 0) this.moveHeld = false;
    };
    const drop = (): void => { this.pointerHeld = false; this.moveHeld = false; };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', drop);
    el.addEventListener('lostpointercapture', drop);
    if (typeof window !== 'undefined') window.addEventListener('blur', drop);   // Alt+Tab con el botón apretado
  }

  poll(starX: number, starY: number): Intent {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    // Gatillo derecho (botón 7) de cualquier joystick: también es el botón de lanzar.
    let trigger = false;
    for (let k = 0; k < pads.length; k++) if (pads[k]?.buttons?.[7]?.pressed) trigger = true;
    // Mantenido carga el bólido. Un clic más rápido que un cuadro igual cuenta (pressPending).
    this.intent.hold = this.pointerHeld || this.pressPending || trigger;
    this.pressPending = false;
    this.intent.fire = false;
    // Stick derecho: mira propia de la honda (en el joystick, Y positivo es abajo).
    this.intent.hasAim = false;
    for (let k = 0; k < pads.length; k++) {
      const p = pads[k];
      if (!p) continue;
      applyDeadzone(p.axes[2] ?? 0, p.axes[3] ?? 0, 0.3, this.aimStick);
      if (this.aimStick.x !== 0 || this.aimStick.y !== 0) {
        this.intent.aimX = starX + this.aimStick.x * this.reach;
        this.intent.aimY = starY - this.aimStick.y * this.reach;
        this.intent.hasAim = true;
        break;
      }
    }
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
    this.intent.hasTarget = false;
    // Si el puntero apunta por encima del horizonte se usa el último punto válido.
    if (this.hasPointer && (this.toWorld(this.pointerX, this.pointerY, this.world) || this.hadWorld)) {
      this.hadWorld = true;
      // La mira es siempre el mouse; moverse, sólo con el izquierdo apretado.
      if (!this.intent.hasAim) { this.intent.aimX = this.world.x; this.intent.aimY = this.world.y; this.intent.hasAim = true; }
      if (this.moveHeld) {
        this.intent.targetX = this.world.x;
        this.intent.targetY = this.world.y;
        this.intent.hasTarget = true;
      }
    }
    return this.intent;
  }
}
