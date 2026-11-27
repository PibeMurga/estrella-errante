import { AdditiveBlending, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { planetTier, TIER_BREAK, TIER_GRAVE, TIER_HURT } from '../../sim/planetCapture';
import { FREE, PHASE_PLAY, starSize, type World } from '../../sim/world';
import type { Layer } from '../layer';

// Marcas de peligro minimalistas: un arco fino alrededor de los planetas cercanos que podrías chocar.
// Trazos verde fósforo: se puede partir. Rojo: daña. Rojo doble que late: golpe grave. Lo que entra solo no lleva marca.
// Sólo aparecen cerca (borde a borde, a menos de RANGE) y se encienden y apagan de a poco.

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv*2. - 1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FRAG = /* glsl */ `uniform vec3 uColor; uniform float uDash; uniform float uAlpha; uniform float uGrave; uniform float uTime; varying vec2 vUv;
void main(){
  float r = length(vUv);
  float ring = exp(-pow((r - .86) / .02, 2.));
  if (uGrave > .5) ring = (ring + exp(-pow((r - .76) / .018, 2.))) * (.65 + .35 * sin(uTime * 6.));   // grave: aro doble que late
  float a = atan(vUv.y, vUv.x);
  float dash = uDash > .5 ? step(.5, fract(a * 6. / 3.14159)) : 1.;
  gl_FragColor = vec4(uColor * ring * dash * uAlpha, 1.);
}`;

const MAX = 12;
const RANGE = 35;
const COLORS = [new Vector3(0.48, 0.96, 0.79), new Vector3(1, 0.23, 0.18), new Vector3(1, 0.23, 0.18)];   // partir (verde), daña (rojo), grave (rojo doble)

export interface DangerMarksLayer extends Layer { readonly shown: number }

export function createDangerMarksLayer(world: World): DangerMarksLayer {
  const group = new Group();
  const geo = new PlaneGeometry(2, 2);
  const meshes: Mesh[] = [], mats: ShaderMaterial[] = [];
  for (let k = 0; k < MAX; k++) {
    const mat = new ShaderMaterial({
      uniforms: { uColor: { value: new Vector3() }, uDash: { value: 0 }, uAlpha: { value: 0 }, uGrave: { value: 0 }, uTime: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    const m = new Mesh(geo, mat);
    m.frustumCulled = false; m.visible = false; m.renderOrder = 5;
    group.add(m); meshes.push(m); mats.push(mat);
  }
  const alpha = new Float32Array(world.capacity);
  const tierOf = new Int8Array(world.capacity);
  let shown = 0;

  return {
    object: group,
    get shown() { return shown; },
    update(ctx) {
      const w = ctx.world, a = ctx.alpha, E = starSize(w.star.mass);
      const sx = ctx.starX, sy = ctx.starY, k = Math.min(1, ctx.dt * 4);
      let used = 0;
      shown = 0;
      for (let q = 0; q < w.planets.length; q++) {
        const p = w.planets[q]!;
        const x = w.prevX[p] + (w.x[p] - w.prevX[p]) * a, y = w.prevY[p] + (w.y[p] - w.prevY[p]) * a;
        const r = w.radius[p];
        let want = 0;
        if (w.state[p] === FREE && w.parent[p] === -1 && w.over === 0 && w.phase === PHASE_PLAY) {   // sólo en la partida normal
          const t = planetTier(r, w.star.mass);
          if (t >= TIER_BREAK && !(t === TIER_BREAK && w.broken[p]! > 0) && Math.hypot(x - sx, y - sy) - E - r < RANGE) { want = 1; tierOf[p] = t; }
        }
        alpha[p] = alpha[p]! + (want - alpha[p]!) * k;
        if (alpha[p]! <= 0.01 || used >= MAX) continue;
        const m = meshes[used]!, mat = mats[used]!;
        m.visible = true;
        m.position.set(x, 0.4, -y);
        m.scale.setScalar(r * 1.45);
        m.quaternion.copy(ctx.camera.quaternion);
        const t = tierOf[p]!;
        (mat.uniforms['uColor']!.value as Vector3).copy(COLORS[t === TIER_GRAVE ? 2 : t === TIER_HURT ? 1 : 0]!);
        mat.uniforms['uDash']!.value = t === TIER_BREAK ? 1 : 0;
        mat.uniforms['uGrave']!.value = t === TIER_GRAVE ? 1 : 0;
        mat.uniforms['uTime']!.value = ctx.time;
        mat.uniforms['uAlpha']!.value = alpha[p]!;
        used++;
        if (want === 1) shown++;
      }
      for (let u = used; u < MAX; u++) meshes[u]!.visible = false;
    },
  };
}
