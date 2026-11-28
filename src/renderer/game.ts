import { InputController } from '../input/controller';
import { QualityGovernor } from '../perf/qualityGovernor';
import { showFatal } from '../render/context';
import { createSpaceView } from '../render/spaceView';
import { GAME_CONFIG } from '../sim/config';
import { createNameScreen } from '../ui/nameScreen';
import { createUpgradeScreen } from '../ui/upgradeScreen';
import { savedPlanetType } from '../ui/playerName';
import { playerLook } from '../render/playerLook';
import { createAmbient } from '../audio/ambient';
import { createSfx } from '../audio/sfx';
import { stageFor, STAGE_HYPER } from '../sim/stages';
import { FixedStepper } from '../sim/loop';
import { step } from '../sim/step';
import { createWorld, PHASE_COLLAPSE, PHASE_MERGE } from '../sim/world';
import { createGameOver } from '../ui/gameOver';
import { createGuide } from '../ui/guide';
import { createTransmissions } from '../ui/transmissions';
import { createIntro } from '../ui/intro';
import { createHud } from '../ui/hud';
import { createCinematic } from '../ui/cinematic';
import { createPause } from '../ui/pause';

const canvas = document.getElementById('game') as HTMLCanvasElement;
// Cada partida, un mapa distinto. Con ?seed=N se repite un mapa (lo usan las pruebas).
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Math.floor(Math.random() * 2 ** 31);
// Con &estrella=1 la partida arranca ya como estrella (lo usan las pruebas que miden el disparo, el visor, etc.).
const asStar = new URLSearchParams(location.search).get('estrella') === '1';
// &mejoras=0 apaga la elección de mejoras (lo usan las pruebas que cambian la masa a mano).
const noUpg = asStar || new URLSearchParams(location.search).get('mejoras') === '0';
const world = createWorld({ ...GAME_CONFIG, planetStart: !asStar, upgrades: !noUpg }, seed);
if (asStar) world.star.mass = world.maxMass = 30;   // ya encendida: la enana roja recién nacida
const view = createSpaceView(canvas, { world, quality: 'high' });

if (!view.ok) {
  showFatal(view.reason);
} else {
  const input = new InputController(canvas, (sx, sy, out) => view.screenToWorld(sx, sy, out));
  const stepper = new FixedStepper();
  const governor = new QualityGovernor('high');
  const hud = createHud(document.body);
  const guide = createGuide(document.body);
  let txVoice = (_n: number): void => {};
  const tx = createTransmissions(document.body, (n) => txVoice(n));
  // Intro: la primera transmisión, con la partida quieta (sólo al venir de la pantalla del nombre).
  const intro = createIntro(document.body, (n) => txVoice(n), () => { last = performance.now(); input.poll(world.star.x, world.star.y); });
  const cine = createCinematic(document.body);
  hud.reset(world);
  // Nueva partida: se recarga con otra semilla (mapa nuevo). Las capas del dibujo arman sus índices al empezar.
  const restart = (): void => location.replace(`${location.pathname}?seed=${1 + Math.floor(Math.random() * (2 ** 31 - 2))}&n=1`);   // n=1: no vuelve a preguntar el nombre
  const gameOver = createGameOver(document.body, restart);
  // Al elegir una mejora se descarta lo apretado mientras tanto (que el clic no dispare).
  const upgradeScreen = createUpgradeScreen(document.body, () => { input.poll(world.star.x, world.star.y); });
  // Pausa con ESC (o Start): sólo mientras se juega, no en las cinemáticas ni en el cartel final.
  const canPause = (): boolean => named && !world.choosing && world.over === 0 && world.phase !== PHASE_COLLAPSE && world.phase !== PHASE_MERGE;
  const pause = createPause(document.body, {
    canPause, onRestart: restart,
    onVolume: (m, x) => { music.setVolume(m); sfx.setVolume(x); },
    onChange: (on) => { if (!on) input.poll(world.star.x, world.star.y); },   // al retomar se descarta lo apretado durante la pausa
  });
  window.__GAME__ = { diagnostics: view.diagnostics, world, forceOver: (kind: number) => { world.over = kind; } };
  // Zoom: la rueda del mouse acerca o aleja un poco la cámara; en el mando, LB acerca y RB aleja (mantenidos).
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (!pause.paused) view.rig.nudgeZoom(Math.sign(e.deltaY)); }, { passive: false });
  const pollZoomPad = (dt: number): void => {
    if (!navigator.getGamepads) return;
    for (const p of navigator.getGamepads()) {
      if (!p) continue;
      if (p.buttons[4]?.pressed) view.rig.nudgeZoom(-dt * 6);
      if (p.buttons[5]?.pressed) view.rig.nudgeZoom(dt * 6);
    }
  };
  // Antes de jugar se elige el nombre (salvo al reiniciar o en las pruebas que arrancan como estrella).
  const params = new URLSearchParams(location.search);
  // Música de fondo: arranca con el primer gesto (el navegador no deja sonar antes). M la silencia.
  const music = createAmbient(), sfx = createSfx();
  txVoice = (n) => sfx.voice(n);
  const startMusic = (): void => { music.start(); sfx.start(); };
  window.addEventListener('pointerdown', startMusic);
  window.addEventListener('keydown', (e) => { startMusic(); if ((e.key === 'm' || e.key === 'M') && named) sfx.setMuted(music.toggleMute()); });
  // Efectos: se disparan cuando cambian los contadores de eventos de la simulación.
  const ev = { orb: 0, shots: 0, bolts: 0, imp: 0, brk: 0, hits: 0, grave: 0, rock: 0, frac: 0, ign: 0, kills: 0, dis: 0, small: 0 };
  const syncEv = (): void => {
    ev.orb = world.orbitingCount; ev.shots = world.shots; ev.bolts = world.bolts; ev.imp = world.impactCount; ev.brk = world.breakFxCount;
    ev.hits = world.hits; ev.grave = world.graveHits; ev.rock = world.rockHits; ev.frac = world.fractures; ev.ign = world.ignitions;
    ev.kills = world.cometKills; ev.dis = world.disintegrated; ev.small = world.smallHits;
  };
  syncEv();
  const playEvents = (): void => {
    const w = world;
    if (w.orbitingCount > ev.orb) sfx.capture();
    if (w.shots > ev.shots) sfx.sling();
    if (w.bolts > ev.bolts) sfx.bolt(w.lastBoltSize);
    if (w.impactCount > ev.imp) sfx.impact(w.impacts[((w.impactCount - 1) % 16) * 4 + 2]!);
    if (w.breakFxCount > ev.brk || w.disintegrated > ev.dis) sfx.breakPlanet();
    if (w.hits > ev.hits || w.graveHits > ev.grave) sfx.hurt();
    if (w.rockHits > ev.rock) sfx.rockHit();
    if (w.fractures > ev.frac) sfx.fracture();
    if (w.ignitions > ev.ign) sfx.ignition();
    if (w.cometKills > ev.kills) sfx.cometDown();
    if (w.smallHits > ev.small) sfx.rockHit();
    // El rugido del agujero negro: crece al acercarte a su zona de marea.
    const bh = w.bh, d = Math.hypot(bh.x - w.star.x, bh.y - w.star.y), reach = bh.radius * w.config.bhTidalR * 2.2;
    sfx.rumble(bh.active && w.phase === 0 && w.over === 0 ? Math.max(w.tide, 1 - d / reach) : 0);
    syncEv();
  };
  let lastIgn = world.ignitions;
  let named = asStar || params.get('n') === '1';
  playerLook.planetType = savedPlanetType();
  if (!named) createNameScreen(document.body, (name, type) => { named = true; playerLook.planetType = type; hud.setName(name); last = performance.now(); intro.start(name); });
  let last = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    pause.pollPad(canPause());
    if (!pause.paused) pollZoomPad(elapsed);
    intro.update(elapsed);
    const steps = pause.paused || !named || intro.active ? 0 : stepper.advance(elapsed);
    // El control se lee sólo en los cuadros que avanzan la simulación: así un clic muy corto no se pierde
    // en un cuadro sin pasos (a más de 60 cuadros por segundo los hay).
    if (steps > 0) {
      const intent = input.poll(world.star.x, world.star.y);
      for (let i = 0; i < steps; i++) { step(world, intent); intent.fire = false; intent.collapse = false; }
    }
    view.update(world, stepper.alpha, now / 1000);
    view.render();
    hud.setVisible(!intro.active && world.over === 0 && world.phase !== PHASE_COLLAPSE && world.phase !== PHASE_MERGE);
    hud.update(world, view, elapsed, window.innerWidth, window.innerHeight);
    tx.update(world, elapsed, named && !pause.paused && !asStar && !intro.active);
    guide.update(world, view, elapsed, window.innerWidth, window.innerHeight, named && !pause.paused && !tx.busy && !intro.active);
    music.setGrowth(stageFor(world.star.mass) / STAGE_HYPER);
    if (world.ignitions > lastIgn) { lastIgn = world.ignitions; music.swell(); }
    playEvents();
    upgradeScreen.update(world);
    gameOver.update(world, elapsed);
    cine.update(world, elapsed);
    const next = governor.sample(elapsed * 1000);
    if (next) view.setQuality(next);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
