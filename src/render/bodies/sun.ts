import { AdditiveBlending, Group, Mesh, PlaneGeometry, PointLight, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { OVER_SWALLOWED, starSize } from '../../sim/world';
import { toWorld } from '../cameraRig';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';
import { smoothToward } from '../smooth';

// Paleta del sol por etapa (caliente, media, borde). Enana roja → amarilla → blanca → gigante azul → supergigante.
const PALETTES: readonly (readonly number[])[] = [
  [1.0, 0.42, 0.10, 0.85, 0.16, 0.03, 0.50, 0.05, 0.01],
  [1.0, 0.58, 0.18, 0.95, 0.30, 0.05, 0.62, 0.09, 0.015],
  [1.0, 0.90, 0.72, 1.0, 0.70, 0.42, 0.78, 0.38, 0.18],
  [0.78, 0.88, 1.0, 0.46, 0.62, 1.0, 0.24, 0.30, 0.72],
  [0.92, 0.96, 1.0, 0.62, 0.76, 1.0, 0.36, 0.42, 0.86],
];

const SUN_VERT = /* glsl */ `varying vec3 vN; varying vec3 vO; varying vec3 vV;
void main(){ vO = position; vec4 w = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;

// Superficie del sol: granulación que hierve, manchas, fáculas y oscurecimiento hacia el borde.
const SUN_FRAG = /* glsl */ `uniform float uTime; uniform float uIntensity; uniform vec3 uHot; uniform vec3 uMid; uniform vec3 uCool; varying vec3 vN; varying vec3 vO; varying vec3 vV;
void main(){
  vec3 p = normalize(vO); float t = uTime;
  float mu = clamp(dot(normalize(vN), normalize(vV)), 0., 1.);
  vec3 q = p*22. + vec3(0., t*.18, t*.11) + .35*vec3(snoise(p*6.+t*.2), snoise(p*6.+9.+t*.2), snoise(p*6.+17.+t*.2));
  float c = worley(q); float gran = 1. - smoothstep(.05, .85, c);
  float fine = fbm(p*60. + t*.3, 3)*.5+.5;
  float sg = fbm(p*3.2 + vec3(t*.01), 5)*.5+.5;
  float sp = fbm(p*2.6 + 11.3, 5)*.5+.5;
  float spot = smoothstep(.73, .78, sp);
  float pen = smoothstep(.69, .74, sp);
  float fac = smoothstep(.62, .8, fbm(p*9. + 3.1, 4)*.5+.5) * (1. - mu);
  vec3 hot = uHot, mid = uMid, cool = uCool;
  vec3 col = mix(mid, hot, gran*.75 + fine*.15);
  col *= .82 + .3*sg;
  col = mix(col, cool*.55, pen*.55); col = mix(col, vec3(.12,.03,.01), spot*.85);
  col += hot*fac*.35;
  float limb = pow(mu, .55);
  col = mix(cool*.7, col, smoothstep(0., .55, mu)) * (.28 + .72*limb);
  gl_FragColor = vec4(col * uIntensity, 1.);
}`;

const HALO_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

// Cromosfera, protuberancias y corona cálida en una lámina que siempre mira a la cámara.
const HALO_FRAG = /* glsl */ `uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
void main(){
  vec2 d = (vUv*2.-1.)*3.5; float r = length(d); float a = atan(d.y, d.x);
  if (r < .985) discard;
  float h = r - 1.;
  vec3 ring = uTint * vec3(1.,.55,.4) * exp(-h*55.) * 1.8;
  float flow = fbm(vec3(cos(a)*3., sin(a)*3., h*3.5 - uTime*.12), 5)*.5+.5;
  float loops = smoothstep(.6, .8, flow) * exp(-h*9.) * smoothstep(0., .03, h);
  float spikes = smoothstep(.55, .9, fbm(vec3(cos(a)*7., sin(a)*7., uTime*.05), 4)*.5+.5);
  vec3 prom = uTint * vec3(1.,.7,.55) * loops * (1.2 + spikes) * 1.4;
  vec3 cor = uTint * exp(-h*2.2) * .28;
  gl_FragColor = vec4((ring + prom + cor) * (1. - smoothstep(1.8, 3.3, r)), 1.);
}`;

export const starRenderRadius = starSize;

// La estrella del jugador como un sol, con su luz para los cuerpos (posición compartida en `sunPos`).
export function createSunLayer(sunPos: Vector3): Layer {
  const pal = Float32Array.from(PALETTES[0]!);
  const hot = new Vector3(), mid = new Vector3(), cool = new Vector3(), tint = new Vector3();
  const sunMat = new ShaderMaterial({ uniforms: { uTime: { value: 0 }, uIntensity: { value: 1.45 }, uHot: { value: hot }, uMid: { value: mid }, uCool: { value: cool } }, vertexShader: SUN_VERT, fragmentShader: NOISE_GLSL + SUN_FRAG });
  const sun = new Mesh(new SphereGeometry(1, 128, 64), sunMat);
  const haloMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTint: { value: tint } }, vertexShader: HALO_VERT, fragmentShader: NOISE_GLSL + HALO_FRAG,
    depthWrite: false, transparent: true, blending: AdditiveBlending,
  });
  const halo = new Mesh(new PlaneGeometry(7, 7), haloMat);
  const light = new PointLight(0xffc890, 2.4, 0, 0);
  const group = new Group();
  group.add(sun, halo, light);
  let shownR = -1;   // radio que se ve: sigue al radio real con una curva suave, sin saltos

  return {
    object: group,
    update(ctx) {
      toWorld(ctx.starX, ctx.starY, sunPos);
      // Tragada por el agujero negro: se achica hasta desaparecer.
      const swallowed = ctx.world.over === OVER_SWALLOWED;
      const target = swallowed ? 0 : starRenderRadius(ctx.world.star.mass);
      shownR = shownR < 0 ? target : smoothToward(shownR, target, swallowed ? 2.5 : 1.2, ctx.dt);
      const r = Math.max(shownR, 1e-3);
      sun.visible = halo.visible = shownR > 0.05;
      sun.position.copy(sunPos); sun.scale.setScalar(r); sun.rotation.y = ctx.time * 0.03;
      halo.position.copy(sunPos); halo.scale.setScalar(r); halo.quaternion.copy(ctx.camera.quaternion);
      light.position.copy(sunPos);
      const palTarget = PALETTES[Math.min(ctx.world.stage, PALETTES.length - 1)]!;
      for (let k = 0; k < 9; k++) pal[k] = smoothToward(pal[k]!, palTarget[k]!, 0.8, ctx.dt);
      hot.set(pal[0]!, pal[1]!, pal[2]!); mid.set(pal[3]!, pal[4]!, pal[5]!); cool.set(pal[6]!, pal[7]!, pal[8]!);
      tint.set(pal[3]!, pal[4]!, pal[5]!).multiplyScalar(1.05);
      sunMat.uniforms['uTime']!.value = ctx.time;
      haloMat.uniforms['uTime']!.value = ctx.time;
    },
    applyParams(p) {
      sunMat.uniforms['uIntensity']!.value = p.sunIntensity;
      light.intensity = p.lightIntensity;
    },
  };
}
