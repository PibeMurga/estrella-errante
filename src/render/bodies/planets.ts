import { Color, Frustum, Group, InstancedMesh, Matrix4, Quaternion, Euler, RingGeometry, ShaderMaterial, Sphere, SphereGeometry, Vector3, Vector4, AdditiveBlending, DoubleSide } from 'three';
import type { Rng } from '../../sim/rng';
import { KIND_GAS, KIND_ICE, KIND_MOON, KIND_ROCKY, type World, DEAD } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Modelos de sombreado: 0 rocoso con cráteres · 1 oceánico · 2 hielo · 3 gaseoso · 4 lava · 5 desierto · 7 nubes espesas · 8 mineral.
// Cada tipo visual usa un modelo con su paleta propia (A, B, C) y parámetros (K). La rareza se da con el peso.
interface Visual {
  name: string; shade: number; kinds: number[]; weight: number;
  A: string; B?: string; C?: string; K?: [number, number, number, number];
  clouds?: number;                       // umbral de nubes (más alto = menos nubes)
  atmo?: [string, number, number];       // color, exponente del borde, intensidad
}

// Comunes: peso alto. Raros: peso bajo, para que se vean de vez en cuando y no saturen.
export const VISUALS: readonly Visual[] = [
  { name: 'rocoso', shade: 0, kinds: [KIND_ROCKY], weight: 30, A: '#75706a', B: '#38332f', C: '#a8a29a' },
  { name: 'rocoso cálido', shade: 0, kinds: [KIND_ROCKY], weight: 18, A: '#7a5a46', B: '#3e2c24', C: '#b89a80' },
  { name: 'desierto', shade: 5, kinds: [KIND_ROCKY], weight: 16, A: '#9a4a26', B: '#c98a52', C: '#4a2214', atmo: ['#ff9a60', 3.5, 0.35] },
  { name: 'lava', shade: 4, kinds: [KIND_ROCKY], weight: 8, A: '#ff6a20', atmo: ['#ff5a20', 4, 0.5] },
  { name: 'oceánico', shade: 1, kinds: [KIND_ROCKY], weight: 8, A: '#3d4c1e', B: '#6b5636', C: '#1f6e7a', K: [0.06, 0.72, 0, 0], clouds: 0.52, atmo: ['#5aa0ff', 2.6, 1] },
  { name: 'archipiélago', shade: 1, kinds: [KIND_ROCKY], weight: 3, A: '#2f6a2a', B: '#c8b27a', C: '#3fc8c0', K: [0.26, 0.9, 0, 0], clouds: 0.6, atmo: ['#7ad8ff', 2.6, 0.9] },
  { name: 'mineral', shade: 8, kinds: [KIND_ROCKY], weight: 2, A: '#d8d2dc', B: '#a89cb4', C: '#2c2628', atmo: ['#c8d0e0', 4, 0.15] },
  { name: 'hielo', shade: 2, kinds: [KIND_ICE], weight: 10, A: '#8ca2c0', B: '#e2eaf2', C: '#3a5a8a', atmo: ['#cfe6ff', 3, 0.4] },
  { name: 'hielo sucio', shade: 2, kinds: [KIND_ICE], weight: 5, A: '#8a8478', B: '#d4cfc4', C: '#4a4238', atmo: ['#e0e0d8', 3.5, 0.25] },
  { name: 'gaseoso', shade: 3, kinds: [KIND_GAS], weight: 20, A: '#b88a5c', B: '#efe0c2', C: '#8a4a2a', K: [17, 1, 1, 0.1], atmo: ['#ffd8a0', 3, 0.35] },
  { name: 'gigante de hielo', shade: 3, kinds: [KIND_GAS], weight: 8, A: '#3a78b8', B: '#79c2e8', C: '#162e6a', K: [9, 0.45, 1, 0.06], atmo: ['#7ad0ff', 2.4, 0.9] },
  { name: 'gaseoso púrpura', shade: 3, kinds: [KIND_GAS], weight: 2, A: '#6a3a5a', B: '#c88aa0', C: '#3a1a3a', K: [24, 0.8, 0, 0.14], atmo: ['#ff9ad0', 3, 0.4] },
  { name: 'nubes doradas', shade: 7, kinds: [KIND_GAS, KIND_ROCKY], weight: 4, A: '#b89a4a', B: '#e8d9a0', C: '#7a5a28', atmo: ['#ffd27a', 2.2, 0.9] },
  { name: 'nubes ácidas', shade: 7, kinds: [KIND_GAS], weight: 1.5, A: '#4a6a2a', B: '#a6c25a', C: '#2a3a18', atmo: ['#b6ff6a', 2.4, 0.8] },
  { name: 'luna', shade: 0, kinds: [KIND_MOON], weight: 1, A: '#76716c', B: '#3a3632', C: '#aaa49c' },
];
export const PLANET_TYPES = VISUALS.length;
const RING_CHANCE = 0.22;   // parte de los gaseosos tiene anillos

// Hash entero (determinista): el mismo índice da siempre el mismo tipo, sin consumir el azar de la partida.
function hash01(i: number, salt: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Elige el tipo visual de un cuerpo según su clase en la simulación, con pesos de rareza.
export function planetVisualFor(kind: number, index: number): number {
  let total = 0;
  for (const v of VISUALS) if (v.kinds.includes(kind)) total += v.weight;
  if (total === 0) return 0;
  let r = hash01(index, 0x51ed) * total;
  for (let t = 0; t < VISUALS.length; t++) {
    const v = VISUALS[t]!;
    if (!v.kinds.includes(kind)) continue;
    r -= v.weight;
    if (r < 0) return t;
  }
  return 0;
}
export function hasRings(kind: number, index: number): boolean {
  return kind === KIND_GAS && VISUALS[planetVisualFor(kind, index)]!.shade === 3 && hash01(index, 0x7a11) < RING_CHANCE;
}

const VERT = /* glsl */ `varying vec3 vN; varying vec3 vP; varying vec3 vO; varying mat3 vM; varying float vSeed;
void main(){
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vSeed = instanceColor.r * 97.0;
  #else
    vSeed = 0.0;
  #endif
  vO = position; vec4 w = m*vec4(position,1.); vP = w.xyz; vM = mat3(m); vN = normalize(vM*normal);
  gl_Position = projectionMatrix*viewMatrix*w;
}`;

const FRAG = /* glsl */ `
uniform int uOct; uniform float uTime; uniform vec3 uSunPos; uniform vec3 uLight;
uniform vec3 uA, uB, uC; uniform vec4 uK;
varying vec3 vN; varying vec3 vP; varying vec3 vO; varying mat3 vM; varying float vSeed;
float height(vec3 p){
  vec3 s = p + vSeed; float h = 0.;
#if SHADE == 0
  { h = fbm(s*3., uOct)*.35; float c1 = worley(s*5.); float c2 = worley(s*13.);
    h += -.5*(1.-smoothstep(0.,.25,c1)) + .3*exp(-((c1-.26)/.05)*((c1-.26)/.05)); h += (-.25*(1.-smoothstep(0.,.22,c2)) + .14*exp(-((c2-.23)/.04)*((c2-.23)/.04)))*.6; }
#elif SHADE == 1
  { vec3 w = s*1.6 + .55*vec3(fbm(s*1.2,4), fbm(s*1.2+5.,4), fbm(s*1.2+9.,4)); h = fbm(w, uOct); }
#elif SHADE == 2
  { h = ridged(s*2.6, uOct - 2)*.6 + fbm(s*5., 4)*.15; }
#elif SHADE == 4
  { h = fbm(s*3.5, uOct - 1); }
#elif SHADE == 5
  { float can = 1. - smoothstep(0., .07, abs(fbm(s*1.4, 5)));
    float dune = sin(dot(s, vec3(18., 7., 11.)) + fbm(s*3., 3)*5.)*.04;
    h = fbm(s*2.4, uOct - 1)*.3 + dune - can*.35; }
#elif SHADE == 8
  { h = fbm(s*2.5, uOct - 2)*.3; }
#endif
  return h;
}
void main(){
  vec3 p = normalize(vO); vec3 L = normalize(uSunPos - vP); vec3 V = normalize(cameraPosition - vP);
  vec3 T = normalize(cross(p, abs(p.y) < .99 ? vec3(0.,1.,0.) : vec3(1.,0.,0.))); vec3 B = cross(p, T);
  float sea = uK.x;
#if SHADE == 3 || SHADE == 7
  float h0 = 0.; float k = 0.; float hT = 0., hB = 0., e = .0025;   // sin relieve: nubes o gas
#else
  float e = .0025, h0 = height(p), hT = height(normalize(p + T*e)), hB = height(normalize(p + B*e));
  #if SHADE == 1
  float k = h0 > sea ? .9 : 0.;
  #else
  float k = 1.1;
  #endif
#endif
  vec3 nObj = normalize(p - k*((hT-h0)/e*T + (hB-h0)/e*B)*.02);
  vec3 n = normalize(vM*nObj), ng = normalize(vN);
  float ndl = dot(n, L), ndlg = dot(ng, L);
  float lit = max(ndl, 0.) * smoothstep(-.04, .12, ndlg);
  vec3 alb = vec3(.5); vec3 emit = vec3(0.); float spec = 0.; float glint = 0.;
  float lat = p.y; float lon = atan(p.z, p.x);
#if SHADE == 0
  { float mar = smoothstep(.45,.6, fbm(p*1.4+vSeed,4)*.5+.5); alb = mix(uA, uB, mar) * (.8 + h0*.5);
    float ray = smoothstep(.9, 1., 1. - worley(p*3.+vSeed)) * .5; alb = mix(alb, uC, ray); }
#elif SHADE == 1
  {
    if (h0 < sea) { float dpt = smoothstep(sea, sea-.35, h0); float shelf = smoothstep(sea-.05, sea, h0);
      alb = mix(vec3(.04,.16,.24), vec3(.01,.04,.11), dpt); alb = mix(alb, uC, shelf*.7); spec = 1.; }
    else { float hh = h0 - sea; float moist = fbm(p*4.+vSeed+7.,4)*.5+.5;
      alb = mix(uA, uB, smoothstep(.35,.65,moist)); alb = mix(alb, vec3(.33,.31,.29), smoothstep(.18,.32,hh)); }
    float ice = smoothstep(uK.y, uK.y + .1, abs(lat) + fbm(p*6.,3)*.08); alb = mix(alb, vec3(.9,.93,.96), ice); spec *= 1.-ice;
  }
#elif SHADE == 2
  { float cr = ridged(p*2.6+vSeed, uOct - 2); alb = mix(uA, uB, smoothstep(.35,.7,cr)); alb = mix(alb, uC, smoothstep(.82,.95,cr)*.8); spec = .35; }
#elif SHADE == 3
  {
    // Gaseoso: K.x frecuencia de bandas, K.y contraste, K.z tormenta, K.w turbulencia.
    vec3 qq = p + uK.w*vec3(fbm(p*4.+uTime*.01,5), fbm(p*4.+3.+uTime*.01,5), 0.);
    float band = sin(qq.y*uK.x + fbm(qq*2.5+vSeed,5)*2.4)*.5+.5; band = mix(.5, band, uK.y);
    float fine2 = fbm(vec3(qq.x*2., qq.y*40., qq.z*2.)+vSeed, 4)*.5+.5;
    alb = mix(uA, uB, band); alb = mix(alb, uC, smoothstep(.62,.9,fine2)*.6*uK.y);
    float sd = length(vec2((lon - 1.2 - vSeed)*1.7, (lat + .32)*4.)); float sw = snoise(vec3(lon*6., lat*14., uTime*.05));
    alb = mix(alb, uC*1.1 + sw*.05, smoothstep(.45, .05, sd) * uK.z);
  }
#elif SHADE == 4
  {
    float cracks = ridged(p*4.+vSeed, 5); float glow = smoothstep(.72, .92, cracks);
    alb = mix(vec3(.07,.06,.06), vec3(.16,.12,.11), h0*.5+.5) * (1.-glow*.8);
    emit = uA * 2.6 * glow * (.7 + .3*snoise(p*20. + uTime*.4));
  }
#elif SHADE == 5
  {
    float can = 1. - smoothstep(0., .07, abs(fbm((p+vSeed)*1.4, 5)));
    alb = mix(uA, uB, smoothstep(-.2, .3, h0)); alb = mix(alb, uC, can*.8);
    alb *= .85 + .3*(fbm(p*9.+vSeed, 3)*.5+.5);
    float cap = smoothstep(.86, .93, lat + fbm(p*5.,3)*.05); alb = mix(alb, vec3(.92,.9,.88), cap);
  }
#elif SHADE == 7
  {
    // Nubes espesas en remolino: no se ve la superficie.
    float sw = lat*3. + fbm(p*2.+uTime*.02, 4)*1.2;   // las bandas de los gaseosos se mueven
    vec3 w = vec3(p.x*cos(sw) - p.z*sin(sw), lat*2.2, p.x*sin(sw) + p.z*cos(sw));
    float c = fbm(w*2.2 + vSeed + vec3(uTime*.01,0.,0.), 6)*.5+.5;
    alb = mix(uA, uB, smoothstep(.3, .75, c)); alb = mix(alb, uC, smoothstep(.72, .9, c)*.7);
  }
#elif SHADE == 8
  {
    // Mineral: llanuras de cuarzo y sal en placas con su propia inclinación, separadas por vetas de roca.
    vec3 cp = p*11. + vSeed; vec3 ci = floor(cp), cf = fract(cp); float d1 = 8., d2 = 8.; vec3 id = ci;
    for (int z=-1;z<=1;z++) for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) { vec3 g = vec3(float(x),float(y),float(z)); float d = length(g + hash33(ci+g) - cf);
      if (d < d1) { d2 = d1; d1 = d; id = ci+g; } else if (d < d2) d2 = d; }
    float vein = 1. - smoothstep(.0, .07, d2 - d1);
    vec3 hh = hash33(id);
    float field = smoothstep(.42, .58, fbm(p*1.8 + vSeed, 5)*.5+.5);
    float m = field * (1. - vein);
    vec3 rock = mix(uC, uC*1.6, fbm(p*6.+vSeed, 4)*.5+.5);
    alb = mix(rock, mix(uA, uB, hh.x*.7 + h0*.6), m);
    vec3 fn = normalize(vM*normalize(p + (hh - .5)*.5));
    n = normalize(mix(n, fn, m)); ndl = dot(n, L); lit = max(ndl, 0.) * smoothstep(-.04, .12, ndlg);
    glint = m;
  }
#endif
  vec3 col = alb * uLight * lit + alb * .004;
  if (spec > 0.) { vec3 H = normalize(L + V); col += spec * uLight * pow(max(dot(n, H), 0.), 80.) * 1.3 * smoothstep(0., .1, ndlg); }
  if (glint > 0.) { vec3 H = normalize(L + V); col += glint * uLight * (pow(max(dot(n, H), 0.), 400.) * 5. + pow(max(dot(n, H), 0.), 30.) * .15) * smoothstep(0., .1, ndlg); }
#if SHADE == 3 || SHADE == 7
  col *= .55 + .45*pow(max(dot(ng, V), 0.), .35);
#endif
  col += emit;
  gl_FragColor = vec4(col, 1.);
}`;

const CLOUD_FRAG = /* glsl */ `uniform float uTime; uniform vec3 uSunPos; uniform vec3 uLight; uniform float uCover; varying vec3 vN; varying vec3 vP; varying vec3 vO; varying mat3 vM; varying float vSeed;
void main(){ vec3 p = normalize(vO); float ndl = dot(normalize(vN), normalize(uSunPos - vP));
  vec3 w = p*2.3 + vec3(uTime*.03, 0., 0.) + .6*vec3(fbm(p*1.5+vSeed,4), fbm(p*1.5+4.,4), 0.);
  float c = smoothstep(uCover, uCover + .26, fbm(w, 7)*.5+.5); float lit = max(ndl, 0.) * smoothstep(-.04, .12, ndl);
  gl_FragColor = vec4(uLight * .92 * lit, c * .92); }`;

// Atmósfera: borde fino que brilla del lado del sol, con el color propio del tipo y apagado hacia afuera.
const ATMO_FRAG = /* glsl */ `uniform vec3 uSunPos; uniform vec3 uCol; uniform float uPow; varying vec3 vN; varying vec3 vP; varying vec3 vO; varying mat3 vM; varying float vSeed;
void main(){ vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vP); vec3 L = normalize(uSunPos - vP);
  float r = clamp(1. - abs(dot(n, V)), 0., 1.); float rim = pow(r, uPow) * (1. - pow(r, 14.)); float day = smoothstep(-.35, .45, dot(n, L));
  gl_FragColor = vec4(uCol * rim * day, 1.); }`;

// Anillos: velo suave con una división difusa e irregular; el planeta les proyecta su sombra.
const RING_VERT = /* glsl */ `varying vec3 vL; varying vec3 vP; varying vec3 vC; varying float vR; varying float vSeed;
void main(){
  mat4 m = modelMatrix * instanceMatrix;
  vL = position; vec4 w = m*vec4(position,1.); vP = w.xyz;
  vC = (m*vec4(0.,0.,0.,1.)).xyz; vR = length((m*vec4(1.,0.,0.,0.)).xyz);
  vSeed = instanceColor.r * 97.0;
  gl_Position = projectionMatrix*viewMatrix*w;
}`;
const RING_FRAG = /* glsl */ `uniform vec3 uSunPos; uniform vec3 uA, uB; uniform vec3 uLight; varying vec3 vL; varying vec3 vP; varying vec3 vC; varying float vR; varying float vSeed;
void main(){ float r = length(vL.xy); float t = (r - 1.35) / (2.3 - 1.35); if (t < 0. || t > 1.) discard;
  float bands = fbm(vec3(t*2.2, vSeed, 0.), 3)*.5+.5;
  float ang = atan(vL.y, vL.x); vec2 cs = vec2(cos(ang), sin(ang));
  float gc = .64 + .05*fbm(vec3(cs*1.6, vSeed), 3);
  float gap = smoothstep(.1, .0, abs(t - gc)) * (fbm(vec3(cs*3., t*6. + vSeed), 3)*.5+.5);
  float body = smoothstep(0., .3, t) * smoothstep(1., .7, t);
  float a = body * (.7 + .3*smoothstep(.3, .7, bands)) * (1. - gap*.6) * .6;
  vec3 L = normalize(uSunPos - vP); vec3 toC = vC - vP; float along = dot(toC, L);
  // Sombra del planeta con penumbra: la estrella es grande y está cerca, así que el borde se abre y se difumina con la distancia.
  float dd = length(toC - L*along); float pen = vR*.06 + max(along, 0.)*.16;
  float shadow = mix(1., .07 + .93*smoothstep(vR - pen, vR + pen, dd), smoothstep(0., vR*.6, along));
  vec3 col = mix(uA, uB, smoothstep(.2, .8, bands)) * shadow * uLight * .8;
  gl_FragColor = vec4(col * a, a * .9); }`;

const LIGHT_BASE = new Vector3(1.25, 1.02, 0.8);
const m4 = new Matrix4();
const q = new Quaternion();
const qRing = new Quaternion();
const pos = new Vector3();
const scl = new Vector3();
const yAxis = new Vector3(0, 1, 0);
const seedCol = new Color();
const frustum = new Frustum();
const projView = new Matrix4();
const bound = new Sphere();

// Nivel de detalle: los planetas que se ven chicos usan una esfera simple; los grandes o cercanos, la detallada.
const LOD_PX = 36;        // radio en pantalla (px) a partir del cual se usa la esfera detallada
const LOW_SEGMENTS = 24;

function commit(m: InstancedMesh, n: number): void {
  m.count = n;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

interface Entry {
  hi: InstancedMesh; lo: InstancedMesh; clouds: InstancedMesh | null; atmo: InstancedMesh | null;
  indices: Int32Array; spin: Float32Array; seed: Float32Array;
}

export interface PlanetsLayer extends Layer { readonly typesShown: number }

export function createPlanetsLayer(world: World, segments: number, octaves: number, rng: Rng, sunPos: Vector3): PlanetsLayer {
  const group = new Group();
  const geoHi = new SphereGeometry(1, segments, Math.max(8, Math.floor(segments / 2)));
  const geoLo = new SphereGeometry(1, LOW_SEGMENTS, LOW_SEGMENTS / 2);
  const light = LIGHT_BASE.clone();
  const time = { value: 0 };
  const entries: Entry[] = [];
  const materials: ShaderMaterial[] = [];
  const sun = { value: sunPos };
  const C = (h: string | undefined): Color => new Color(h ?? '#808080');

  for (let type = 0; type < PLANET_TYPES; type++) {
    const list: number[] = [];
    for (let i = 0; i < world.count; i++) {
      const kind = world.kind[i]!;
      if (kind >= KIND_ROCKY && kind <= KIND_MOON && planetVisualFor(kind, i) === type) list.push(i);
    }
    if (list.length === 0) continue;
    const v = VISUALS[type]!;
    const indices = Int32Array.from(list);
    const n = indices.length;
    const common = { uTime: time, uSunPos: sun, uLight: { value: light } };
    const k = v.K ?? [0.06, 0.72, 0, 0];
    const mat = new ShaderMaterial({
      defines: { SHADE: v.shade },
      uniforms: { ...common, uOct: { value: octaves }, uA: { value: C(v.A) }, uB: { value: C(v.B) }, uC: { value: C(v.C) }, uK: { value: new Vector4(k[0], k[1], k[2], k[3]) } },
      vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
    });
    materials.push(mat);
    const hi = new InstancedMesh(geoHi, mat, n);
    const lo = new InstancedMesh(geoLo, mat, n);
    hi.frustumCulled = false; lo.frustumCulled = false;
    let clouds: InstancedMesh | null = null;
    if (v.clouds !== undefined) {
      clouds = new InstancedMesh(geoHi, new ShaderMaterial({ uniforms: { ...common, uCover: { value: v.clouds } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + CLOUD_FRAG, transparent: true, depthWrite: false }), n);
      clouds.frustumCulled = false;
    }
    let atmo: InstancedMesh | null = null;
    if (v.atmo) {
      const [col, pw, s] = v.atmo;
      atmo = new InstancedMesh(geoLo, new ShaderMaterial({ uniforms: { uSunPos: sun, uCol: { value: C(col).multiplyScalar(s) }, uPow: { value: pw } }, vertexShader: VERT, fragmentShader: ATMO_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending }), n);
      atmo.frustumCulled = false;
    }
    const spin = new Float32Array(n), seed = new Float32Array(n);
    for (let s = 0; s < n; s++) {
      seed[s] = rng.next();
      // Cada planeta gira a su ritmo: muchos lentos (algunos parecen casi quietos), pocos rápidos, sin exagerar.
      // Uno de cada seis, al revés (como Venus o Urano).
      spin[s] = (0.03 + 0.72 * Math.pow((seed[s]! * 7.31) % 1, 1.8)) * (((seed[s]! * 13.7) % 1) < 0.17 ? -1 : 1);
      seedCol.setRGB(seed[s]!, 0, 0);
      hi.setColorAt(s, seedCol); lo.setColorAt(s, seedCol); clouds?.setColorAt(s, seedCol); atmo?.setColorAt(s, seedCol);
    }
    group.add(hi, lo);
    if (clouds) group.add(clouds);
    if (atmo) group.add(atmo);
    entries.push({ hi, lo, clouds, atmo, indices, spin, seed });
  }

  // Anillos: una sola malla para todos los gaseosos que los tienen, cada uno con su inclinación fija.
  const ringList: number[] = [];
  for (let i = 0; i < world.count; i++) if (hasRings(world.kind[i]!, i)) ringList.push(i);
  const ringIdx = Int32Array.from(ringList);
  const ringQ = new Float32Array(ringIdx.length * 4);
  const ringSeed = new Float32Array(ringIdx.length);
  let rings: InstancedMesh | null = null;
  if (ringIdx.length > 0) {
    const e = new Euler();
    for (let s = 0; s < ringIdx.length; s++) {
      const i = ringIdx[s]!;
      e.set(-Math.PI / 2 + 0.25 + hash01(i, 0x3b1) * 0.35, hash01(i, 0x4c2) * Math.PI * 2, 0);
      qRing.setFromEuler(e);
      ringQ[s * 4] = qRing.x; ringQ[s * 4 + 1] = qRing.y; ringQ[s * 4 + 2] = qRing.z; ringQ[s * 4 + 3] = qRing.w;
      ringSeed[s] = hash01(i, 0x5d3);
    }
    rings = new InstancedMesh(new RingGeometry(1.3, 2.35, 128, 1), new ShaderMaterial({
      uniforms: { uSunPos: sun, uLight: { value: light }, uA: { value: C('#c9b08a') }, uB: { value: C('#f2e6cc') } },
      vertexShader: RING_VERT, fragmentShader: NOISE_GLSL + RING_FRAG, transparent: true, depthWrite: false, side: DoubleSide,
    }), ringIdx.length);
    rings.frustumCulled = false;
    for (let s = 0; s < ringIdx.length; s++) { seedCol.setRGB(ringSeed[s]!, 0, 0); rings.setColorAt(s, seedCol); }
    group.add(rings);
  }

  return {
    object: group,
    typesShown: entries.length,
    update(ctx) {
      const w = ctx.world, a = ctx.alpha, cam = ctx.camera.position;
      const pxPerUnit = (ctx.height / 2) / Math.tan((ctx.camera.fov * Math.PI) / 360);
      frustum.setFromProjectionMatrix(projView.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse));
      time.value = ctx.time;
      for (let k = 0; k < entries.length; k++) {
        const en = entries[k]!;
        let nHi = 0, nLo = 0;
        for (let s = 0; s < en.indices.length; s++) {
          const i = en.indices[s]!;
          if (w.state[i] === DEAD || (w.broken[i]! > 0 && w.kind[i] !== KIND_GAS)) continue;   // tragado, o rocoso/helado partido (lo dibuja otra capa)
          const x = w.prevX[i] + (w.x[i] - w.prevX[i]) * a;
          const y = w.prevY[i] + (w.y[i] - w.prevY[i]) * a;
          const r = w.radius[i];
          pos.set(x, 0, -y);
          bound.center.copy(pos); bound.radius = r * 1.1;
          if (!frustum.intersectsSphere(bound)) continue;   // fuera de cuadro: no se dibuja
          const dist = Math.max(1, Math.hypot(pos.x - cam.x, pos.y - cam.y, pos.z - cam.z));
          const detailed = (r / dist) * pxPerUnit >= LOD_PX;
          q.setFromAxisAngle(yAxis, ctx.time * en.spin[s]!);
          scl.setScalar(r);
          m4.compose(pos, q, scl);
          seedCol.setRGB(en.seed[s]!, 0, 0);
          if (detailed) {
            en.hi.setMatrixAt(nHi, m4); en.hi.setColorAt(nHi, seedCol);
            if (en.atmo) {
              scl.setScalar(r * 1.03);
              m4.compose(pos, q, scl);
              en.atmo.setMatrixAt(nHi, m4); en.atmo.setColorAt(nHi, seedCol);
            }
            if (en.clouds) {
              q.setFromAxisAngle(yAxis, ctx.time * en.spin[s]! * 1.15);
              scl.setScalar(r * 1.015);
              m4.compose(pos, q, scl);
              en.clouds.setMatrixAt(nHi, m4); en.clouds.setColorAt(nHi, seedCol);
            }
            nHi++;
          } else {
            en.lo.setMatrixAt(nLo, m4); en.lo.setColorAt(nLo, seedCol);
            nLo++;
          }
        }
        en.hi.count = nHi; en.lo.count = nLo;
        en.hi.instanceMatrix.needsUpdate = true; en.lo.instanceMatrix.needsUpdate = true;
        if (en.hi.instanceColor) en.hi.instanceColor.needsUpdate = true;
        if (en.lo.instanceColor) en.lo.instanceColor.needsUpdate = true;
        if (en.clouds) commit(en.clouds, nHi);
        if (en.atmo) commit(en.atmo, nHi);
      }
      if (rings) {
        let nR = 0;
        for (let s = 0; s < ringIdx.length; s++) {
          const i = ringIdx[s]!;
          if (w.state[i] === DEAD) continue;
          const x = w.prevX[i] + (w.x[i] - w.prevX[i]) * a;
          const y = w.prevY[i] + (w.y[i] - w.prevY[i]) * a;
          const r = w.radius[i];
          pos.set(x, 0, -y);
          bound.center.copy(pos); bound.radius = r * 2.4;
          if (!frustum.intersectsSphere(bound)) continue;
          qRing.set(ringQ[s * 4]!, ringQ[s * 4 + 1]!, ringQ[s * 4 + 2]!, ringQ[s * 4 + 3]!);
          scl.setScalar(r);
          m4.compose(pos, qRing, scl);
          seedCol.setRGB(ringSeed[s]!, 0, 0);
          rings.setMatrixAt(nR, m4); rings.setColorAt(nR, seedCol);
          nR++;
        }
        rings.count = nR;
        rings.instanceMatrix.needsUpdate = true;
        if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
      }
    },
    applyParams(p) {
      light.copy(LIGHT_BASE).multiplyScalar(p.lightIntensity / 2.4);
    },
    applyQuality(q) {
      for (const m of materials) m.uniforms['uOct']!.value = q.planetOctaves;
    },
  };
}
