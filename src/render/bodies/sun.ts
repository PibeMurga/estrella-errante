import { AdditiveBlending, DirectionalLight, Group, Mesh, PlaneGeometry, PointLight, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { sceneLight } from '../lighting';
import { STAGE_HYPER, STAGE_IGNITION } from '../../sim/stages';
import { DEAD, OVER_SHATTERED, OVER_SWALLOWED, PHASE_COLLAPSE, PHASE_HUNT, PHASE_IGNITION, PHASE_MERGE, PHASE_PLAY, starSize } from '../../sim/world';
import { toWorld } from '../cameraRig';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';
import { smoothToward } from '../smooth';

// Paleta del sol por etapa (caliente, media, borde). Enana roja → amarilla → blanca → gigante azul → supergigante → hipergigante.
const PALETTES: readonly (readonly number[])[] = [
  [1.0, 0.42, 0.10, 0.85, 0.16, 0.03, 0.50, 0.05, 0.01],
  [1.0, 0.58, 0.18, 0.95, 0.30, 0.05, 0.62, 0.09, 0.015],
  [1.0, 0.90, 0.72, 1.0, 0.70, 0.42, 0.78, 0.38, 0.18],
  [0.78, 0.88, 1.0, 0.46, 0.62, 1.0, 0.24, 0.30, 0.72],
  [0.92, 0.96, 1.0, 0.62, 0.76, 1.0, 0.36, 0.42, 0.86],
  [1.0, 0.86, 0.55, 1.0, 0.62, 0.25, 0.80, 0.30, 0.08],
];

const SUN_VERT = /* glsl */ `varying vec3 vN; varying vec3 vO; varying vec3 vV;
void main(){ vO = position; vec4 w = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;

// Superficie del sol: granulación que hierve, manchas, fáculas y oscurecimiento hacia el borde.
// uSeed: distinta en cada partida, así la secuencia de erupciones nunca se repite.
const HASH_GLSL = /* glsl */ `uniform float uSeed; float h1(float n){ return fract(sin(n*1.7 + 3.1)*43758.5453); }
`;
const SUN_FRAG = /* glsl */ HASH_GLSL + `uniform vec3 uCamDir; uniform float uTime; uniform float uIntensity; uniform vec3 uHot; uniform vec3 uMid; uniform vec3 uCool; varying vec3 vN; varying vec3 vO; varying vec3 vV;
void main(){
  vec3 p = normalize(vO); float t = uTime;
  float mu = clamp(dot(normalize(vN), normalize(vV)), 0., 1.);
  // El plasma hierve: la granulación se deforma y fluye (dos capas de ruido que se mueven a ritmos distintos).
  vec3 q = p*22. + vec3(0., t*.3, t*.2) + .45*vec3(snoise(p*6.+t*.42), snoise(p*6.+9.+t*.38), snoise(p*6.+17.+t*.45)) + .18*vec3(snoise(p*14.-t*.6), snoise(p*14.+5.-t*.55), 0.);
  float c = worley(q); float gran = 1. - smoothstep(.05, .85, c);
  float fine = fbm(p*60. + vec3(t*.7, -t*.5, t*.4), 3)*.5+.5;
  float sg = fbm(p*3.2 + vec3(t*.05, t*.03, -t*.04), 5)*.5+.5;   // supergranos que respiran
  // Manchas y fáculas: giran despacio con la estrella (más rápido en el ecuador, como el Sol) y cambian de forma de a poco.
  float wr = t*.06*(1. - .35*p.y*p.y);   // y el ecuador, más rápido que los polos
  vec3 pr = vec3(p.x*cos(wr) - p.z*sin(wr), p.y, p.x*sin(wr) + p.z*cos(wr));
  float sp = fbm(pr*2.6 + 11.3 + vec3(0., t*.006, t*.018), 5)*.5+.5;
  float spot = smoothstep(.73, .78, sp);
  float pen = smoothstep(.69, .74, sp);
  float fac = smoothstep(.62, .8, fbm(pr*9. + 3.1 + vec3(t*.03), 4)*.5+.5) * (1. - mu);
  vec3 hot = uHot, mid = uMid, cool = uCool;
  vec3 col = mix(mid, hot, gran*.75 + fine*.15);
  col *= .82 + .3*sg;
  col = mix(col, cool*.55, pen*.55); col = mix(col, vec3(.12,.03,.01), spot*.85);
  col += hot*fac*.35;
  // Fulguraciones: cada tanto un punto de la superficie estalla (destello que sube rápido y se apaga más lento)
  // y deja una onda que se abre sobre el plasma. Pocas, cada una a su ritmo y en un lugar distinto cada vez.
  float flare = 0.;
  for (int i = 0; i < 3; i++) {
    float fi = float(i), tt = t/(6. + fi*2.7) + fi*.37 + fract(uSeed*.137 + fi*.61), id = floor(tt) + uSeed, ph = fract(tt);
    if (h1(id*2.3 + fi*5.9) < .45) continue;   // a veces no estalla: sin ritmo fijo
    float u1 = h1(id*12.9 + fi*7.1), u2 = h1(id*78.2 + fi*3.3)*2. - 1., sxy = sqrt(1. - u2*u2);
    // Siempre del lado que mira a la cámara (en el mundo, no en la superficie que gira): que se vean.
    vec3 c = normalize(vec3(cos(u1*6.2832)*sxy, u2, sin(u1*6.2832)*sxy) + uCamDir*1.3);
    float dd = distance(normalize(vN), c);
    if (dd > .45) continue;
    float env = smoothstep(0., .05, ph) * exp(-ph*6.);
    float tur = snoise(p*40. + id) * .5 + .5;
    float core = exp(-dd*dd/(.0012 + .01*ph)) * (1.6 + tur);
    float wave = exp(-pow((dd - (.02 + .12*ph))/.04, 2.)) * .15 * tur;   // apenas un brillo que se corre, sin anillo
    flare += env * (core + wave) * (.6 + .8*h1(id*3.7 + fi));
  }
  col += mix(hot, vec3(1., .96, .88), .55) * flare * 1.6;
  float limb = pow(mu, .55);
  col = mix(cool*.7, col, smoothstep(0., .55, mu)) * (.28 + .72*limb);
  gl_FragColor = vec4(col * uIntensity, 1.);
}`;

const HALO_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

// Cromosfera, protuberancias y corona cálida en una lámina que siempre mira a la cámara.
const HALO_FRAG = /* glsl */ HASH_GLSL + `uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
void main(){
  vec2 d = (vUv*2.-1.)*3.5; float r = length(d); float a = atan(d.y, d.x);
  if (r < .985) discard;
  float h = r - 1.;
  vec3 ring = uTint * vec3(1.,.55,.4) * exp(-h*55.) * 1.8;
  float flow = fbm(vec3(cos(a)*3. + uTime*.06, sin(a)*3. - uTime*.045, h*3.5 - uTime*.45), 5)*.5+.5;   // el plasma del borde fluye y sube
  float loops = smoothstep(.6, .8, flow) * exp(-h*9.) * smoothstep(0., .03, h);
  float spikes = smoothstep(.55, .9, fbm(vec3(cos(a)*7., sin(a)*7., uTime*.2), 4)*.5+.5);
  vec3 prom = uTint * vec3(1.,.7,.55) * loops * (1.2 + spikes) * 1.4;
  // Eyecciones del borde: cada una distinta. Según su tipo es un arco de plasma con los dos pies en el borde, un chorro
  // fino que se inclina, una columna ancha que se dobla o una nube de gas; cambian la altura, el grosor, la inclinación y el color.
  for (int i = 0; i < 2; i++) {
    float fi = float(i), tt = uTime/(7.5 + fi*3.4) + fi*.53 + fract(uSeed*.271 + fi*.43), id = floor(tt) + uSeed, ph = fract(tt);
    if (h1(id*6.7 + fi*1.3) < .4) continue;
    float ang = h1(id*41.3 + fi*9.7) * 6.2832;
    float sa = atan(sin(a - ang), cos(a - ang));
    if (abs(sa) > .9 || h < 0.) continue;
    float kind = h1(id*11.1 + fi*4.4);
    float top = (.1 + .5*h1(id*5.1 + fi)) * pow(ph, .55);
    float wid = .02 + .06*h1(id*8.8 + fi);
    float lean = (h1(id*2.2 + fi) - .5) * 1.4;
    float x = sa - lean*h;                                  // coordenada a lo ancho, inclinada con la altura
    float n = fbm(vec3(d*4. + id, uTime*.5), 3)*.5+.5;
    float m;
    if (kind < .35) {                                         // chorro fino que se inclina; a veces suelta una gota
      m = exp(-pow(x/(wid*(1. + 2.5*h)), 2.)) * (1. - smoothstep(top*.5, top, h));
      m += step(.6, h1(id*7.7)) * exp(-(pow(h - top, 2.) + x*x)/(.0015 + .003*ph)) * .9;
    } else if (kind < .45) {                                 // arco (raro): un lazo de plasma con los dos pies en el borde
      float A = top*.8 + .03;
      float ar = length(vec2(x*1.2, h)), wob = .35*wid*snoise(vec3(x*20., h*20., uTime*.4 + id));
      float th = wid*(.4 + .8*n);                            // grosor irregular a lo largo del arco
      m = exp(-pow((ar - A + wob)/th, 2.));
      m *= smoothstep(.25, .6, n) * (1. - .55*smoothstep(.0, A, h)) * (.6 + .9*n);   // cortes, nudos y la cima más tenue
    } else if (kind < .8) {                                  // columna ancha y difusa que sube y se dobla (como un surge)
      float bend = x - .25*top*sin(h/max(top, .01)*2.2 + id);
      m = exp(-pow(bend/(wid*2.2 + .05*h), 2.)) * (1. - smoothstep(top*.7, top*1.05, h)) * (.35 + .9*n);
    } else {                                                 // nube de gas que se hincha y se va
      m = (1. - smoothstep(top*.25, top*.6*(1. + .4*n), length(vec2(x, h - top*.55)))) * (.4 + .7*n);
    }
    float env = smoothstep(0., .08, ph) * (1. - smoothstep(.55, 1., ph));
    vec3 tcol = mix(uTint * vec3(1.15,.75,.45), uTint * vec3(1.3,1.1,.9), h1(id*9.3 + fi));   // más rojiza o más blanca
    prom += tcol * m * env * 2.;
  }
  // La corona respira y titila: zonas que se encienden y se apagan, nunca quieta.
  float breathe = .78 + .32*(fbm(vec3(cos(a)*1.5 + uTime*.05, sin(a)*1.5, uTime*.22), 3)*.5+.5) + .05*sin(uTime*2.1 + a*3.);
  // Corona: corrientes suaves que salen hacia afuera, giran despacio y cambian de forma; nunca quieta.
  float ang = a + uTime*.025;
  // Más irregular: el contorno de la corona se deforma (lóbulos que crecen y se achican) y las corrientes se cortan.
  float lobe = fbm(vec3(cos(ang)*1.4 + 7., sin(ang)*1.4, uTime*.05), 3);
  float hh = h * (1. - .45*lobe);
  float streams = fbm(vec3(cos(ang)*2.2, sin(ang)*2.2, hh*1.2 - uTime*.18), 4)*.5+.5;
  float rays = .8 + .3*(fbm(vec3(cos(ang)*2.5, sin(ang)*2.5, uTime*.07 + hh*.6), 3)*.5+.5);   // suave: sin rayos marcados
  float clumps = .7 + .6*(fbm(vec3(d*1.6, uTime*.12), 3)*.5+.5);
  vec3 cor = uTint * exp(-hh*2.2) * .28 * breathe * (.45 + .9*streams) * rays * clumps;
  gl_FragColor = vec4((ring + prom + cor) * (1. - smoothstep(1.8, 3.3, r)), 1.);
}`;

// Eyecciones de frente: plasma que sube desde un punto del disco hacia la cámara. Visto de frente es un estallido
// turbulento que se abre (estirado hacia afuera del disco, por la perspectiva) y vuelve a caer apagándose.
const FRONT_FRAG = /* glsl */ HASH_GLSL + `uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
void main(){
  vec2 d = (vUv*2.-1.)*1.1; float r = length(d);
  if (r > 1.) discard;
  vec3 col = vec3(0.);
  for (int i = 0; i < 2; i++) {
    float fi = float(i), tt = uTime/(8.5 + fi*3.9) + fi*.71 + .3 + fract(uSeed*.389 + fi*.29), id = floor(tt) + uSeed, ph = fract(tt);
    if (h1(id*3.9 + fi*8.1) < .4) continue;
    float ra = sqrt(h1(id*17.3 + fi)) * .75, aa = h1(id*29.1 + fi*2.) * 6.2832;
    vec2 c = vec2(cos(aa), sin(aa)) * ra;
    vec2 q = d - c;
    vec2 out1 = ra > .01 ? c/ra : vec2(1., 0.);
    float along = dot(q, out1), side = dot(q, vec2(-out1.y, out1.x));
    float stretch = 1. + 1.6*ra;                       // más cerca del borde, más se ve de costado: se estira
    float R = .03 + .16*pow(ph, .5);
    float e = length(vec2(along/stretch, side));
    float n = fbm(vec3(q*18., id + uTime*.7), 3)*.5+.5;
    float kind = h1(id*13.7 + fi*6.1), body;
    if (kind < .55) body = 1. - smoothstep(R*.4, R*(1. + .5*n), e);                             // estallido
    else body = (1. - smoothstep(R*.2, R*(.8 + .6*n), e)) * (.3 + .8*n);                        // mancha difusa que se hincha
    float env = smoothstep(0., .06, ph) * (1. - smoothstep(.45, 1., ph));
    float fil = smoothstep(.55, .75, n) * body;        // filamentos más brillantes
    vec3 tcol = mix(vec3(1.2,.85,.55), vec3(1.35,1.15,.95), h1(id*2.9 + fi));
    col += uTint * tcol * (body*.6 + fil*1.2) * env * 1.8;
  }
  gl_FragColor = vec4(col * (1. - smoothstep(.9, 1., r)), 1.);
}`;

// Erupciones de la hipergigante: una cáscara de gas que sale despedida y se expande en un anillo (como Eta Carinae).
const SHELL_FRAG = /* glsl */ `uniform float uT; uniform vec3 uTint; varying vec2 vUv;
void main(){
  vec2 d = (vUv*2.-1.)*6.; float r = length(d); float a = atan(d.y, d.x);
  float R = 1.2 + 3.8*(1. - exp(-uT*.6));
  float n = fbm(vec3(cos(a)*2.5, sin(a)*2.5, uT*.2), 4)*.5+.5;
  float ring = exp(-pow((r - R)/(.25 + .35*n), 2.)) * (1. - smoothstep(2., 5., uT)) * smoothstep(0., .3, uT) * (.4 + .8*n);
  gl_FragColor = vec4(uTint * ring * .6, 1.);
}`;
const ERUPTION_EVERY = 13, ERUPTION_LAST = 5, PULSE_PERIOD = 5.5;
const smooth01 = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export const starRenderRadius = starSize;

// La estrella del jugador como un sol, con su luz para los cuerpos (posición compartida en `sunPos`).
export function createSunLayer(sunPos: Vector3): Layer {
  const pal = Float32Array.from(PALETTES[0]!);
  const hot = new Vector3(), mid = new Vector3(), cool = new Vector3(), tint = new Vector3();
  const camDir = new Vector3();
  const seed = { value: Math.floor(Math.random() * 1000) };
  let lastWorld: unknown = null;
  const sunMat = new ShaderMaterial({ uniforms: { uSeed: seed, uCamDir: { value: camDir }, uTime: { value: 0 }, uIntensity: { value: 1.45 }, uHot: { value: hot }, uMid: { value: mid }, uCool: { value: cool } }, vertexShader: SUN_VERT, fragmentShader: NOISE_GLSL + SUN_FRAG });
  const sun = new Mesh(new SphereGeometry(1, 128, 64), sunMat);
  const haloMat = new ShaderMaterial({
    uniforms: { uSeed: seed, uTime: { value: 0 }, uTint: { value: tint } }, vertexShader: HALO_VERT, fragmentShader: NOISE_GLSL + HALO_FRAG,
    depthWrite: false, transparent: true, blending: AdditiveBlending,
  });
  const halo = new Mesh(new PlaneGeometry(7, 7), haloMat);
  const shellMat = new ShaderMaterial({
    uniforms: { uT: { value: 0 }, uTint: { value: tint } }, vertexShader: HALO_VERT, fragmentShader: NOISE_GLSL + SHELL_FRAG,
    depthWrite: false, transparent: true, blending: AdditiveBlending,
  });
  const shell = new Mesh(new PlaneGeometry(12, 12), shellMat);
  const frontMat = new ShaderMaterial({
    uniforms: { uSeed: seed, uTime: { value: 0 }, uTint: { value: tint } }, vertexShader: HALO_VERT, fragmentShader: NOISE_GLSL + FRONT_FRAG,
    depthWrite: false, depthTest: false, transparent: true, blending: AdditiveBlending,
  });
  const front = new Mesh(new PlaneGeometry(2.2, 2.2), frontMat);
  front.renderOrder = 2;
  shell.visible = false;
  let baseIntensity = 1.45, baseLight = 2.4;
  const light = new PointLight(0xffc890, 2.4, 0, 0);
  const group = new Group();
  // Siendo planeta, la luz viene de una estrella lejana (tenue y de una dirección fija).
  const far = new DirectionalLight(0xdfe6ff, 0);
  group.add(sun, halo, shell, front, light, far, far.target);
  const FAR = new Vector3(-640, 760, 260);   // dirección de la estrella lejana (relativa a vos)
  const starAt = new Vector3(), lamp = new Vector3(), lampT = new Vector3();
  let lampInit = false, levelS = 0.85;
  let shownR = -1;   // radio que se ve: sigue al radio real con una curva suave, sin saltos

  return {
    object: group,
    update(ctx) {
      toWorld(ctx.starX, ctx.starY, sunPos);
      const w = ctx.world;
      // Encendido: 0 siendo planeta; en la ignición sube después del destello; 1 desde que nació tu estrella.
      const ign = w.phase === PHASE_IGNITION ? smooth01((w.phaseTime - 1.2) / 1.8) : w.ignited ? 1 : 0;
      starAt.copy(sunPos);
      // Siendo planeta, la luz viene de la estrella del mapa más cercana (si hay una a la vuelta) o de una lejana.
      let near = -1, nd = Infinity;
      for (let q = 0; q < w.mapStars.length; q++) {
        const i = w.mapStars[q]!;
        if (w.state[i] === DEAD) continue;
        const d = Math.hypot(w.x[i] - ctx.starX, w.y[i] - ctx.starY) - w.radius[i];
        if (d < nd) { nd = d; near = i; }
      }
      const NEAR = 380, closeness = near >= 0 && nd < NEAR ? 1 - nd / NEAR : 0;
      if (closeness > 0) lampT.set(w.x[near], 0, -w.y[near]); else lampT.copy(starAt).add(FAR);
      // La luz se mueve y cambia suave (en uno o dos segundos): nada de saltos cuando cambia la estrella más cercana.
      if (!lampInit) { lamp.copy(lampT); lampInit = true; } else lamp.lerp(lampT, Math.min(1, ctx.dt * 1.2));
      // La luz de los cuerpos sale de esa estrella y pasa a la tuya con el encendido.
      sunPos.set(lamp.x + (starAt.x - lamp.x) * ign, lamp.y + (starAt.y - lamp.y) * ign, lamp.z + (starAt.z - lamp.z) * ign);
      levelS += ((0.85 + 0.3 * closeness) - levelS) * Math.min(1, ctx.dt * 1.2);   // siendo planeta se ve bien, aunque más tenue que con tu sol
      sceneLight.level = levelS * (1 - ign) + ign;
      far.intensity = 2.5 * (1 - ign);
      far.position.copy(starAt).add(FAR); far.target.position.copy(starAt);
      if (w !== lastWorld) { lastWorld = w; seed.value = Math.floor(Math.random() * 1000); }   // partida nueva: otra secuencia
      // Tragada por el agujero negro, o ya convertida en agujero negro: no hay estrella.
      const swallowed = w.over === OVER_SWALLOWED || w.over === OVER_SHATTERED;
      const gone = w.phase === PHASE_HUNT || w.phase === PHASE_MERGE;
      const target = swallowed || gone ? 0 : starRenderRadius(w.star.mass) * ign;
      shownR = gone ? 0 : shownR < 0 ? target : smoothToward(shownR, target, swallowed ? 2.5 : w.phase === PHASE_IGNITION ? 4 : 1.2, ctx.dt);
      // La hipergigante late: se hincha y se contrae despacio, y el brillo acompaña cada pulso.
      const hyper = w.stage >= STAGE_HYPER && w.phase === PHASE_PLAY && w.over === 0;
      const pulse = hyper ? Math.sin(ctx.time * ((Math.PI * 2) / PULSE_PERIOD)) : 0;
      let k = 1 + 0.035 * pulse, bright = 1 + 0.12 * pulse;
      // Colapso: se encoge de golpe y se apaga (2 s); después estalla y desaparece.
      if (w.phase === PHASE_COLLAPSE) {
        const t = w.phaseTime;
        if (t < 2) { k = 1 - 0.65 * smooth01(t / 2); bright = 1 - 0.5 * smooth01(t / 2); }
        else { k = Math.max(0, 0.35 * (1 - (t - 2) / 0.25)); bright = 3; }
      }
      const r = Math.max(shownR * k, 1e-3);
      sun.visible = halo.visible = shownR * k > 0.05;
      sun.position.copy(starAt); sun.scale.setScalar(r); sun.rotation.y = ctx.time * 0.09;   // gira a la vista
      halo.position.copy(starAt); halo.scale.setScalar(r); halo.quaternion.copy(ctx.camera.quaternion);
      front.visible = sun.visible;
      // Un poco hacia la cámara, para que quede delante de la superficie.
      camDir.copy(ctx.camera.position).sub(starAt).normalize();
      front.position.copy(starAt).addScaledVector(camDir, r * 1.02); front.scale.setScalar(r); front.quaternion.copy(ctx.camera.quaternion);
      // Erupciones de la hipergigante: cada tanto sale una cáscara de gas.
      const et = ctx.time % ERUPTION_EVERY;
      shell.visible = hyper && et < ERUPTION_LAST;
      if (shell.visible) { shell.position.copy(starAt); shell.scale.setScalar(r); shell.quaternion.copy(ctx.camera.quaternion); shellMat.uniforms['uT']!.value = et; }
      sunMat.uniforms['uIntensity']!.value = baseIntensity * bright;
      light.intensity = baseLight * (gone ? 0.35 : 1) * ign;
      light.position.copy(starAt);
      const palTarget = PALETTES[Math.min(Math.max(0, ctx.world.stage - STAGE_IGNITION), PALETTES.length - 1)]!;
      for (let k = 0; k < 9; k++) pal[k] = smoothToward(pal[k]!, palTarget[k]!, 0.8, ctx.dt);
      hot.set(pal[0]!, pal[1]!, pal[2]!); mid.set(pal[3]!, pal[4]!, pal[5]!); cool.set(pal[6]!, pal[7]!, pal[8]!);
      tint.set(pal[3]!, pal[4]!, pal[5]!).multiplyScalar(1.05);
      sunMat.uniforms['uTime']!.value = ctx.time;
      haloMat.uniforms['uTime']!.value = ctx.time;
      frontMat.uniforms['uTime']!.value = ctx.time;
    },
    applyParams(p) {
      baseIntensity = p.sunIntensity;
      baseLight = p.lightIntensity;
    },
  };
}
