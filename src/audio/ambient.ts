// Música de fondo generada en el momento con Web Audio (sin archivos ni dependencias: 100 % propia).
// Graves profundos (un zumbido en La y una sub-bajo que respira), acordes de pad que cambian despacio con un eco que
// rebota de lado a lado, un filtro que se abre y se cierra muy lento, y notas agudas sueltas como estrellas.
// Reacciona al juego: se abre y se ilumina a medida que crecés; en la ignición, sube.

export interface Ambient {
  start(): void;
  toggleMute(): boolean;      // devuelve si quedó en silencio
  setGrowth(g: number): void;  // 0 (planeta recién nacido) a 1 (hipergigante)
  setVolume(v: number): void;  // 0 a 1
  swell(): void;               // un golpe de volumen y brillo (ignición)
}

const NOTE = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);   // número MIDI a hercios

// Acordes del pad (MIDI): La menor 9, Fa mayor 7, Do mayor 7 y Sol 6 (sobre la nota grave).
const CHORDS: readonly (readonly number[])[] = [
  [57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 64],
];
const STARS = [81, 84, 86, 88, 91, 93, 96];   // pentatónica de La, aguda

export function createAmbient(): Ambient {
  let ctx: AudioContext | null = null;
  let master: GainNode, padFilter: BiquadFilterNode, droneFilter: BiquadFilterNode, delayIn: GainNode;
  const pads: OscillatorNode[] = [];
  let muted = false, growth = 0, chordIx = 0, timer = 0, vol = 1;
  const level = (): number => (muted ? 0 : 0.32 * vol);

  const build = (): void => {
    const a = new AudioContext();
    ctx = a;
    master = a.createGain(); master.gain.value = 0;
    const comp = a.createDynamicsCompressor();
    master.connect(comp); comp.connect(a.destination);
    master.gain.setTargetAtTime(level(), a.currentTime, 2.5);   // entra suave

    // Eco estéreo: dos retardos cruzados (izquierda ↔ derecha) con realimentación.
    delayIn = a.createGain(); delayIn.gain.value = 0.5;
    const dl = a.createDelay(2), dr = a.createDelay(2);
    dl.delayTime.value = 0.43; dr.delayTime.value = 0.61;
    const fbL = a.createGain(), fbR = a.createGain(); fbL.gain.value = 0.42; fbR.gain.value = 0.42;
    const panL = a.createStereoPanner(), panR = a.createStereoPanner(); panL.pan.value = -0.8; panR.pan.value = 0.8;
    const echoTone = a.createBiquadFilter(); echoTone.type = 'lowpass'; echoTone.frequency.value = 2600;
    delayIn.connect(dl); dl.connect(fbL); fbL.connect(dr); dr.connect(fbR); fbR.connect(dl);
    dl.connect(panL); dr.connect(panR); panL.connect(echoTone); panR.connect(echoTone); echoTone.connect(master);

    // Zumbido grave: sierras desafinadas apenas en La1, Mi2 y La2, por un filtro que respira muy lento.
    droneFilter = a.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 260; droneFilter.Q.value = 6;
    const droneGain = a.createGain(); droneGain.gain.value = 0.22;
    droneFilter.connect(droneGain); droneGain.connect(master);
    for (const [n, det] of [[33, -7], [33, 6], [40, 3], [45, -4]] as const) {
      const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
      o.connect(droneFilter); o.start();
    }
    const lfo = a.createOscillator(), lfoGain = a.createGain();
    lfo.frequency.value = 0.031; lfoGain.gain.value = 190;
    lfo.connect(lfoGain); lfoGain.connect(droneFilter.frequency); lfo.start();

    // Sub-bajo que respira (Mi1).
    const sub = a.createOscillator(), subGain = a.createGain();
    sub.type = 'sine'; sub.frequency.value = NOTE(28); subGain.gain.value = 0.28;
    const breath = a.createOscillator(), breathGain = a.createGain();
    breath.frequency.value = 0.07; breathGain.gain.value = 0.16;
    breath.connect(breathGain); breathGain.connect(subGain.gain); breath.start();
    sub.connect(subGain); subGain.connect(master); sub.start();

    // Pad: cuatro voces (triángulo y seno) que se deslizan de acorde en acorde, con un paneo que gira.
    padFilter = a.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 900; padFilter.Q.value = 2;
    const padGain = a.createGain(); padGain.gain.value = 0.09;
    const rot = a.createStereoPanner();
    const rotL = a.createOscillator(), rotG = a.createGain(); rotL.frequency.value = 0.05; rotG.gain.value = 0.7;
    rotL.connect(rotG); rotG.connect(rot.pan); rotL.start();
    padFilter.connect(padGain); padGain.connect(rot); rot.connect(master); rot.connect(delayIn);
    for (let v = 0; v < 4; v++) {
      const o = a.createOscillator(); o.type = v % 2 ? 'sine' : 'triangle';
      o.frequency.value = NOTE(CHORDS[0]![v]!); o.detune.value = (v - 1.5) * 4;
      o.connect(padFilter); o.start(); pads.push(o);
    }
    const sweep = a.createOscillator(), sweepG = a.createGain();
    sweep.frequency.value = 0.019; sweepG.gain.value = 600;
    sweep.connect(sweepG); sweepG.connect(padFilter.frequency); sweep.start();

    timer = window.setInterval(tick, 500);
  };

  let nextChord = 0, nextStar = 0;
  const tick = (): void => {
    const a = ctx; if (!a) return;
    const t = a.currentTime;
    if (t >= nextChord) {
      chordIx = (chordIx + 1) % CHORDS.length;
      const ch = CHORDS[chordIx]!;
      for (let v = 0; v < pads.length; v++) pads[v]!.frequency.setTargetAtTime(NOTE(ch[v]!), t, 2.2);   // se desliza
      nextChord = t + 16;
    }
    if (t >= nextStar) {
      // Una estrella: nota aguda suave con ataque lento y cola larga, que se va por el eco.
      const o = a.createOscillator(), g = a.createGain(), p = a.createStereoPanner();
      o.type = 'sine'; o.frequency.value = NOTE(STARS[Math.floor(Math.random() * STARS.length)]!);
      p.pan.value = Math.random() * 1.6 - 0.8;
      g.gain.value = 0; g.gain.setTargetAtTime(0.05 + 0.04 * growth, t, 0.4); g.gain.setTargetAtTime(0, t + 1.2, 1.6);
      o.connect(g); g.connect(p); p.connect(master); p.connect(delayIn);
      o.start(t); o.stop(t + 9);
      nextStar = t + 2 + Math.random() * 4 - growth * 1.2;
    }
    // Crecer abre el sonido: más brillo en el pad y en el zumbido.
    padFilter.Q.setTargetAtTime(2 + growth * 3, t, 3);
    droneFilter.Q.setTargetAtTime(6 + growth * 4, t, 3);
  };

  return {
    start() {
      if (ctx) { void ctx.resume(); return; }
      try { build(); } catch { /* sin audio en este equipo */ }
    },
    toggleMute() {
      muted = !muted;
      if (ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.3);
      return muted;
    },
    setGrowth(g) { growth = Math.max(0, Math.min(1, g)); },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.15); },
    swell() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(0.5 * vol, t, 0.6);
      master.gain.setTargetAtTime(level(), t + 3.5, 2);
      padFilter.frequency.setTargetAtTime(2400, t, 0.8);
      padFilter.frequency.setTargetAtTime(900, t + 3, 3);
    },
  };
  void timer;
}
