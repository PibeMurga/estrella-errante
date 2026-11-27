import { AdditiveBlending, Color, Group, Mesh, PlaneGeometry, PointLight, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { DEAD, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Estrellas del mapa (no la tuya): superficie que hierve con oscurecimiento hacia el borde, una corona suave que respira
// y luz propia que ilumina lo que tienen cerca. El color sale del tamaño, como en las reales: las chicas son enanas rojas
// (algunas del tamaño de Júpiter), las medianas amarillas o blancas y las grandes blanco azuladas.

const VERT = /* glsl */ `varying vec3 vN; varying vec3 vO; varying vec3 vV;
void main(){ vO = position; vec4 w = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;
const FRAG = /* glsl */ `uniform float uTime; uniform vec3 uHot; uniform vec3 uCool; uniform float uSeed; varying vec3 vN; varying vec3 vO; varying vec3 vV;
void main(){
  vec3 p = normalize(vO);
  float mu = clamp(dot(normalize(vN), normalize(vV)), 0., 1.);
  vec3 q = p*16. + vec3(0., uTime*.25, uTime*.15) + uSeed + .4*vec3(snoise(p*5.+uTime*.35), snoise(p*5.+7.+uTime*.3), 0.);
  float gran = 1. - smoothstep(.05, .85, worley(q));
  float sp = smoothstep(.72, .78, fbm(p*2.4 + uSeed + vec3(0., 0., uTime*.01), 4)*.5+.5);
  vec3 col = mix(uCool, uHot, gran*.7 + .3);
  col = mix(col, uCool*.3, sp*.7);
  col *= .3 + .7*pow(mu, .5);
  // Sin encandilar: las calientes (blancas y azuladas) ya son claras, se las baja para que se vea su superficie.
  gl_FragColor = vec4(col * (1.25 - .45*max(max(uHot.r, uHot.g), uHot.b)*step(.9, uHot.b)), 1.);
}`;
const HALO_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const HALO_FRAG = /* glsl */ `uniform float uTime; uniform vec3 uTint; uniform float uSeed; varying vec2 vUv;
void main(){
  vec2 d = (vUv*2.-1.)*3.2; float r = length(d), a = atan(d.y, d.x);
  if (r < .98) discard;
  float h = r - 1.;
  float n = fbm(vec3(cos(a)*2. + uSeed, sin(a)*2., h*1.5 - uTime*.15), 3)*.5+.5;
  vec3 col = uTint * (exp(-h*40.)*1.4 + exp(-h*2.4)*.32*(.6 + .8*n));
  gl_FragColor = vec4(col * (1. - smoothstep(1.6, 3.1, r)), 1.);
}`;

// Del tamaño al color (temperatura): rojo, naranja, amarillo, blanco, blanco azulado.
const HOT = [new Color(1.0, 0.45, 0.2), new Color(1.0, 0.7, 0.35), new Color(1.0, 0.92, 0.7), new Color(0.95, 0.97, 1.0), new Color(0.75, 0.85, 1.0)];
const COOL = [new Color(0.6, 0.08, 0.02), new Color(0.8, 0.25, 0.05), new Color(0.9, 0.5, 0.15), new Color(0.75, 0.7, 0.65), new Color(0.4, 0.5, 0.9)];

export function createMapStarsLayer(world: World): Layer {
  const group = new Group();
  const geo = new SphereGeometry(1, 64, 32), haloGeo = new PlaneGeometry(6.4, 6.4);
  const idx = world.mapStars;
  const items: { body: number; sphere: Mesh; halo: Mesh; light: PointLight; mat: ShaderMaterial; hmat: ShaderMaterial }[] = [];
  const time = { value: 0 };
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k]!, R = world.radius[i];
    const t = Math.min(4, Math.max(0, Math.floor(((R - 9) / 13) * 5)));
    const mat = new ShaderMaterial({ uniforms: { uTime: time, uHot: { value: HOT[t]!.clone() }, uCool: { value: COOL[t]!.clone() }, uSeed: { value: k * 3.7 } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG });
    const hmat = new ShaderMaterial({ uniforms: { uTime: time, uTint: { value: HOT[t]!.clone() }, uSeed: { value: k * 1.9 } }, vertexShader: HALO_VERT, fragmentShader: NOISE_GLSL + HALO_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending });
    const sphere = new Mesh(geo, mat), halo = new Mesh(haloGeo, hmat);
    const light = new PointLight(HOT[t]!.getHex(), 1.2 + R * 0.12, R * 22, 1.2);
    sphere.frustumCulled = halo.frustumCulled = false;
    group.add(sphere, halo, light);
    items.push({ body: i, sphere, halo, light, mat, hmat });
  }
  const pos = new Vector3();

  return {
    object: group,
    update(ctx) {
      const w = ctx.world, a = ctx.alpha;
      time.value = ctx.time;
      for (let k = 0; k < items.length; k++) {
        const it = items[k]!, i = it.body;
        const on = w.state[i] !== DEAD;
        it.sphere.visible = it.halo.visible = it.light.visible = on;
        if (!on) continue;
        pos.set(w.prevX[i] + (w.x[i] - w.prevX[i]) * a, 0, -(w.prevY[i] + (w.y[i] - w.prevY[i]) * a));
        const R = w.radius[i];
        it.sphere.position.copy(pos); it.sphere.scale.setScalar(R); it.sphere.rotation.y = ctx.time * 0.05;
        it.halo.position.copy(pos); it.halo.scale.setScalar(R); it.halo.quaternion.copy(ctx.camera.quaternion);
        it.light.position.copy(pos);
      }
    },
  };
}
