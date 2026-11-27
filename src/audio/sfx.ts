// Efectos de sonido sintetizados en el momento con Web Audio (sin archivos: todo propio). Graves y pesados, nada de
// sonidos de dibujito: golpes sordos, crujidos de roca, ráfagas de gas y un rugido continuo cuando el agujero negro tira.
// Cada efecto tiene un mínimo de tiempo entre repeticiones para no saturar.

export interface Sfx {
  start(): void;
  setMuted(m: boolean): void;
  setVolume(v: number): void;   // 0 a 1
  capture(): void;
  sling(): void;
  bolt(size: number): void;
  impact(size: number): void;
  breakPlanet(): void;
  hurt(): void;
  rockHit(): void;
  fracture(): void;
  ignition(): void;
  cometDown(): void;
  rumble(level: number): void;   // 0 a 1: el tirón del agujero negro (continuo)
}

export function createSfx(): Sfx {
  let a: AudioContext | null = null, out: GainNode, noise: AudioBuffer, rumbleGain: GainNode, rumbleFilter: BiquadFilterNode;
  let muted = false, vol = 1;
  const last: Record<string, number> = {};
  const ok = (key: string, gap: number): boolean => {
    if (!a || muted) return false;
    const t = a.currentTime;
    if ((last[key] ?? -9) + gap > t) return false;
    last[key] = t;
    return true;
  };

  const build = (): void => {
    a = new AudioContext();
    out = a.createGain(); out.gain.value = 0.55 * vol;
    const comp = a.createDynamicsCompressor(); comp.threshold.value = -16;
    out.connect(comp); comp.connect(a.destination);
    noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Rugido del agujero negro: ruido grave en bucle, con volumen según el tirón.
    const src = a.createBufferSource(); src.buffer = noise; src.loop = true;
    rumbleFilter = a.createBiquadFilter(); rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 90; rumbleFilter.Q.value = 4;
    rumbleGain = a.createGain(); rumbleGain.gain.value = 0;
    src.connect(rumbleFilter); rumbleFilter.connect(rumbleGain); rumbleGain.connect(out); src.start();
  };

  // Piezas: un tono que cae y una ráfaga de ruido filtrado, con envolvente.
  const tone = (f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0): void => {
    const c = a!, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  };
  const burst = (type: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, q = 1, delay = 0, attack = 0.008): void => {
    const c = a!, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  };

  return {
    start() {
      if (a) { void a.resume(); return; }
      try { build(); } catch { /* sin audio */ }
    },
    setMuted(m) { muted = m; if (a) out.gain.setTargetAtTime(m ? 0 : 0.55 * vol, a.currentTime, 0.1); },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (a && !muted) out.gain.setTargetAtTime(0.55 * vol, a.currentTime, 0.1); },
    // Algo se suma a tu órbita: un toque cristalino y bajito.
    capture() { if (!ok('cap', 0.09)) return; tone(1150 + Math.random() * 500, 900, 0.18, 0.025, 'sine'); },
    // Honda: una ráfaga corta que sube.
    sling() { if (!ok('sling', 0.08)) return; burst('bandpass', 500, 2200, 0.22, 0.18, 2.5); },
    // Bólido: un golpe grave que empuja, más grande cuanto más junta.
    bolt(size) { if (!ok('bolt', 0.15)) return; const k = Math.min(1, size / 30); tone(110, 38, 0.5 + 0.4 * k, 0.35 + 0.3 * k); burst('lowpass', 1400, 120, 0.45 + 0.3 * k, 0.25 + 0.2 * k); },
    // Choque contra un planeta: golpe sordo y crujido de roca.
    impact(size) { if (!ok('imp', 0.06)) return; const k = Math.min(1.6, size); tone(140, 45, 0.3 + 0.15 * k, 0.16 * k); burst('bandpass', 900, 300, 0.25 + 0.15 * k, 0.12 * k, 1.2); },
    // Un planeta que se parte: estruendo largo que se apaga.
    breakPlanet() { if (!ok('brk', 0.4)) return; tone(70, 28, 2.6, 0.45); burst('lowpass', 600, 60, 3.2, 0.5, 0.8, 0, 0.05); burst('bandpass', 1800, 400, 1.2, 0.12, 1.5, 0.1); },
    // Tu estrella choca contra un planeta grande: un golpe hondo.
    hurt() { if (!ok('hurt', 0.3)) return; tone(85, 30, 1.1, 0.6); burst('lowpass', 900, 70, 1.2, 0.45, 0.7); },
    // Un asteroide veloz te golpea.
    rockHit() { if (!ok('rock', 0.1)) return; tone(160, 60, 0.25, 0.2); burst('highpass', 2400, 900, 0.12, 0.08, 0.8); },
    // Te fracturás: crujido seco y un golpe grave.
    fracture() { if (!ok('frac', 0.5)) return; burst('highpass', 3500, 1200, 0.35, 0.28, 0.9); tone(60, 25, 1.6, 0.6, 'sine', 0.05); burst('lowpass', 500, 50, 1.8, 0.4, 0.8, 0.05); },
    // Ignición: una ráfaga que crece y se abre (la música sube aparte).
    ignition() { if (!ok('ign', 3)) return; burst('bandpass', 200, 3000, 2.4, 0.3, 1.5, 0, 1.2); tone(55, 110, 2.8, 0.3, 'triangle'); },
    // Un cometa destruido.
    cometDown() { if (!ok('comet', 0.3)) return; burst('bandpass', 3000, 600, 0.6, 0.2, 3); tone(400, 120, 0.5, 0.12, 'triangle'); },
    rumble(level) {
      if (!a) return;
      const v = muted ? 0 : Math.min(1, Math.max(0, level));
      rumbleGain.gain.setTargetAtTime(v * 0.55, a.currentTime, 0.4);
      rumbleFilter.frequency.setTargetAtTime(70 + v * 90, a.currentTime, 0.4);
    },
  };
}
