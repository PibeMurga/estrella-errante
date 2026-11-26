import { AdditiveBlending, Group, Mesh, PlaneGeometry, PointLight, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { toWorld } from '../cameraRig';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

const SUN_VERT = /* glsl */ `varying vec3 vN; varying vec3 vO; varying vec3 vV;
void main(){ vO = position; vec4 w = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;

// Superficie del sol: granulación que hierve, manchas, fáculas y oscurecimiento hacia el borde.
const SUN_FRAG = /* glsl */ `uniform float uTime; uniform float uIntensity; varying vec3 vN; varying vec3 vO; varying vec3 vV;
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
  vec3 hot = vec3(1.0, .58, .18), mid = vec3(.95, .30, .05), cool = vec3(.62, .09, .015);
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
const HALO_FRAG = /* glsl */ `uniform float uTime; varying vec2 vUv;
void main(){
  vec2 d = (vUv*2.-1.)*3.5; float r = length(d); float a = atan(d.y, d.x);
  if (r < .985) discard;
  float h = r - 1.;
  vec3 ring = vec3(1.,.28,.06) * exp(-h*55.) * 1.8;
  float flow = fbm(vec3(cos(a)*3., sin(a)*3., h*3.5 - uTime*.12), 5)*.5+.5;
  float loops = smoothstep(.6, .8, flow) * exp(-h*9.) * smoothstep(0., .03, h);
  float spikes = smoothstep(.55, .9, fbm(vec3(cos(a)*7., sin(a)*7., uTime*.05), 4)*.5+.5);
  vec3 prom = vec3(1.,.36,.1) * loops * (1.2 + spikes) * 1.4;
  vec3 cor = vec3(1.,.45,.15) * exp(-h*2.2) * .28;
  gl_FragColor = vec4((ring + prom + cor) * (1. - smoothstep(1.8, 3.3, r)), 1.);
}`;

export function starRenderRadius(mass: number): number {
  return 4 + 0.5 * Math.sqrt(mass);
}

// La estrella del jugador como un sol, con su luz para los cuerpos (posición compartida en `sunPos`).
export function createSunLayer(sunPos: Vector3): Layer {
  const sunMat = new ShaderMaterial({ uniforms: { uTime: { value: 0 }, uIntensity: { value: 1.45 } }, vertexShader: SUN_VERT, fragmentShader: NOISE_GLSL + SUN_FRAG });
  const sun = new Mesh(new SphereGeometry(1, 128, 64), sunMat);
  const haloMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, vertexShader: HALO_VERT, fragmentShader: NOISE_GLSL + HALO_FRAG,
    depthWrite: false, transparent: true, blending: AdditiveBlending,
  });
  const halo = new Mesh(new PlaneGeometry(7, 7), haloMat);
  const light = new PointLight(0xffc890, 2.4, 0, 0);
  const group = new Group();
  group.add(sun, halo, light);

  return {
    object: group,
    update(ctx) {
      toWorld(ctx.starX, ctx.starY, sunPos);
      const r = starRenderRadius(ctx.world.star.mass);
      sun.position.copy(sunPos); sun.scale.setScalar(r); sun.rotation.y = ctx.time * 0.03;
      halo.position.copy(sunPos); halo.scale.setScalar(r); halo.quaternion.copy(ctx.camera.quaternion);
      light.position.copy(sunPos);
      sunMat.uniforms['uTime']!.value = ctx.time;
      haloMat.uniforms['uTime']!.value = ctx.time;
    },
    applyParams(p) {
      sunMat.uniforms['uIntensity']!.value = p.sunIntensity;
      light.intensity = p.lightIntensity;
    },
  };
}
