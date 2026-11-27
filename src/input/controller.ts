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
  private pointerHeld = false;    // clic izquierdo apretado ahora
  private pressPending = false;   // hubo un clic desde el último poll (aunque ya se haya soltado)
  private collapsePending = false;   // ESPACIO, C o botón Y todavía no entregado
  private yHeld = false;

  constructor(el: HTMLElement, private readonly toWorld: ToWorld, private readonly reach = 40) {
    el.addEventListener('pointermove', (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      this.pointerX = e.clientX - r.left;
      this.pointerY = e.clientY - r.top;
      this.hasPointer = true;
      this.usingGamepad = false;
    });
    // Clic izquierdo: botón de lanzar. Un toque es la honda; mantenido carga el bólido (lo decide la simulación).
    // Se captura el puntero para que soltar fuera de la ventana también llegue y el botón no quede trabado.
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0) return;
      const r = el.getBoundingClientRect();
      this.pointerX = e.clientX - r.left;
      this.pointerY = e.clientY - r.top;
      this.hasPointer = true;
      this.pointerHeld = true;
      this.pressPending = true;
      (el as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
    });
    const release = (e: PointerEvent): void => { if (e.button === 0 || e.type === 'pointercancel') this.pointerHeld = false; };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    // ESPACIO o C: colapsar (sólo hace algo cuando se puede; la simulación lo decide).
    // Se ignoran la autorrepetición (mantener apretado no decide por vos), los atajos con Ctrl/Alt/Cmd
    // y lo que se escribe en campos de texto (el laboratorio).
    if (typeof window !== 'undefined') window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as { tagName?: string; isContentEditable?: boolean } | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === ' ') { this.collapsePending = true; e.preventDefault(); }   // que el espacio no desplace la página
      else if (e.key === 'c' || e.key === 'C') this.collapsePending = true;
    });
  }

  poll(starX: number, starY: number): Intent {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    // Gatillo derecho (botón 7) de cualquier joystick: también es el botón de lanzar.
    let trigger = false;
    for (let k = 0; k < pads.length; k++) if (pads[k]?.buttons?.[7]?.pressed) trigger = true;
    // Mantenido carga el bólido. Un clic más rápido que un cuadro igual cuenta (pressPending).
    this.intent.hold = this.pointerHeld || this.pressPending || trigger;
    this.pressPending = false;
    let y = false;
    for (let k = 0; k < pads.length; k++) if (pads[k]?.buttons?.[3]?.pressed) y = true;
    if (y && !this.yHeld) this.collapsePending = true;
    this.yHeld = y;
    this.intent.collapse = this.intent.collapse === true || this.collapsePending;
    this.collapsePending = false;
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
    if (this.hasPointer && this.toWorld(this.pointerX, this.pointerY, this.world)) {
      this.intent.targetX = this.world.x;
      this.intent.targetY = this.world.y;
      this.intent.hasTarget = true;
    }
    return this.intent;
  }
}
