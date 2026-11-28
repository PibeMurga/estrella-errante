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
  voice(syllables: number): void;   // la «voz» de la civilización: sílabas sin palabras, procesadas
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
    // Un poco de sala (reverberación generada): los golpes tienen cuerpo y cola, no suenan a lata.
    const rev = a.createConvolver(), revGain = a.createGain(); revGain.gain.value = 0.35;
    const len = Math.floor(a.sampleRate * 2.6), ir = a.createBuffer(2, len, a.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); for (let i = 0; i < len; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    rev.buffer = ir;
    // Todo pasa además por un filtro que saca el brillo metálico de arriba.
    const tame = a.createBiquadFilter(); tame.type = 'lowpass'; tame.frequency.value = 6500;
    out.connect(tame); tame.connect(comp); tame.connect(rev); rev.connect(revGain); revGain.connect(comp); comp.connect(a.destination);
    noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noise.getChannelData(0);
    // Ruido rosado (menos chillón que el blanco).
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) { const wn = Math.random() * 2 - 1; b0 = 0.997 * b0 + wn * 0.029591; b1 = 0.985 * b1 + wn * 0.032534; b2 = 0.95 * b2 + wn * 0.048056; d[i] = (b0 + b1 + b2 + wn * 0.05) * 3.2; }
    // Rugido del agujero negro: ruido grave en bucle, con volumen según el tirón.
    const src = a.createBufferSource(); src.buffer = noise; src.loop = true;
    rumbleFilter = a.createBiquadFilter(); rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 90; rumbleFilter.Q.value = 4;
    rumbleGain = a.createGain(); rumbleGain.gain.value = 0;
    src.connect(rumbleFilter); rumbleFilter.connect(rumbleGain); rumbleGain.connect(out); src.start();
  };

  const v = (x: number, spread = 0.25): number => x * (1 - spread + Math.random() * spread * 2);   // cada vez distinto

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
    capture() { if (!ok('cap', 0.09)) return; const f = v(700, 0.35); tone(f, f * 0.8, v(0.22), 0.02, 'sine'); tone(f * 1.5, f * 1.2, v(0.16), 0.008, 'triangle'); },
    // Honda: una ráfaga corta que sube.
    sling() { if (!ok('sling', 0.08)) return; burst('bandpass', v(380), v(1500), v(0.28), 0.16, v(1.8)); tone(v(140), 70, 0.18, 0.06); },
    // Bólido: un golpe grave que empuja, más grande cuanto más junta.
    bolt(size) { if (!ok('bolt', 0.15)) return; const k = Math.min(1, size / 30); tone(110, 38, 0.5 + 0.4 * k, 0.35 + 0.3 * k); burst('lowpass', 1400, 120, 0.45 + 0.3 * k, 0.25 + 0.2 * k); },
    // Choque contra un planeta: golpe sordo y crujido de roca.
    // Choques: cada uno con su textura (sordo, con crujido, con lluvia de piedritas), sorteada.
    impact(size) {
      if (!ok('imp', 0.06)) return;
      const k = Math.min(1.6, size), kind = Math.floor(Math.random() * 3);
      tone(v(110), v(38), v(0.35 + 0.2 * k), 0.18 * k);
      if (kind === 0) burst('lowpass', v(700), 90, v(0.4 + 0.2 * k), 0.16 * k, 0.8);
      else if (kind === 1) { burst('bandpass', v(600), v(220), v(0.3), 0.12 * k, 1.4); burst('highpass', v(1800), v(900), v(0.15), 0.04 * k, 0.7, 0.05); }
      else for (let n = 0; n < 4; n++) burst('bandpass', v(900, 0.5), v(400), 0.08, 0.035 * k, 2, 0.06 + n * v(0.07, 0.6));
    },
    // Un planeta que se parte: estruendo largo que se apaga.
    // Un planeta que se parte: cada vez distinto (estruendo largo, ráfagas en cascada o un rugido que crece y se corta).
    breakPlanet() {
      if (!ok('brk', 0.4)) return;
      const kind = Math.floor(Math.random() * 3);
      tone(v(62), v(26), v(2.8), 0.42);
      if (kind === 0) burst('lowpass', v(520), 55, v(3.4), 0.5, 0.8, 0, 0.06);
      else if (kind === 1) for (let n = 0; n < 5; n++) burst('lowpass', v(700), v(90), v(1.2), 0.22, 0.9, n * v(0.28, 0.5));
      else { burst('bandpass', v(160), v(900), v(1.4), 0.3, 1.2, 0, 0.9); burst('lowpass', v(400), 50, v(2.4), 0.45, 0.8, 1.3, 0.02); }
      burst('bandpass', v(1300), v(350), v(1.1), 0.07, 1.4, v(0.15));
    },
    // Tu estrella choca contra un planeta grande: un golpe hondo.
    hurt() { if (!ok('hurt', 0.3)) return; tone(v(80), v(28), v(1.2), 0.6); burst('lowpass', v(750), 60, v(1.3), 0.45, 0.7); burst('bandpass', v(420), v(160), v(0.5), 0.12, 1.2, 0.04); },
    // Un asteroide veloz te golpea.
    rockHit() { if (!ok('rock', 0.1)) return; tone(v(150), v(55), v(0.28), 0.2); burst('bandpass', v(1100), v(500), v(0.14), 0.07, 1.6); },
    // Te fracturás: crujido seco y un golpe grave.
    fracture() { if (!ok('frac', 0.5)) return; burst('highpass', 3500, 1200, 0.35, 0.28, 0.9); tone(60, 25, 1.6, 0.6, 'sine', 0.05); burst('lowpass', 500, 50, 1.8, 0.4, 0.8, 0.05); },
    // Ignición: una ráfaga que crece y se abre (la música sube aparte).
    ignition() { if (!ok('ign', 3)) return; burst('bandpass', 200, 3000, 2.4, 0.3, 1.5, 0, 1.2); tone(55, 110, 2.8, 0.3, 'triangle'); },
    // Un cometa destruido.
    voice(syllables) {
      if (!ok('voice', 0.4)) return;
      const c = a!;
      // Sílabas: dos osciladores apenas desafinados por dos formantes que se mueven (como vocales), con un vibrato lento
      // y una caída de tono al final de cada una. No dice nada: suena a habla, de lejos y extraña.
      let t = c.currentTime + 0.02;
      const base = v(110, 0.15);
      for (let k = 0; k < Math.min(18, syllables); k++) {
        const dur = v(0.13, 0.4), f = base * (k === syllables - 1 ? 0.8 : v(1, 0.18));
        const o1 = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
        o1.type = 'sawtooth'; o2.type = 'triangle';
        o1.frequency.setValueAtTime(f, t); o1.frequency.exponentialRampToValueAtTime(f * 0.86, t + dur);
        o2.frequency.setValueAtTime(f * 1.503, t); o2.frequency.exponentialRampToValueAtTime(f * 1.29, t + dur);
        lfo.frequency.value = v(6); lg.gain.value = f * 0.03; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
        const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
        f1.type = 'bandpass'; f1.Q.value = 7; f1.frequency.setValueAtTime(v(600, 0.4), t); f1.frequency.linearRampToValueAtTime(v(700, 0.4), t + dur);
        f2.type = 'bandpass'; f2.Q.value = 9; f2.frequency.setValueAtTime(v(1700, 0.35), t); f2.frequency.linearRampToValueAtTime(v(1500, 0.35), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o1.connect(f1); o1.connect(f2); o2.connect(f1); f1.connect(g); f2.connect(g); g.connect(out);
        for (const o of [o1, o2, lfo]) { o.start(t); o.stop(t + dur + 0.05); }
        t += dur + (k % 4 === 3 ? v(0.2) : v(0.035, 0.5));
      }
      // Estática de la transmisión, al principio.
      burst('bandpass', 2400, 1800, 0.35, 0.12, 0.8);
    },
    cometDown() { if (!ok('comet', 0.3)) return; burst('bandpass', 3000, 600, 0.6, 0.2, 3); tone(400, 120, 0.5, 0.12, 'triangle'); },
    rumble(level) {
      if (!a) return;
      const v = muted ? 0 : Math.min(1, Math.max(0, level));
      rumbleGain.gain.setTargetAtTime(v * 0.55, a.currentTime, 0.4);
      rumbleFilter.frequency.setTargetAtTime(70 + v * 90, a.currentTime, 0.4);
    },
  };
}
