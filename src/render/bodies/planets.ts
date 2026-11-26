import { Color, Frustum, Group, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Sphere, SphereGeometry, Vector3 } from 'three';
import type { Rng } from '../../sim/rng';
import { KIND_GAS, KIND_ICE, KIND_MOON, KIND_ROCKY, type World, DEAD } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Tipos visuales: 0 rocoso con cráteres · 1 oceánico · 2 hielo · 3 gaseoso · 4 lava.
export const PLANET_TYPES = 5;
export function planetTypeFor(kind: number, index: number): number {
  if (kind === KIND_ICE) return 2;
  if (kind === KIND_GAS) return 3;
  if (kind === KIND_MOON) return 0;   // las lunas son rocosas con cráteres
  return [0, 1, 4][index % 3]!;
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
uniform int uType; uniform int uOct; uniform float uTime; uniform vec3 uSunPos; uniform vec3 uLight;
varying vec3 vN; varying vec3 vP; varying vec3 vO; varying mat3 vM; varying float vSeed;
float height(vec3 p){
  vec3 s = p + vSeed;
  if (uType == 0) { float h = fbm(s*3., uOct)*.35; float c1 = worley(s*5.); float c2 = worley(s*13.);
    h += -.5*(1.-smoothstep(0.,.25,c1)) + .3*exp(-pow((c1-.26)/.05,2.)); h += (-.25*(1.-smoothstep(0.,.22,c2)) + .14*exp(-pow((c2-.23)/.04,2.)))*.6; return h; }
  if (uType == 1) { vec3 w = s*1.6 + .55*vec3(fbm(s*1.2,4), fbm(s*1.2+5.,4), fbm(s*1.2+9.,4)); return fbm(w, uOct); }
  if (uType == 2) { return ridged(s*2.6, uOct - 2)*.6 + fbm(s*5., 4)*.15; }
  if (uType == 4) { return fbm(s*3.5, uOct - 1); }
  return 0.;
}
void main(){
  vec3 p = normalize(vO); vec3 L = normalize(uSunPos - vP); vec3 V = normalize(cameraPosition - vP);
  vec3 T = normalize(cross(p, abs(p.y) < .99 ? vec3(0.,1.,0.) : vec3(1.,0.,0.))); vec3 B = cross(p, T);
  float e = .0025, h0 = height(p), hT = height(normalize(p + T*e)), hB = height(normalize(p + B*e));
  float k = uType == 1 ? (h0 > .06 ? .9 : 0.) : (uType == 3 ? 0. : 1.1);
  vec3 nObj = normalize(p - k*((hT-h0)/e*T + (hB-h0)/e*B)*.02);
  vec3 n = normalize(vM*nObj), ng = normalize(vN);
  float ndl = dot(n, L), ndlg = dot(ng, L);
  float lit = max(ndl, 0.) * smoothstep(-.04, .12, ndlg);
  vec3 alb = vec3(.5); vec3 emit = vec3(0.); float spec = 0.;
  float lat = p.y;
  if (uType == 0) { float mar = smoothstep(.45,.6, fbm(p*1.4+vSeed,4)*.5+.5); alb = mix(vec3(.46,.42,.38), vec3(.22,.2,.19), mar) * (.8 + h0*.5); }
  if (uType == 1) {
    float sea = .06;
    if (h0 < sea) { float dpt = smoothstep(sea, sea-.35, h0); alb = mix(vec3(.04,.16,.24), vec3(.01,.04,.11), dpt); spec = 1.; }
    else { float hh = h0 - sea; float moist = fbm(p*4.+vSeed+7.,4)*.5+.5;
      alb = mix(vec3(.24,.30,.12), vec3(.42,.34,.22), smoothstep(.35,.65,moist)); alb = mix(alb, vec3(.33,.31,.29), smoothstep(.18,.32,hh)); }
    float ice = smoothstep(.72, .82, abs(lat) + fbm(p*6.,3)*.08); alb = mix(alb, vec3(.9,.93,.96), ice); spec *= 1.-ice;
  }
  if (uType == 2) { float cr = ridged(p*2.6+vSeed, uOct - 2); alb = mix(vec3(.55,.68,.80), vec3(.88,.93,.97), smoothstep(.35,.7,cr)); alb = mix(alb, vec3(.25,.38,.55), smoothstep(.82,.95,cr)*.8); spec = .35; }
  if (uType == 3) {
    vec3 qq = p + .12*vec3(fbm(p*4.+uTime*.01,5), fbm(p*4.+3.+uTime*.01,5), 0.);
    float band = sin(qq.y*19. + fbm(qq*2.5+vSeed,5)*2.4)*.5+.5; float fine2 = fbm(vec3(qq.x*2., qq.y*40., qq.z*2.)+vSeed, 4)*.5+.5;
    alb = mix(vec3(.62,.44,.28), vec3(.93,.84,.68), band); alb = mix(alb, vec3(.45,.24,.14), smoothstep(.62,.9,fine2)*.6);
    float lon = atan(p.z, p.x); float sd = length(vec2((lon - 1.2)*1.7, (lat + .32)*4.)); float sw = snoise(vec3(lon*6., lat*14., uTime*.05));
    alb = mix(alb, vec3(.78,.34,.18) + sw*.05, smoothstep(.45, .05, sd));
  }
  if (uType == 4) {
    float cracks = ridged(p*4.+vSeed, 5); float glow = smoothstep(.72, .92, cracks);
    alb = mix(vec3(.07,.06,.06), vec3(.16,.12,.11), h0*.5+.5) * (1.-glow*.8);
    emit = vec3(2.6, .75, .18) * glow * (.7 + .3*snoise(p*20. + uTime*.4));
  }
  vec3 col = alb * uLight * lit + alb * .004;
  if (spec > 0.) { vec3 H = normalize(L + V); col += spec * uLight * pow(max(dot(n, H), 0.), 80.) * 1.3 * smoothstep(0., .1, ndlg); }
  if (uType == 3) col *= .55 + .45*pow(max(dot(ng, V), 0.), .35);
  col += emit;
  gl_FragColor = vec4(col, 1.);
}`;

const CLOUD_FRAG = /* glsl */ `uniform float uTime; uniform vec3 uSunPos; uniform vec3 uLight; varying vec3 vN; varying vec3 vP; varying vec3 vO; varying mat3 vM; varying float vSeed;
void main(){ vec3 p = normalize(vO); float ndl = dot(normalize(vN), normalize(uSunPos - vP));
  vec3 w = p*2.3 + vec3(uTime*.012, 0., 0.) + .6*vec3(fbm(p*1.5+vSeed,4), fbm(p*1.5+4.,4), 0.);
  float c = smoothstep(.52, .78, fbm(w, 7)*.5+.5); float lit = max(ndl, 0.) * smoothstep(-.04, .12, ndl);
  gl_FragColor = vec4(uLight * .92 * lit, c * .92); }`;

const LIGHT_BASE = new Vector3(1.25, 1.02, 0.8);
const m4 = new Matrix4();
const q = new Quaternion();
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

interface Entry {
  hi: InstancedMesh; lo: InstancedMesh; clouds: InstancedMesh | null;
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

  for (let type = 0; type < PLANET_TYPES; type++) {
    const list: number[] = [];
    for (let i = 0; i < world.count; i++) {
      const kind = world.kind[i]!;
      if (kind >= KIND_ROCKY && kind <= KIND_MOON && planetTypeFor(kind, i) === type) list.push(i);
    }
    if (list.length === 0) continue;
    const indices = Int32Array.from(list);
    const n = indices.length;
    const common = { uTime: time, uSunPos: { value: sunPos }, uLight: { value: light } };
    const mat = new ShaderMaterial({ uniforms: { ...common, uType: { value: type }, uOct: { value: octaves } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG });
    materials.push(mat);
    const hi = new InstancedMesh(geoHi, mat, n);
    const lo = new InstancedMesh(geoLo, mat, n);
    hi.frustumCulled = false; lo.frustumCulled = false;
    let clouds: InstancedMesh | null = null;
    if (type === 1) {
      clouds = new InstancedMesh(geoHi, new ShaderMaterial({ uniforms: common, vertexShader: VERT, fragmentShader: NOISE_GLSL + CLOUD_FRAG, transparent: true, depthWrite: false }), n);
      clouds.frustumCulled = false;
    }
    const spin = new Float32Array(n), seed = new Float32Array(n);
    for (let s = 0; s < n; s++) {
      spin[s] = rng.range(0.12, 0.35);
      seed[s] = rng.next();
      seedCol.setRGB(seed[s]!, 0, 0);
      hi.setColorAt(s, seedCol); lo.setColorAt(s, seedCol); clouds?.setColorAt(s, seedCol);
    }
    group.add(hi, lo);
    if (clouds) group.add(clouds);
    entries.push({ hi, lo, clouds, indices, spin, seed });
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
          if (w.state[i] === DEAD) continue;   // tragado
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
        if (en.clouds) {
          en.clouds.count = nHi;
          en.clouds.instanceMatrix.needsUpdate = true;
          if (en.clouds.instanceColor) en.clouds.instanceColor.needsUpdate = true;
        }
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
