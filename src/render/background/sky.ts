import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Group, Mesh, Points, ShaderMaterial, SphereGeometry, Vector3, Vector4 } from 'three';
import type { Rng } from '../../sim/rng';
import type { Layer } from '../layer';
import type { QualitySettings } from '../quality';
import { NOISE_GLSL } from '../shaders/noise';

const SKY_VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const SKY_FRAG = /* glsl */ `
uniform float uIntensity; uniform int uOctaves; varying vec3 vDir;
uniform vec4 uNeb[5]; uniform vec3 uNebCol[5]; uniform vec3 uNebCol2[5];
void main(){
  vec3 d = vDir; float n1 = fbm(d*1.3, uOctaves); float n2 = fbm(d*1.7 + n1*.8 + 4.0, uOctaves + 1);
  float dens = smoothstep(.2, .95, n2*.5+.5); dens *= dens;
  vec3 col = mix(vec3(.02,.03,.08), vec3(.10,.035,.08), smoothstep(.3,.8,n1*.5+.5));
  col = mix(col, vec3(.22,.11,.05), smoothstep(.65,.98,dens)); col *= dens * .3;
  col *= 1. - .75*smoothstep(.48,.78, fbm(d*7., max(uOctaves - 1, 1))*.5+.5);
  // Vía Láctea: una banda de luz difusa (millones de estrellas lejanas) con franjas de polvo oscuro en el medio.
  vec3 N = normalize(vec3(.35, .82, .45));
  float lat = dot(d, N), band = exp(-pow(lat / .2, 2.)), core = exp(-pow(lat / .07, 2.));
  float grain = fbm(d * 6. + 2., uOctaves) * .5 + .5, cloud = fbm(d * 2.2 + 9., uOctaves) * .5 + .5;
  float dust = smoothstep(.45, .75, fbm(d * 4.5 + vec3(3., 1., 7.), uOctaves) * .5 + .5) * core;
  vec3 milky = mix(vec3(.55, .6, .75), vec3(1., .88, .7), cloud) * (band * .07 * (.5 + .9 * grain) + core * .06) * (1. - .85 * dust);
  // Nebulosas de emisión y de reflexión, cada una en su lugar del cielo: rojo rosado (hidrógeno), verde azulado
  // (oxígeno), azul (polvo que refleja estrellas). Filamentos retorcidos, un núcleo más denso y franjas de polvo oscuro.
  vec3 neb = vec3(0.);
  for (int k = 0; k < 5; k++) {
    vec3 c = normalize(uNeb[k].xyz); float R = uNeb[k].w;
    float ang = acos(clamp(dot(d, c), -1., 1.));
    if (ang > R * 1.6) continue;
    vec3 q = d * 5. + float(k) * 7.3;
    float w1 = fbm(q + fbm(q * 1.7 + 3., uOctaves) * 1.4, uOctaves) * .5 + .5;
    float fil = pow(1. - abs(fbm(q * 2.4 + 9., uOctaves)), 5.);
    float shape = exp(-pow(ang / R, 2.) * 2.2) * (.55 + .9 * w1);
    float dustK = smoothstep(.55, .8, fbm(q * 3.1 + 21., uOctaves) * .5 + .5);
    vec3 nc = mix(uNebCol[k], uNebCol2[k], smoothstep(.35, .75, w1));
    neb += nc * (shape * (.35 + .9 * fil) + exp(-pow(ang / (R * .25), 2.)) * .4) * (1. - .8 * dustK);
  }
  gl_FragColor = vec4((col + milky + neb * .16) * uIntensity, 1.);
}`;
const STAR_VERT = /* glsl */ `uniform float uPR; attribute vec3 aCol; attribute float aSize; varying vec3 vC; varying float vBig;
void main(){ vC = aCol; vBig = step(2.9, max(aCol.r, max(aCol.g, aCol.b))); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.);
  gl_PointSize = aSize * uPR * (1. + vBig * 4.); }`;
// Las más brillantes, con cuatro puntas de difracción tenues (como en las fotos de telescopio).
const STAR_FRAG = /* glsl */ `varying vec3 vC; varying float vBig; void main(){ vec2 d = gl_PointCoord-.5; float a = exp(-dot(d,d)*(24. + 70. * vBig));
  float sp = vBig * (exp(-abs(d.x) * 90.) + exp(-abs(d.y) * 90.)) * (1. - smoothstep(.1, .5, length(d))) * .7;
  gl_FragColor = vec4(vC*(a + sp),1.); }`;
// Galaxias lejanas: manchitas elípticas, con núcleo amarillento y disco azulado; algunas de canto.
const GAL_VERT = /* glsl */ `uniform float uPR; attribute float aSize; attribute vec3 aShape; varying vec3 vShape;
void main(){ vShape = aShape; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize = aSize * uPR; }`;
const GAL_FRAG = /* glsl */ `varying vec3 vShape;
void main(){
  vec2 p = gl_PointCoord - .5; float c = cos(vShape.x), s = sin(vShape.x);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y); p.y /= vShape.y;
  float r = length(p) * 2.;
  float core = exp(-r * r * 60.), disk = exp(-r * 5.5) * (1. - smoothstep(.75, 1., r));
  float arms = .75 + .25 * sin(atan(p.y, p.x) * 2. + r * 14.);
  vec3 col = vec3(1., .86, .62) * core * 1.4 + vec3(.62, .72, 1.) * disk * arms * .55;
  gl_FragColor = vec4(col * vShape.z, 1.);
}`;

const TINTS: readonly (readonly [number, number, number])[] = [[0.72, 0.82, 1], [1, 1, 1], [1, 0.9, 0.76], [1, 0.74, 0.55]];

// Cielo: nebulosa en una esfera y estrellas de fondo en otra. Ambas siguen a la cámara.
export function createSky(quality: QualitySettings, rng: Rng): Layer {
  const group = new Group();
  const skyMat = new ShaderMaterial({
    uniforms: { uIntensity: { value: 1 }, uOctaves: { value: quality.skyOctaves } },
    vertexShader: SKY_VERT, fragmentShader: NOISE_GLSL + SKY_FRAG, side: BackSide, depthWrite: false,
  });
  const sky = new Mesh(new SphereGeometry(2500, 64, 32), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;

  const N = quality.starCount;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  // La mitad de las estrellas, concentradas en la banda de la Vía Láctea (como en el cielo real).
  const bn = [0.35, 0.82, 0.45], bl = Math.hypot(bn[0]!, bn[1]!, bn[2]!);
  for (let i = 0; i < N; i++) {
    const u = rng.next() * 2 - 1, th = rng.next() * Math.PI * 2, r = 2300, s = Math.sqrt(1 - u * u);
    let x = Math.cos(th) * s, y = u, z = Math.sin(th) * s;
    if (i % 2 === 0) {
      const dd = (x * bn[0]! + y * bn[1]! + z * bn[2]!) / bl, keep = (rng.next() - 0.5) * 0.35;   // se la acerca a la banda
      x -= (bn[0]! / bl) * (dd - keep); y -= (bn[1]! / bl) * (dd - keep); z -= (bn[2]! / bl) * (dd - keep);
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    }
    pos[i * 3] = x * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = z * r;
    const b = 0.08 + Math.pow(rng.next(), 8) * 3.2;
    const t = TINTS[Math.floor(rng.next() * TINTS.length)]!;
    col[i * 3] = t[0] * b; col[i * 3 + 1] = t[1] * b; col[i * 3 + 2] = t[2] * b;
    size[i] = 0.8 + rng.next() * 1.5;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aCol', new BufferAttribute(col, 3));
  g.setAttribute('aSize', new BufferAttribute(size, 1));
  const starMat = new ShaderMaterial({
    uniforms: { uPR: { value: 1 } }, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    depthWrite: false, blending: AdditiveBlending, transparent: true,
  });
  // Nebulosas: cinco, en direcciones al azar, con colores de nebulosas reales.
  const NEB_COLS: readonly [number, number, number][][] = [
    [[0.85, 0.22, 0.32], [1.0, 0.45, 0.5]],     // emisión: hidrógeno alfa (rojo rosado)
    [[0.15, 0.6, 0.6], [0.35, 0.85, 0.75]],     // oxígeno (verde azulado)
    [[0.2, 0.35, 0.9], [0.5, 0.6, 1.0]],        // reflexión (azul)
    [[0.85, 0.3, 0.35], [0.25, 0.65, 0.7]],     // mezcla (rojo con centro verde azulado, como la Laguna)
    [[0.7, 0.4, 0.2], [0.9, 0.7, 0.45]],        // polvo cálido iluminado
  ];
  const nebU: number[][] = [], nebC: number[][] = [], nebC2: number[][] = [];
  for (let k = 0; k < 5; k++) {
    const u = rng.next() * 1.6 - 0.8, th = rng.next() * Math.PI * 2, sq = Math.sqrt(1 - u * u);
    nebU.push([Math.cos(th) * sq, u, Math.sin(th) * sq, 0.18 + rng.next() * 0.22]);
    const pal = NEB_COLS[k]!; nebC.push(pal[0]!); nebC2.push(pal[1]!);
  }
  skyMat.uniforms['uNeb'] = { value: nebU.map((v) => new Vector4(v[0], v[1], v[2], v[3])) };
  skyMat.uniforms['uNebCol'] = { value: nebC.map((v) => new Vector3(v[0], v[1], v[2])) };
  skyMat.uniforms['uNebCol2'] = { value: nebC2.map((v) => new Vector3(v[0], v[1], v[2])) };

  // Galaxias lejanas.
  const NG = 46;
  const gpos = new Float32Array(NG * 3), gsize = new Float32Array(NG), gshape = new Float32Array(NG * 3);
  for (let i = 0; i < NG; i++) {
    const u = rng.next() * 2 - 1, th = rng.next() * Math.PI * 2, sq = Math.sqrt(1 - u * u), r = 2250;
    gpos[i * 3] = Math.cos(th) * sq * r; gpos[i * 3 + 1] = u * r; gpos[i * 3 + 2] = Math.sin(th) * sq * r;
    gsize[i] = 5 + Math.pow(rng.next(), 3) * 22;
    const edgeOn = rng.next() < 0.3;
    gshape[i * 3] = rng.next() * Math.PI; gshape[i * 3 + 1] = edgeOn ? 0.12 + rng.next() * 0.1 : 0.35 + rng.next() * 0.6; gshape[i * 3 + 2] = 0.6 + rng.next() * 0.7;
  }
  const gg = new BufferGeometry();
  gg.setAttribute('position', new BufferAttribute(gpos, 3));
  gg.setAttribute('aSize', new BufferAttribute(gsize, 1));
  gg.setAttribute('aShape', new BufferAttribute(gshape, 3));
  const galMat = new ShaderMaterial({ uniforms: { uPR: { value: 1 } }, vertexShader: GAL_VERT, fragmentShader: GAL_FRAG, depthWrite: false, blending: AdditiveBlending, transparent: true });
  const galaxies = new Points(gg, galMat);
  galaxies.frustumCulled = false; galaxies.renderOrder = -9;

  const stars = new Points(g, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(sky, galaxies, stars);

  return {
    object: group,
    update(ctx) { group.position.copy(ctx.camera.position); },
    resize(ctx) { starMat.uniforms['uPR']!.value = ctx.dpr; galMat.uniforms['uPR']!.value = ctx.dpr; },
    applyParams(p) { skyMat.uniforms['uIntensity']!.value = p.nebulaIntensity; },
    applyQuality(q) {
      skyMat.uniforms['uOctaves']!.value = q.skyOctaves;
      g.setDrawRange(0, Math.min(N, q.starCount));
    },
  };
}
