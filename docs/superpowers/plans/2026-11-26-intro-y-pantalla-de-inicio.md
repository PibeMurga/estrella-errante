# Intro y pantalla de inicio — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** al abrir el juego se ve una intro de unos 25 s, con sonido sintetizado: firma del estudio, transmisión interceptada, nacimiento de la estrella y el título MAGNAR. Después aparece una pantalla de inicio mínima, y JUGAR arranca la partida.

**Arquitectura:**
- La escena 3D de la partida se dibuja desde el primer cuadro, con la simulación en pausa. La intro y el inicio son capas DOM encima del canvas.
- Los tiempos de la intro salen de una función pura (`introState`) que se prueba sin render.
- El audio es Web Audio puro, en `src/audio/`, sin archivos ni dependencias.

**Tecnologías:** TypeScript, Three.js (capas existentes), Web Audio API, Vitest, Playwright y Electron.

**Especificación:** `docs/superpowers/specs/2026-11-26-identidad-relato-intro-design.md` (§4 y §5).

## Restricciones globales

- Todo lo que ve el jugador va en español rioplatense: textos, comentarios del código y commits.
- No se agregan dependencias. Fuentes: las del visor (`'Cascadia Mono', 'Consolas', 'DejaVu Sans Mono', 'Liberation Mono', monospace`). Las OFL siguen sin aprobar.
- La simulación (`src/sim/`) no se toca. Mientras dura la intro o el inicio, simplemente no se llama a `step`.
- No se crean objetos por cuadro dentro del bucle. Los nodos de audio se crean sólo en eventos sueltos (un golpe, el título), nunca por cuadro. La voz usa nodos persistentes.
- Nunca se desactiva `contextIsolation`. El IPC nuevo (`app:quit`) pasa por el preload.
- Firma provisoria del estudio: `TABLADO`, en una sola constante (`STUDIO_NAME`).
- Texto de la transmisión, exacto: `…te encontramos. Sos joven. Sos pequeña.` + salto de línea + `Nosotros vamos a cuidarte.`
- Duraciones de la versión completa: firma 3 s, transmisión 10 s, nacimiento 8 s y título 4 s (25 s en total). Versión corta: firma 2 s y título 3 s.
- Clave de `localStorage`: `magnar.introVista`.
- Parámetros de la URL:
  - `?intro=0`: va directo a jugar (lo usan las pruebas y «nueva partida»);
  - `?intro=menu`: va directo a la pantalla de inicio.
- Commits terminados con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VCDQYR4GnVKDakJf79PRaF
  ```

## Puntos a revisar

1. **Saltear en cualquier momento, incluso con la tecla todavía apretada desde la puerta web.** Tiene que llevar al inicio una sola vez, sin saltear también el inicio. Se prueba en la Tarea 6, con dos pulsaciones seguidas: queda en el inicio.
2. **`localStorage` ausente o que lanza un error** (modo privado, o Electron con el almacenamiento bloqueado). La intro tiene que andar igual, en versión completa. Se prueba en la Tarea 2, con un almacén que lanza.
3. **Sin Web Audio** (`AudioContext` indefinido). La intro corre muda, sin errores. Se prueba en la Tarea 3: `createAudioEngine()` devuelve `null` si no existe `AudioContext`.
4. **Pestaña oculta o cuadro muy largo** (dt de varios segundos). La intro no se tiene que quedar trabada ni saltar sonidos de golpe: el dt se acota a 0,1 s por cuadro. Se prueba en la Tarea 1: `introState` con un tiempo pasado del total da `DONE`, y no hay valores fuera de [0,1].
5. **Volver al inicio desde el fin de partida** con `?intro=menu`. No tiene que mostrar la intro. Se prueba en la Tarea 6.

---

### Tarea 1: tiempos de la intro (función pura)

**Archivos:**
- Crear: `src/intro/timeline.ts`
- Prueba: `tests/unit/introTimeline.test.ts`

**Interfaces:**
- Produce: `SIGN=0, TRANSMISSION=1, BIRTH=2, TITLE=3, DONE=4`; `TRANSMISSION_TEXT: string`; `introDuration(short: boolean): number`; `createIntroState(): IntroState`; `introState(t: number, short: boolean, out: IntroState): IntroState`.
- `IntroState = { phase: number; local: number; typed: number; black: number; sign: number; text: number; title: number; flare: number }`:
  - `local`: segundos dentro de la fase;
  - `typed`: cantidad de caracteres visibles;
  - los demás campos son opacidades entre 0 y 1.

- [ ] **Paso 1: escribir la prueba que falla**

```ts
// tests/unit/introTimeline.test.ts
import { describe, expect, it } from 'vitest';
import { BIRTH, createIntroState, DONE, introDuration, introState, SIGN, TITLE, TRANSMISSION, TRANSMISSION_TEXT } from '../../src/intro/timeline';

describe('tiempos de la intro', () => {
  const s = createIntroState();
  it('dura 25 s completa y 5 s la corta', () => {
    expect(introDuration(false)).toBe(25);
    expect(introDuration(true)).toBe(5);
  });
  it('arranca con la firma sobre negro', () => {
    introState(0.1, false, s);
    expect(s.phase).toBe(SIGN);
    expect(s.black).toBe(1);
    expect(s.typed).toBe(0);
  });
  it('la firma aparece y se va dentro de sus 3 s', () => {
    expect(introState(1.5, false, s).sign).toBe(1);
    expect(introState(2.95, false, s).sign).toBeLessThan(0.2);
  });
  it('la transmisión se escribe letra por letra y queda completa', () => {
    expect(introState(3.5, false, s).phase).toBe(TRANSMISSION);
    expect(s.typed).toBe(0);
    let prev = 0;
    for (let t = 3; t < 13; t += 0.05) { introState(t, false, s); expect(s.typed).toBeGreaterThanOrEqual(prev); prev = s.typed; }
    expect(introState(3 + 7.6, false, s).typed).toBe(TRANSMISSION_TEXT.length);
    expect(s.text).toBe(1);
  });
  it('en el nacimiento el negro se abre', () => {
    expect(introState(13.1, false, s).phase).toBe(BIRTH);
    expect(s.black).toBeGreaterThan(0.9);
    expect(introState(13 + 6, false, s).black).toBe(0);
  });
  it('el título aparece con la llamarada', () => {
    introState(21 + 0.3, false, s);
    expect(s.phase).toBe(TITLE);
    expect(s.flare).toBeGreaterThan(0.9);
    expect(introState(21 + 2, false, s).title).toBe(1);
  });
  it('termina en DONE y nada se sale de [0,1], aunque el tiempo se pase', () => {
    for (const t of [25.01, 60, 1e6]) {
      introState(t, false, s);
      expect(s.phase).toBe(DONE);
      for (const v of [s.black, s.sign, s.text, s.title, s.flare]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
  });
  it('la versión corta va de la firma al título, y el negro se abre en el título', () => {
    expect(introState(1, true, s).phase).toBe(SIGN);
    introState(2.2, true, s);
    expect(s.phase).toBe(TITLE);
    expect(s.black).toBeGreaterThan(0.5);
    expect(introState(4.5, true, s).black).toBe(0);
    expect(introState(5.1, true, s).phase).toBe(DONE);
  });
  it('reutiliza el objeto de salida', () => {
    expect(introState(4, false, s)).toBe(s);
  });
});
```

- [ ] **Paso 2: correrla para verificar que falla**

Correr: `npx vitest run tests/unit/introTimeline.test.ts`
Se espera que FALLE porque no se encuentra el módulo `src/intro/timeline`.

- [ ] **Paso 3: implementar**

```ts
// src/intro/timeline.ts
// Tiempos de la intro: función pura del tiempo transcurrido. No sabe nada del DOM ni del audio.
export const SIGN = 0, TRANSMISSION = 1, BIRTH = 2, TITLE = 3, DONE = 4;

export const TRANSMISSION_TEXT = '…te encontramos. Sos joven. Sos pequeña.\nNosotros vamos a cuidarte.';

interface Segment { readonly phase: number; readonly dur: number }
const FULL: readonly Segment[] = [{ phase: SIGN, dur: 3 }, { phase: TRANSMISSION, dur: 10 }, { phase: BIRTH, dur: 8 }, { phase: TITLE, dur: 4 }];
const SHORT: readonly Segment[] = [{ phase: SIGN, dur: 2 }, { phase: TITLE, dur: 3 }];

// La escritura de la transmisión: arranca 1,5 s después de que empieza la estática y dura 6 s.
const TYPE_START = 1.5, TYPE_DUR = 6;

export interface IntroState { phase: number; local: number; typed: number; black: number; sign: number; text: number; title: number; flare: number }

export function createIntroState(): IntroState {
  return { phase: SIGN, local: 0, typed: 0, black: 1, sign: 0, text: 0, title: 0, flare: 0 };
}

export function introDuration(short: boolean): number {
  let d = 0;
  for (const s of short ? SHORT : FULL) d += s.dur;
  return d;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number): number => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function introState(t: number, short: boolean, out: IntroState): IntroState {
  const segs = short ? SHORT : FULL;
  let start = 0, phase = DONE, dur = 0;
  for (const s of segs) {
    if (t < start + s.dur) { phase = s.phase; dur = s.dur; break; }
    start += s.dur;
  }
  const lt = phase === DONE ? 0 : t - start;
  out.phase = phase; out.local = lt;
  out.sign = phase === SIGN ? smooth(0, 0.6, lt) * (1 - smooth(dur - 0.6, dur, lt)) : 0;
  out.typed = phase === TRANSMISSION ? Math.floor(TRANSMISSION_TEXT.length * clamp01((lt - TYPE_START) / TYPE_DUR)) : phase === SIGN ? 0 : TRANSMISSION_TEXT.length;
  out.text = phase === TRANSMISSION ? 1 - smooth(dur - 1, dur, lt) : 0;
  if (phase === SIGN || phase === TRANSMISSION) out.black = 1;
  else if (phase === BIRTH) out.black = 1 - smooth(0, 5, lt);
  else if (phase === TITLE) out.black = short ? 1 - smooth(0, 1.5, lt) : 0;
  else out.black = 0;
  out.title = phase === TITLE ? smooth(0.3, 1.3, lt) : phase === DONE ? 1 : 0;
  out.flare = phase === TITLE ? Math.exp(-(((lt - 0.3) / 0.5) ** 2)) : 0;
  return out;
}
```

- [ ] **Paso 4: correr la prueba para verificar que pasa**

Correr: `npx vitest run tests/unit/introTimeline.test.ts`
Se espera que PASE (9 pruebas).

- [ ] **Paso 5: commit**

```bash
git add src/intro/timeline.ts tests/unit/introTimeline.test.ts
git commit -m "Intro: tiempos de la secuencia como función pura"
```
(Con las dos líneas de firma de las restricciones globales.)

---

### Tarea 2: cómo arranca la aplicación (recorrido y recuerdo de la intro)

**Archivos:**
- Crear: `src/app/flow.ts`
- Prueba: `tests/unit/flow.test.ts`

**Interfaces:**
- Produce:
  - `INTRO_SEEN_KEY = 'magnar.introVista'`;
  - `interface KeyStore { getItem(k: string): string | null; setItem(k: string, v: string): void }`;
  - `type StartScreenKind = 'intro' | 'start' | 'play'`;
  - `planStart(search: string, store: KeyStore | null): { screen: StartScreenKind; short: boolean }`;
  - `markIntroSeen(store: KeyStore | null): void`.

- [ ] **Paso 1: escribir la prueba que falla**

```ts
// tests/unit/flow.test.ts
import { describe, expect, it } from 'vitest';
import { INTRO_SEEN_KEY, markIntroSeen, planStart, type KeyStore } from '../../src/app/flow';

const memory = (): KeyStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
};
const broken: KeyStore = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };

describe('arranque de la aplicación', () => {
  it('la primera vez muestra la intro completa', () => {
    expect(planStart('', memory())).toEqual({ screen: 'intro', short: false });
  });
  it('después de verla, la intro es corta', () => {
    const m = memory();
    markIntroSeen(m);
    expect(m.data.get(INTRO_SEEN_KEY)).toBe('1');
    expect(planStart('?seed=5', m)).toEqual({ screen: 'intro', short: true });
  });
  it('?intro=0 va directo a jugar y ?intro=menu al inicio', () => {
    expect(planStart('?seed=1&intro=0', memory()).screen).toBe('play');
    expect(planStart('?intro=menu', memory()).screen).toBe('start');
  });
  it('sin almacenamiento, o si lanza, la intro anda igual', () => {
    expect(planStart('', null)).toEqual({ screen: 'intro', short: false });
    expect(planStart('', broken)).toEqual({ screen: 'intro', short: false });
    expect(() => markIntroSeen(broken)).not.toThrow();
    expect(() => markIntroSeen(null)).not.toThrow();
  });
});
```

- [ ] **Paso 2: correrla para verificar que falla**

Correr: `npx vitest run tests/unit/flow.test.ts`
Se espera que FALLE porque no se encuentra el módulo.

- [ ] **Paso 3: implementar**

```ts
// src/app/flow.ts
// Qué se ve al abrir: la intro (completa la primera vez, corta después), la pantalla de inicio o la partida.
export const INTRO_SEEN_KEY = 'magnar.introVista';

export interface KeyStore { getItem(k: string): string | null; setItem(k: string, v: string): void }
export type StartScreenKind = 'intro' | 'start' | 'play';

export function planStart(search: string, store: KeyStore | null): { screen: StartScreenKind; short: boolean } {
  const intro = new URLSearchParams(search).get('intro');
  if (intro === '0') return { screen: 'play', short: false };
  if (intro === 'menu') return { screen: 'start', short: false };
  let seen = false;
  try { seen = store?.getItem(INTRO_SEEN_KEY) === '1'; } catch { seen = false; }
  return { screen: 'intro', short: seen };
}

export function markIntroSeen(store: KeyStore | null): void {
  try { store?.setItem(INTRO_SEEN_KEY, '1'); } catch { /* sin almacenamiento: la próxima vez se ve completa */ }
}
```

- [ ] **Paso 4: correr la prueba para verificar que pasa**

Correr: `npx vitest run tests/unit/flow.test.ts`
Se espera que PASE.

- [ ] **Paso 5: commit**

```bash
git add src/app/flow.ts tests/unit/flow.test.ts
git commit -m "Arranque: intro completa la primera vez, corta después y atajos por URL"
```

---

### Tarea 3: motor de audio y efectos sintetizados

**Archivos:**
- Crear: `src/audio/engine.ts`, `src/audio/sfx.ts`
- Prueba: `tests/unit/audio.test.ts`

**Interfaces:**
- Consume: `createRng(seed): Rng`, de `src/sim/rng.ts`.
- Produce:
  - `interface AudioEngine { readonly ctx: AudioContext; readonly out: GainNode; readonly reverb: GainNode; readonly suspended: boolean; resume(): Promise<void> }`. `out` es la salida seca y `reverb`, la entrada a la reverberación larga;
  - `createAudioEngine(): AudioEngine | null`;
  - `fillImpulse(left: Float32Array, right: Float32Array, rate: number, seconds: number, seed: number): void`;
  - en `sfx.ts`: `playCymbal(a, at)`, `playBassHit(a, at)` y `startStatic(a, at): RadioStatic`, con `interface RadioStatic { tune(at: number, until: number): void; stop(at: number): void }`.

- [ ] **Paso 1: escribir la prueba que falla** (sólo lo puro: Node no tiene Web Audio)

```ts
// tests/unit/audio.test.ts
import { describe, expect, it } from 'vitest';
import { createAudioEngine, fillImpulse } from '../../src/audio/engine';

const energy = (a: Float32Array, from: number, to: number): number => { let e = 0; for (let i = from; i < to; i++) e += a[i]! * a[i]!; return e; };

describe('audio', () => {
  it('la respuesta al impulso decae y es determinista', () => {
    const n = 48000 * 2;
    const l = new Float32Array(n), r = new Float32Array(n), l2 = new Float32Array(n), r2 = new Float32Array(n);
    fillImpulse(l, r, 48000, 2, 7);
    fillImpulse(l2, r2, 48000, 2, 7);
    expect(l).toEqual(l2);
    expect(energy(l, 0, n / 10)).toBeGreaterThan(energy(l, n - n / 10, n) * 50);
    expect(l).not.toEqual(r);   // estéreo: los dos canales difieren
  });
  it('sin AudioContext devuelve null en vez de romper', () => {
    expect(createAudioEngine()).toBeNull();
  });
});
```

- [ ] **Paso 2: correrla para verificar que falla**

Correr: `npx vitest run tests/unit/audio.test.ts`
Se espera que FALLE porque no se encuentra el módulo.

- [ ] **Paso 3: implementar el motor**

```ts
// src/audio/engine.ts
import { createRng } from '../sim/rng';

// Audio del juego: Web Audio puro. Una salida seca y una reverberación larga, «de espacio», generada acá mismo.
export interface AudioEngine {
  readonly ctx: AudioContext;
  readonly out: GainNode;      // salida seca
  readonly reverb: GainNode;   // entrada a la reverberación
  readonly suspended: boolean;
  resume(): Promise<void>;
}

// Ruido que decae exponencialmente: una sala enorme. Los dos canales usan ruido distinto, para que suene ancho.
export function fillImpulse(left: Float32Array, right: Float32Array, rate: number, seconds: number, seed: number): void {
  const rng = createRng(seed);
  const n = Math.min(left.length, right.length, Math.floor(rate * seconds));
  for (let i = 0; i < n; i++) {
    const env = Math.exp((-6.9 * i) / n);   // -60 dB al final
    left[i] = rng.range(-1, 1) * env;
    right[i] = rng.range(-1, 1) * env;
  }
}

export function createAudioEngine(): AudioEngine | null {
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 4;
  const master = ctx.createGain(); master.gain.value = 0.8;
  master.connect(comp); comp.connect(ctx.destination);
  const out = ctx.createGain(); out.connect(master);
  const seconds = 7;
  const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  fillImpulse(buf.getChannelData(0), buf.getChannelData(1), ctx.sampleRate, seconds, 1987);
  const conv = ctx.createConvolver(); conv.buffer = buf;
  const reverb = ctx.createGain(); reverb.gain.value = 0.6;
  reverb.connect(conv); conv.connect(master);
  return {
    ctx, out, reverb,
    get suspended() { return ctx.state === 'suspended'; },
    resume: () => ctx.resume(),
  };
}
```

- [ ] **Paso 4: implementar los efectos**

```ts
// src/audio/sfx.ts
import type { AudioEngine } from './engine';

// Ruido blanco reutilizable (2 s). Se arma una vez por contexto.
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 1;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    noiseCache.set(ctx, b);
  }
  return b;
}

// Golpe de platillo de murga: seis osciladores cuadrados inarmónicos (el timbre metálico) más ruido,
// que se apagan solos y quedan sonando en la reverberación enorme.
export function playCymbal(a: AudioEngine, at: number): void {
  const { ctx } = a;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(0.35, at + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, at + 2.8);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 9000; bp.Q.value = 0.6;
  for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * 2.1;
    o.connect(hp); o.start(at); o.stop(at + 3);
  }
  hp.connect(bp); bp.connect(env);
  const n = ctx.createBufferSource(); n.buffer = noise(ctx);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.25, at); ng.gain.exponentialRampToValueAtTime(0.001, at + 1.4);
  const nhp = ctx.createBiquadFilter(); nhp.type = 'highpass'; nhp.frequency.value = 6500;
  n.connect(nhp); nhp.connect(ng); ng.connect(env); n.start(at); n.stop(at + 1.5);
  env.connect(a.out);
  const send = ctx.createGain(); send.gain.value = 1.4; env.connect(send); send.connect(a.reverb);
}

// Golpe de graves del título: una senoidal que cae de 90 a 34 Hz, con cola larga.
export function playBassHit(a: AudioEngine, at: number): void {
  const { ctx } = a;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(90, at); o.frequency.exponentialRampToValueAtTime(34, at + 0.7);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.9, at + 0.012); g.gain.exponentialRampToValueAtTime(0.001, at + 4);
  o.connect(g); g.connect(a.out);
  const send = ctx.createGain(); send.gain.value = 0.35; g.connect(send); send.connect(a.reverb);
  o.start(at); o.stop(at + 4.1);
}

export interface RadioStatic { tune(at: number, until: number): void; stop(at: number): void }

// Estática de radio, con un tono que se afina de a poco (la señal que se va encontrando).
export function startStatic(a: AudioEngine, at: number): RadioStatic {
  const { ctx } = a;
  const src = ctx.createBufferSource(); src.buffer = noise(ctx); src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.7;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.16, at + 0.8);
  src.connect(bp); bp.connect(g); g.connect(a.out);
  const tone = ctx.createOscillator(); tone.type = 'sine'; tone.frequency.value = 523; tone.detune.setValueAtTime(700, at);
  const tg = ctx.createGain(); tg.gain.setValueAtTime(0, at);
  tone.connect(tg); tg.connect(a.out);
  const send = ctx.createGain(); send.gain.value = 0.5; tg.connect(send); send.connect(a.reverb);
  src.start(at); tone.start(at);
  return {
    tune(t0, t1) {
      tone.detune.setValueAtTime(700, t0); tone.detune.exponentialRampToValueAtTime(1, t1);
      tg.gain.setValueAtTime(0, t0); tg.gain.linearRampToValueAtTime(0.05, t1);
      g.gain.setValueAtTime(0.16, t0); g.gain.linearRampToValueAtTime(0.06, t1);
    },
    stop(t) {
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.4);
      tg.gain.cancelScheduledValues(t); tg.gain.setTargetAtTime(0, t, 0.4);
      src.stop(t + 3); tone.stop(t + 3);
    },
  };
}
```

- [ ] **Paso 5: correr las pruebas y el chequeo de tipos**

Correr: `npx vitest run tests/unit/audio.test.ts && npm run typecheck`
Se espera que PASE. El chequeo de tipos no tiene que dar errores; si `tsconfig` no incluye `lib: ["DOM"]` para `src/audio`, revisar cómo lo resuelven `src/ui/*.ts`, que ya usan el DOM.

- [ ] **Paso 6: commit**

```bash
git add src/audio/engine.ts src/audio/sfx.ts tests/unit/audio.test.ts
git commit -m "Audio: motor con reverberación generada, platillo, golpe de graves y estática"
```

---

### Tarea 4: la voz sin palabras

**Archivos:**
- Crear: `src/audio/voice.ts`
- Prueba: `tests/unit/voice.test.ts`

**Interfaces:**
- Consume: `AudioEngine` (Tarea 3).
- Produce:
  - `VOWELS: readonly (readonly [number, number, number])[]`;
  - `vowelFor(ch: string, index: number): number`, que devuelve el índice en `VOWELS`, o -1 si el carácter no se pronuncia;
  - `interface Voice { speak(ch: string, index: number, at: number): void; stop(at: number): void }`;
  - `createVoice(a: AudioEngine): Voice`.

- [ ] **Paso 1: escribir la prueba que falla**

```ts
// tests/unit/voice.test.ts
import { describe, expect, it } from 'vitest';
import { VOWELS, vowelFor } from '../../src/audio/voice';

describe('voz de la civilización', () => {
  it('las letras eligen una vocal ajena, siempre la misma para la misma letra y posición', () => {
    for (const [i, ch] of [...'te encontramos'].entries()) {
      const v = vowelFor(ch, i);
      if (ch === ' ') expect(v).toBe(-1);
      else { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(VOWELS.length); expect(vowelFor(ch, i)).toBe(v); }
    }
  });
  it('los signos y los saltos de línea no suenan', () => {
    for (const ch of ['.', ',', '…', '\n', ' ']) expect(vowelFor(ch, 3)).toBe(-1);
  });
  it('la misma letra en otra posición puede sonar distinto (no es un código fijo)', () => {
    const set = new Set<number>();
    for (let i = 0; i < 20; i++) set.add(vowelFor('a', i));
    expect(set.size).toBeGreaterThan(2);
  });
});
```

- [ ] **Paso 2: correrla para verificar que falla**

Correr: `npx vitest run tests/unit/voice.test.ts`
Se espera que FALLE porque no se encuentra el módulo.

- [ ] **Paso 3: implementar**

```ts
// src/audio/voice.ts
import type { AudioEngine } from './engine';

// La «voz» de la civilización: un pulso grave con vibrato, filtrado por tres formantes como una garganta.
// Las vocales no son de ningún idioma: combinaciones de formantes que no usamos los humanos.
export const VOWELS: readonly (readonly [number, number, number])[] = [
  [310, 1250, 2900], [420, 980, 2500], [560, 1480, 2350], [370, 2050, 3100], [640, 1150, 2650], [290, 820, 2200],
];

const SILENT = /[\s.,;:…!?¡¿—-]/;

export function vowelFor(ch: string, index: number): number {
  if (ch.length === 0 || SILENT.test(ch)) return -1;
  // Mezcla de enteros (estilo murmur): la misma letra en otra posición cae en otra vocal.
  let h = Math.imul(ch.codePointAt(0)! ^ Math.imul(index + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) % VOWELS.length;
}

export interface Voice { speak(ch: string, index: number, at: number): void; stop(at: number): void }

export function createVoice(a: AudioEngine): Voice {
  const { ctx } = a;
  const src = ctx.createOscillator(); src.type = 'sawtooth'; src.frequency.value = 92;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 5.3;
  const lfoG = ctx.createGain(); lfoG.gain.value = 3;
  lfo.connect(lfoG); lfoG.connect(src.frequency);
  const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 46;   // un armónico debajo: le da cuerpo, no es humano
  const env = ctx.createGain(); env.gain.value = 0;
  const filters: BiquadFilterNode[] = [];
  for (let k = 0; k < 3; k++) {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9; f.frequency.value = VOWELS[0]![k]!;
    const fg = ctx.createGain(); fg.gain.value = k === 0 ? 1 : 0.6 / k;
    src.connect(f); f.connect(fg); fg.connect(env); filters.push(f);
  }
  const subG = ctx.createGain(); subG.gain.value = 0.25; sub.connect(subG); subG.connect(env);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
  env.connect(lp); lp.connect(a.out);
  const send = ctx.createGain(); send.gain.value = 0.9; lp.connect(send); send.connect(a.reverb);
  let started = false;
  return {
    speak(ch, index, at) {
      if (!started) { src.start(at); lfo.start(at); sub.start(at); started = true; }
      const v = vowelFor(ch, index);
      if (v < 0) return;
      const vf = VOWELS[v]!;
      for (let k = 0; k < 3; k++) filters[k]!.frequency.setTargetAtTime(vf[k]!, at, 0.015);
      src.frequency.setTargetAtTime(92 * (1 + 0.05 * Math.sin(index * 0.9)), at, 0.03);
      env.gain.cancelScheduledValues(at);
      env.gain.setTargetAtTime(0.5, at, 0.012);
      env.gain.setTargetAtTime(0.04, at + 0.07, 0.03);
    },
    stop(at) {
      env.gain.cancelScheduledValues(at); env.gain.setTargetAtTime(0, at, 0.08);
      if (started) { src.stop(at + 1); lfo.stop(at + 1); sub.stop(at + 1); }
    },
  };
}
```

- [ ] **Paso 4: correr la prueba para verificar que pasa**

Correr: `npx vitest run tests/unit/voice.test.ts && npm run typecheck`
Se espera que PASE.

- [ ] **Paso 5: commit**

```bash
git add src/audio/voice.ts tests/unit/voice.test.ts
git commit -m "Audio: la voz sin palabras de la civilización"
```

---

### Tarea 5: el logo MAGNAR, la intro en pantalla y la pantalla de inicio

**Archivos:**
- Crear: `src/intro/logo.ts`, `src/intro/intro.ts`, `src/intro/intro.css`, `src/ui/startScreen.ts`, `src/ui/startScreen.css`
- Modificar:
  - `src/preload/index.ts`: agregar `quit`;
  - `src/main/index.ts`: atender `app:quit` y sumar `autoplayPolicy`;
  - `src/renderer/globals.d.ts`: tipos de `quit` y de `screen`.

**Interfaces:**
- Consume: `introState`, `createIntroState`, `introDuration`, `TRANSMISSION_TEXT`, `SIGN/TRANSMISSION/BIRTH/TITLE/DONE` (Tarea 1); `AudioEngine`, `playCymbal`, `playBassHit`, `startStatic` (Tarea 3); `createVoice` (Tarea 4).
- Produce:
  - `STUDIO_NAME = 'TABLADO'`;
  - `MAGNAR_SVG: string`;
  - `createIntro(parent: HTMLElement, opts: { short: boolean; audio: AudioEngine | null; onDone: () => void }): Intro`, con `interface Intro { readonly done: boolean; update(dt: number): void; skip(): void }`;
  - `createStartScreen(parent: HTMLElement, opts: { onPlay: () => void; onQuit: (() => void) | null }): StartScreen`, con `interface StartScreen { readonly visible: boolean; show(): void; hide(): void; update(): void }`;
  - `window.platform.quit(): void`.

- [ ] **Paso 1: el logo** (letras propias, rectas, en trazo grueso; provisorio hasta que se diseñe el definitivo)

```ts
// src/intro/logo.ts
// Firma provisoria del estudio: se cambia acá cuando Lucas elija entre TABLADO y PLATILLO.
export const STUDIO_NAME = 'TABLADO';

// MAGNAR dibujado a mano, en trazos rectos (sin fuentes con licencia). Provisorio hasta el logo definitivo.
const LETTERS: readonly { x: number; d: string }[] = [
  { x: 0, d: 'M0 60 L0 0 L22 34 L44 0 L44 60' },                 // M
  { x: 60, d: 'M0 60 L20 0 L40 60 M8 38 L32 38' },               // A
  { x: 116, d: 'M40 0 L0 0 L0 60 L40 60 L40 32 L20 32' },        // G
  { x: 172, d: 'M0 60 L0 0 L36 60 L36 0' },                      // N
  { x: 224, d: 'M0 60 L20 0 L40 60 M8 38 L32 38' },              // A
  { x: 280, d: 'M0 60 L0 0 L36 0 L36 30 L0 30 M14 30 L38 60' },  // R
];

export const MAGNAR_SVG = `<svg class="magnar" viewBox="-6 -6 330 72" aria-label="MAGNAR" role="img">${LETTERS.map((l) => `<path transform="translate(${l.x} 0)" d="${l.d}"/>`).join('')}</svg>`;
```

- [ ] **Paso 2: la intro en pantalla**

```ts
// src/intro/intro.ts
import type { AudioEngine } from '../audio/engine';
import { playBassHit, playCymbal, startStatic, type RadioStatic } from '../audio/sfx';
import { createVoice, type Voice } from '../audio/voice';
import { MAGNAR_SVG, STUDIO_NAME } from './logo';
import { BIRTH, createIntroState, DONE, introDuration, introState, SIGN, TITLE, TRANSMISSION, TRANSMISSION_TEXT } from './timeline';
import './intro.css';

// La intro: capas DOM sobre la escena real (que ya se dibuja detrás), más el audio en sus momentos.
export interface Intro { readonly done: boolean; update(dt: number): void; skip(): void }

export function createIntro(parent: HTMLElement, opts: { short: boolean; audio: AudioEngine | null; onDone: () => void }): Intro {
  const root = document.createElement('div');
  root.className = 'intro';
  root.innerHTML = `
    <div class="black"></div>
    <div class="flare"></div>
    <div class="sign">${STUDIO_NAME}</div>
    <pre class="tx"></pre>
    <div class="title">${MAGNAR_SVG}</div>
    <div class="skip">CUALQUIER TECLA · SALTEAR</div>`;
  parent.appendChild(root);
  const q = (s: string): HTMLElement => root.querySelector(s) as HTMLElement;
  const black = q('.black'), flare = q('.flare'), sign = q('.sign'), tx = q('.tx'), title = q('.title');

  const st = createIntroState();
  const total = introDuration(opts.short);
  const a = opts.audio;
  let t = 0, done = false, lastPhase = -1, lastTyped = 0;
  let radio: RadioStatic | null = null, voice: Voice | null = null;
  // Sólo se escribe en el DOM si cambió (a centésimas).
  const shown = { black: -1, flare: -1, sign: -1, text: -1, title: -1 };
  const setOp = (el: HTMLElement, key: keyof typeof shown, v: number): void => {
    const r = Math.round(v * 100) / 100;
    if (r !== shown[key]) { shown[key] = r; el.style.opacity = String(r); }
  };

  const finish = (): void => {
    if (done) return;
    done = true;
    const now = a ? a.ctx.currentTime : 0;
    radio?.stop(now); voice?.stop(now);
    root.classList.add('out');
    setTimeout(() => root.remove(), 900);
    opts.onDone();
  };

  return {
    get done() { return done; },
    update(dt) {
      if (done) return;
      t += Math.min(dt, 0.1);   // pestaña oculta o cuadro largo: no salta de golpe
      introState(t, opts.short, st);
      const now = a ? a.ctx.currentTime : 0;
      if (st.phase !== lastPhase) {
        if (a) {
          if (st.phase === SIGN) playCymbal(a, now + 0.05);
          if (st.phase === TRANSMISSION) { radio = startStatic(a, now); radio.tune(now + 1, now + 7.5); voice = createVoice(a); }
          if (st.phase === BIRTH) { radio?.stop(now); voice?.stop(now + 0.5); radio = null; voice = null; }
          if (st.phase === TITLE) playBassHit(a, now + 0.3);
        }
        lastPhase = st.phase;
      }
      if (st.typed !== lastTyped) {
        for (let i = lastTyped; i < st.typed; i++) voice?.speak(TRANSMISSION_TEXT[i]!, i, now);
        tx.textContent = TRANSMISSION_TEXT.slice(0, st.typed);
        lastTyped = st.typed;
      }
      setOp(black, 'black', st.black);
      setOp(flare, 'flare', st.flare);
      setOp(sign, 'sign', st.sign);
      setOp(tx, 'text', st.text);
      setOp(title, 'title', st.title);
      if (st.phase === DONE || t >= total) finish();
    },
    skip: finish,
  };
}
```

```css
/* src/intro/intro.css — la intro: negro, firma, transmisión, llamarada y título, sobre la escena real. */
.intro { position: fixed; inset: 0; z-index: 30; pointer-events: auto; cursor: default;
  font-family: 'Cascadia Mono', 'Consolas', 'DejaVu Sans Mono', 'Liberation Mono', monospace; color: #d8cfb8;
  transition: opacity .9s ease; }
.intro.out { opacity: 0; pointer-events: none; }
.intro > div, .intro > pre { position: absolute; opacity: 0; }
.intro .black { inset: 0; background: #000; opacity: 1; }
.intro .flare { inset: 0; background: radial-gradient(circle at 50% 50%, #fff6e0 0%, #ffcf8a55 10%, #ff8a3a22 26%, transparent 55%); mix-blend-mode: screen; }
.intro .sign { left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; font-size: 15px; letter-spacing: 14px; }
.intro .tx { left: 50%; top: 50%; transform: translate(-50%, -50%); margin: 0; width: min(640px, 80vw); min-height: 3.2em;
  font: inherit; font-size: 17px; line-height: 1.9; letter-spacing: 2px; white-space: pre-wrap; color: #e9dcc0;
  text-shadow: 0 0 6px #ffd9a044; }
.intro .title { left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; justify-content: center; }
.intro .skip { right: 28px; bottom: 22px; font-size: 10px; letter-spacing: 3px; opacity: .35 !important; }
.magnar { width: min(560px, 62vw); height: auto; fill: none; stroke: #efe3c6; stroke-width: 7; stroke-linecap: square; stroke-linejoin: miter;
  filter: drop-shadow(0 0 10px #ffd59a55); }
```

- [ ] **Paso 3: la pantalla de inicio** (estilo de teclas con piloto, tomado de `docs/diseno/maquetas/pantalla-principal-y-carga.html`)

```ts
// src/ui/startScreen.ts
import { MAGNAR_SVG } from '../intro/logo';
import './startScreen.css';

// Pantalla de inicio mínima: JUGAR (y SALIR en Electron), sobre la escena real. La versión completa sigue en revisión.
export interface StartScreen { readonly visible: boolean; show(): void; hide(): void; update(): void }

export function createStartScreen(parent: HTMLElement, opts: { onPlay: () => void; onQuit: (() => void) | null }): StartScreen {
  const root = document.createElement('div');
  root.className = 'start';
  root.innerHTML = `
    <div class="logo">${MAGNAR_SVG}</div>
    <div class="menu">
      <button class="key pri" data-act="play"><i class="lamp on"></i>JUGAR<span class="n">ENTER</span></button>
      ${opts.onQuit ? '<button class="key" data-act="quit"><i class="lamp"></i>SALIR<span class="n">ESC</span></button>' : ''}
    </div>`;
  parent.appendChild(root);
  let visible = false, padHeld = true;
  const play = (): void => { if (visible) opts.onPlay(); };
  const quit = (): void => { if (visible) opts.onQuit?.(); };
  root.querySelector('[data-act="play"]')!.addEventListener('click', play);
  root.querySelector('[data-act="quit"]')?.addEventListener('click', quit);
  window.addEventListener('keydown', (e) => {
    if (!visible) return;
    if (e.key === 'Enter' || e.key === ' ') play();
    else if (e.key === 'Escape') quit();
  });
  return {
    get visible() { return visible; },
    show() { visible = true; padHeld = true; root.classList.add('on'); },
    hide() { visible = false; root.classList.remove('on'); },
    update() {
      // Mando: A o Start juegan. Hay que soltar y volver a apretar (el botón que salteó la intro no cuenta).
      if (!visible || typeof navigator === 'undefined' || !navigator.getGamepads) return;
      let down = false;
      for (const p of navigator.getGamepads()) if (p && (p.buttons[0]?.pressed || p.buttons[9]?.pressed)) down = true;
      if (down && !padHeld) play();
      padHeld = down;
    },
  };
}
```

```css
/* src/ui/startScreen.css — teclas con piloto, como en la maqueta, sobre la escena. */
.start { position: fixed; inset: 0; z-index: 20; opacity: 0; pointer-events: none; transition: opacity .9s ease;
  background: linear-gradient(90deg, #000000b8 0%, #00000055 38%, transparent 60%);
  font-family: 'Cascadia Mono', 'Consolas', 'DejaVu Sans Mono', 'Liberation Mono', monospace; color: #d8cfb8; }
.start.on { opacity: 1; pointer-events: auto; }
.start .logo { position: absolute; left: 56px; top: 56px; }
.start .logo .magnar { width: 340px; }
.start .menu { position: absolute; left: 56px; top: 220px; display: grid; gap: 16px; }
.start .key { position: relative; width: 300px; height: 58px; border: 0; border-radius: 5px; display: flex; align-items: center; gap: 14px; padding: 0 18px; cursor: pointer;
  background: linear-gradient(180deg, #4a4c50, #2c2e31 55%, #222326); box-shadow: inset 0 1px 0 #ffffff30, inset 0 -4px 0 #15161899, 0 3px 0 #0b0b0c, 0 6px 10px #0009;
  font: inherit; font-weight: 600; font-size: 15px; letter-spacing: 3px; color: #d8cfb8; text-shadow: 0 -1px 0 #000; }
.start .key:active { transform: translateY(2px); box-shadow: inset 0 1px 0 #ffffff30, inset 0 -2px 0 #15161899, 0 1px 0 #0b0b0c; }
.start .key.pri { background: linear-gradient(180deg, #e0d3b4, #c4b38f 55%, #a8987a); color: #23211b; text-shadow: 0 1px 0 #ffffff55;
  box-shadow: inset 0 1px 0 #fff7, inset 0 -4px 0 #7d6f55, 0 3px 0 #0b0b0c, 0 6px 10px #0009; }
.start .lamp { width: 12px; height: 12px; border-radius: 50%; flex: none; background: radial-gradient(circle at 35% 35%, #6a4a14, #2a1c06); box-shadow: inset 0 0 0 1px #000, 0 0 0 3px #1b1c1e; }
.start .lamp.on { background: radial-gradient(circle at 35% 35%, #fff0b0, #ffb000 45%, #a86400); box-shadow: inset 0 0 0 1px #000, 0 0 0 3px #1b1c1e, 0 0 12px #ffb000cc; }
.start .n { margin-left: auto; font-size: 10px; opacity: .55; letter-spacing: 1px; }
```

- [ ] **Paso 4: SALIR por IPC y audio sin interacción previa en Electron**

En `src/preload/index.ts`, dentro del objeto expuesto, después de `kind: 'electron',`:
```ts
  quit: () => ipcRenderer.send('app:quit'),
```
En `src/main/index.ts`, después de los `ipcMain.handle` de Steam:
```ts
ipcMain.on('app:quit', () => app.quit());
```
Y dentro de `webPreferences`, después de `sandbox: true,`:
```ts
      autoplayPolicy: 'no-user-gesture-required',   // la intro suena desde el primer segundo
```
En `src/renderer/globals.d.ts`, dentro de `platform?: { kind: 'electron';`, sumar `quit(): void;`. En `__GAME__?`, sumar `screen?: string;`.

- [ ] **Paso 5: chequeo de tipos**

Correr: `npm run typecheck`
Se espera que PASE.

- [ ] **Paso 6: commit**

```bash
git add src/intro src/ui/startScreen.ts src/ui/startScreen.css src/preload/index.ts src/main/index.ts src/renderer/globals.d.ts
git commit -m "Intro en pantalla, logo provisorio de MAGNAR y pantalla de inicio"
```

---

### Tarea 6: conectar todo en el arranque y probarlo de punta a punta

**Archivos:**
- Modificar:
  - `src/renderer/game.ts`: recorrido de pantallas;
  - `src/ui/gameOver.ts`: tecla M para volver al inicio;
  - `src/renderer/style.css`: puerta web;
  - `tests/e2e/game.spec.ts`, `gameover.spec.ts`, `hud.spec.ts` y `shots.spec.ts`: agregar `&intro=0` a cada `page.goto('/?seed=20261124')`.
- Crear: `tests/e2e/intro.spec.ts`

**Interfaces:**
- Consume: `planStart` y `markIntroSeen` (Tarea 2); `createAudioEngine` (Tarea 3); `createIntro` y `createStartScreen` (Tarea 5).
- Produce:
  - `window.__GAME__.screen`: `'gate' | 'intro' | 'start' | 'play'`;
  - `createGameOver(parent, onRestart, onMenu)`.

- [ ] **Paso 1: escribir la prueba de punta a punta que falla**

```ts
// tests/e2e/intro.spec.ts
import { expect, type Page, test } from '@playwright/test';

const screen = (page: Page): Promise<string | undefined> => page.evaluate(() => window.__GAME__?.screen);

async function passGate(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__GAME__?.screen !== undefined, undefined, { timeout: 45_000 });
  if ((await screen(page)) === 'gate') await page.mouse.click(640, 360);
}

test('la intro aparece, se saltea con una tecla y JUGAR arranca la partida', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=20261124');
  await passGate(page);
  await expect(page.locator('.intro')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/e2e/intro-firma.png' });
  const tick0 = await page.evaluate(() => window.__GAME__!.world.tick);
  expect(tick0).toBe(0);   // la simulación está en pausa durante la intro
  await page.keyboard.press('x');
  await page.keyboard.press('x');   // la segunda pulsación no saltea el inicio
  await expect(page.locator('.start.on')).toBeVisible();
  expect(await screen(page)).toBe('start');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/e2e/inicio.png' });
  await page.locator('.start [data-act="play"]').click();
  await expect(page.locator('.hud')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__!.world.tick > 30, undefined, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('la segunda vez la intro es corta', async ({ page }) => {
  await page.goto('/?seed=20261124');
  await passGate(page);
  await page.keyboard.press('x');
  await expect(page.locator('.start.on')).toBeVisible();
  await page.reload();
  await passGate(page);
  expect(await page.evaluate(() => localStorage.getItem('magnar.introVista'))).toBe('1');
  // Corta: 5 s. A los 6,5 s ya tiene que estar el inicio.
  await expect(page.locator('.start.on')).toBeVisible({ timeout: 6_500 });
});

test('?intro=menu va directo al inicio y ?intro=0 directo a jugar', async ({ page }) => {
  await page.goto('/?seed=20261124&intro=menu');
  await page.waitForFunction(() => window.__GAME__?.screen === 'start', undefined, { timeout: 45_000 });
  await expect(page.locator('.intro')).toHaveCount(0);
  await page.goto('/?seed=20261124&intro=0');
  await page.waitForFunction(() => (window.__GAME__?.world.tick ?? 0) > 30, undefined, { timeout: 45_000 });
  expect(await screen(page)).toBe('play');
});
```

- [ ] **Paso 2: correrla para verificar que falla**

Correr: `npx playwright test tests/e2e/intro.spec.ts --project=web`
Se espera que FALLE: no existe `.intro` y `__GAME__.screen` es `undefined`.

- [ ] **Paso 3: el fin de partida suma la vuelta al inicio**

En `src/ui/gameOver.ts`:
- la firma pasa a `createGameOver(parent: HTMLElement, onRestart: () => void, onMenu: () => void): GameOver`;
- el texto de `.again` pasa a `[R] O CLIC · NUEVA PARTIDA &nbsp; [M] · INICIO`;
- el `keydown` suma `else if (e.key === 'm' || e.key === 'M') { if (shown && !done) { done = true; onMenu(); } }`.

- [ ] **Paso 4: el recorrido en `src/renderer/game.ts`**

Reemplazar el bloque `else { ... }` por esta versión. Todo lo que ya existía se mantiene; las líneas nuevas están marcadas en los comentarios.

```ts
} else {
  const input = new InputController(canvas, (sx, sy, out) => view.screenToWorld(sx, sy, out));
  const stepper = new FixedStepper();
  const governor = new QualityGovernor('high');
  const hud = createHud(document.body);
  hud.reset(world);
  const newSeed = (): number => 1 + Math.floor(Math.random() * (2 ** 31 - 2));
  // Nueva partida: se recarga con otra semilla (mapa nuevo), directo a jugar. M vuelve al inicio.
  const gameOver = createGameOver(
    document.body,
    () => location.replace(`${location.pathname}?seed=${newSeed()}&intro=0`),
    () => location.replace(`${location.pathname}?seed=${newSeed()}&intro=menu`),
  );

  // Nuevo: recorrido intro → inicio → partida. La escena se dibuja desde el primer cuadro; la simulación espera.
  let store: Storage | null = null;
  try { store = window.localStorage; } catch { store = null; }
  const plan = planStart(location.search, store);
  const audio = plan.screen === 'intro' ? createAudioEngine() : null;
  let screen: 'gate' | 'intro' | 'start' | 'play' = plan.screen;
  let intro: Intro | null = null;
  const start = createStartScreen(document.body, {
    onPlay: () => { start.hide(); screen = 'play'; },
    onQuit: window.platform ? () => window.platform!.quit() : null,
  });
  const beginIntro = (): void => {
    screen = 'intro';
    intro = createIntro(document.body, { short: plan.short, audio, onDone: () => { markIntroSeen(store); screen = 'start'; start.show(); } });
  };
  let gate: HTMLElement | null = null;
  if (plan.screen === 'intro') {
    if (audio?.suspended) {
      // Web: el navegador no deja sonar nada sin un primer gesto.
      screen = 'gate';
      gate = document.createElement('div');
      gate.className = 'gate';
      gate.textContent = 'TOCÁ PARA EMPEZAR';
      document.body.appendChild(gate);
      const open = (): void => {
        if (!gate) return;
        gate.remove(); gate = null;
        void audio!.resume().then(beginIntro, beginIntro);
        window.removeEventListener('pointerdown', open); window.removeEventListener('keydown', open);
      };
      window.addEventListener('pointerdown', open); window.addEventListener('keydown', open);
    } else beginIntro();
  } else if (plan.screen === 'start') start.show();
  // Saltear la intro: cualquier tecla, clic o botón del mando.
  const skip = (): void => { if (screen === 'intro') intro?.skip(); };
  window.addEventListener('keydown', skip);
  window.addEventListener('pointerdown', skip);
  let padHeld = true;

  window.__GAME__ = {
    diagnostics: view.diagnostics, world, forceOver: (kind: number) => { world.over = kind; },
    get screen() { return screen; },
  };
  let last = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    if (screen === 'play') {
      const steps = stepper.advance(elapsed);
      const intent = input.poll(world.star.x, world.star.y);
      for (let i = 0; i < steps; i++) { step(world, intent); intent.fire = false; }
    } else {
      if (screen === 'intro') {
        intro?.update(elapsed);
        let down = false;
        if (navigator.getGamepads) for (const p of navigator.getGamepads()) if (p) for (const b of p.buttons) if (b.pressed) down = true;
        if (down && !padHeld) skip();
        padHeld = down;
      }
      start.update();
    }
    view.update(world, stepper.alpha, now / 1000);
    view.render();
    hud.setVisible(screen === 'play' && world.over === 0);
    hud.update(world, view, elapsed, window.innerWidth, window.innerHeight);
    gameOver.update(world, elapsed);
    const next = governor.sample(elapsed * 1000);
    if (next) view.setQuality(next);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
```

Importaciones nuevas al principio de `game.ts`:
```ts
import { markIntroSeen, planStart } from '../app/flow';
import { createAudioEngine } from '../audio/engine';
import { createIntro, type Intro } from '../intro/intro';
import { createStartScreen } from '../ui/startScreen';
```

Nota sobre la doble pulsación de la prueba: la primera tecla llama a `intro.skip()`, que pasa `screen` a `'start'` dentro de `onDone`. La segunda tecla ya no saltea nada, porque `skip` sólo actúa con `screen === 'intro'`, y el inicio sólo responde a Enter, espacio o Escape. Cuando la primera pulsación cierra la puerta web, ese mismo evento llega también a `skip`, pero en ese momento `screen` todavía es `'gate'`, así que no saltea la intro.

En `src/renderer/style.css`, agregar:
```css
.gate { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: #000; cursor: pointer;
  font-family: 'Cascadia Mono', 'Consolas', 'DejaVu Sans Mono', 'Liberation Mono', monospace; font-size: 13px; letter-spacing: 6px; color: #d8cfb8;
  animation: blink 1.6s steps(2, start) infinite; }
```
(La animación `blink` ya está definida en `gameOver.css`, que se carga siempre.)

- [ ] **Paso 5: actualizar las pruebas existentes**

En `tests/e2e/game.spec.ts`, `gameover.spec.ts`, `hud.spec.ts` y `shots.spec.ts`, cambiar cada `page.goto('/?seed=20261124')` por `page.goto('/?seed=20261124&intro=0')`. En `gameover.spec.ts`, la espera posterior `u.searchParams.get('seed') !== '20261124'` sigue valiendo.

- [ ] **Paso 6: correr todo**

Correr: `npm test && npm run typecheck && npx playwright test --project=web`
Se espera que PASE: todas las pruebas unitarias, más las 3 nuevas de `intro.spec.ts`, más las 19 de navegador existentes.

Si Playwright falla en todo con «does not provide an export», hay un Vite viejo en el puerto 5174: matarlo y repetir.

- [ ] **Paso 7: commit**

```bash
git add src/renderer/game.ts src/renderer/style.css src/ui/gameOver.ts tests/e2e
git commit -m "Arranque con intro, puerta web, pantalla de inicio y vuelta al inicio desde el fin de partida"
```

---

### Tarea 7: verificación final

- [ ] **Paso 1: el banco de rendimiento no empeora** (la partida no cambió, pero se confirma)

Correr: `npm run bench`
Se espera un p99 cercano a la última medición (≈ 5,8 ms). Anotar el valor.

- [ ] **Paso 2: probarlo en Electron**

Correr: `npm run test:electron` (abre Electron y comprueba el aislamiento).
Después, correr `npm run dev` y escuchar la intro completa: que el platillo, la estática, la voz y el golpe de graves suenen, y que SALIR cierre la ventana.

- [ ] **Paso 3: capturas para Lucas**

Mirar `artifacts/e2e/intro-firma.png` e `inicio.png`. Sacar una captura más a mano a los 22 s de la intro (el título) y mandársela a Lucas, junto con el pedido de que la escuche y la juegue.

- [ ] **Paso 4: bitácora**

Registrar en Notion (MCP `notion-juego`, cuenta lfigueiraduarte@gmail.com) una entrada en la bitácora que diga:
- qué se construyó;
- el p99 medido;
- lo que queda pendiente: el logo definitivo, la elección entre TABLADO y PLATILLO, las sonificaciones de la NASA y el tutorial guiado.
