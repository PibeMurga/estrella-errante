import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Group, Mesh, Points, ShaderMaterial, SphereGeometry } from 'three';
import type { Rng } from '../../sim/rng';
import type { Layer } from '../layer';
import type { QualitySettings } from '../quality';
import { NOISE_GLSL } from '../shaders/noise';

const SKY_VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const SKY_FRAG = /* glsl */ `
uniform float uIntensity; uniform int uOctaves; varying vec3 vDir;
void main(){
  vec3 d = vDir; float n1 = fbm(d*1.3, uOctaves); float n2 = fbm(d*1.7 + n1*.8 + 4.0, uOctaves + 1);
  float dens = smoothstep(.2, .95, n2*.5+.5); dens *= dens;
  vec3 col = mix(vec3(.02,.03,.08), vec3(.10,.035,.08), smoothstep(.3,.8,n1*.5+.5));
  col = mix(col, vec3(.22,.11,.05), smoothstep(.65,.98,dens)); col *= dens * .3;
  col *= 1. - .75*smoothstep(.48,.78, fbm(d*7., max(uOctaves - 1, 1))*.5+.5);
  gl_FragColor = vec4(col * uIntensity, 1.);
}`;
const STAR_VERT = /* glsl */ `uniform float uPR; attribute vec3 aCol; attribute float aSize; varying vec3 vC;
void main(){ vC = aCol; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize = aSize * uPR; }`;
const STAR_FRAG = /* glsl */ `varying vec3 vC; void main(){ vec2 d = gl_PointCoord-.5; float a = exp(-dot(d,d)*24.); gl_FragColor = vec4(vC*a,1.); }`;
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
  for (let i = 0; i < N; i++) {
    const u = rng.next() * 2 - 1, th = rng.next() * Math.PI * 2, r = 2300, s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(th) * s * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = Math.sin(th) * s * r;
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
  const stars = new Points(g, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(sky, stars);

  return {
    object: group,
    update(ctx) { group.position.copy(ctx.camera.position); },
    resize(ctx) { starMat.uniforms['uPR']!.value = ctx.dpr; },
    applyParams(p) { skyMat.uniforms['uIntensity']!.value = p.nebulaIntensity; },
  };
}
