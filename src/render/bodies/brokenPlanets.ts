import { Color, DoubleSide, Frustum, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, ShaderMaterial, Sphere, SphereGeometry, Vector3 } from 'three';
import { DEAD, KIND_ICE, KIND_ROCKY, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Planetas partidos por marea: dos mitades de corteza que se separan de a poco, con el interior de roca en estratos,
// un borde incandescente fino y un núcleo al rojo que se van enfriando. Los escombros son asteroides de la simulación.
// Cada instancia tiene su eje local Y alineado con el eje de la ruptura (hacia el agujero negro).

const VERT = /* glsl */ `varying vec3 vN; varying vec3 vP; varying vec3 vO; varying float vSeed; varying float vHeat; varying float vIce;
void main(){
  mat4 m = modelMatrix * instanceMatrix;
  vSeed = instanceColor.r * 97.0; vHeat = instanceColor.g; vIce = instanceColor.b;
  vO = position; vec4 w = m*vec4(position,1.); vP = w.xyz; vN = normalize(mat3(m)*normal);
  gl_Position = projectionMatrix*viewMatrix*w;
}`;

const FRAG = /* glsl */ `uniform vec3 uSunPos; uniform vec3 uLight; uniform float uSide; uniform float uTime;
varying vec3 vN; varying vec3 vP; varying vec3 vO; varying float vSeed; varying float vHeat; varying float vIce;
void main(){
  vec3 p = normalize(vO);
  float cut = p.y*uSide + .13*snoise(p*5.+vSeed) + .05*snoise(p*16.+vSeed);
  if (cut < .07) discard;
  float edge = 1. - smoothstep(.07, .11, cut);
  vec3 glow = vec3(1.6, .4, .08);
  if (!gl_FrontFacing) {
    // Interior: estratos de roca oscura con alguna grieta de magma cerca del plano de corte.
    float strata = sin(p.y*40. + fbm(p*6.+vSeed, 3)*3.)*.5+.5;
    vec3 rockIn = mix(mix(vec3(.05,.035,.03), vec3(.11,.07,.05), strata), mix(vec3(.10,.12,.15), vec3(.2,.24,.3), strata), vIce);
    float crack = smoothstep(.9, .98, 1. - abs(snoise(p*9. + vSeed + vec3(0., uTime*.02, 0.))));
    float heat = 1. - smoothstep(.0, .35, abs(p.y));
    gl_FragColor = vec4(rockIn + glow*1.1*crack*heat*vHeat, 1.); return;
  }
  vec3 L = normalize(uSunPos - vP); float ndl = dot(normalize(vN), L);
  float lit = max(ndl, 0.) * smoothstep(-.04, .12, ndl);
  float f = fbm(p*4.+vSeed, 5)*.5+.5;
  vec3 alb = mix(mix(vec3(.29,.27,.25), vec3(.16,.15,.14), f), mix(vec3(.55,.63,.75), vec3(.88,.92,.95), f), vIce);
  float vein = smoothstep(.93, .99, 1. - abs(snoise(p*7.+vSeed))) * (1. - smoothstep(.07, .16, cut));
  vec3 col = alb * uLight * lit + alb*.004;
  col += glow * (edge*.6 + vein*.25) * vHeat;
  gl_FragColor = vec4(col, 1.);
}`;

const LIGHT_BASE = new Vector3(1.25, 1.02, 0.8);
const m4 = new Matrix4();
const qAlign = new Quaternion();
const qSpin = new Quaternion();
const q = new Quaternion();
const pos = new Vector3();
const half = new Vector3();
const dir = new Vector3();
const scl = new Vector3();
const yAxis = new Vector3(0, 1, 0);
const col = new Color();
const frustum = new Frustum();
const projView = new Matrix4();
const bound = new Sphere();

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Separación de las mitades (en radios del planeta) según los segundos desde la ruptura.
export function halfSeparation(t: number): number {
  return 0.32 * smooth(0, 2.5, t) + Math.min(0.25, 0.004 * t);
}
// Calor del borde y del núcleo: al rojo vivo al partirse, después se enfría hasta un rescoldo.
export function breakHeat(t: number): number {
  return 0.25 + 0.75 * Math.exp(-t / 12);
}

export function createBrokenPlanetsLayer(world: World, sunPos: Vector3): Layer {
  const group = new Group();
  const list: number[] = [];
  for (let i = 0; i < world.count; i++) if (world.kind[i] === KIND_ROCKY || world.kind[i] === KIND_ICE) list.push(i);
  const idx = Int32Array.from(list);
  const n = Math.max(1, idx.length);
  const time = { value: 0 };
  const light = LIGHT_BASE.clone();
  const geo = new SphereGeometry(1, 64, 32);
  const halves: InstancedMesh[] = [];
  for (const side of [1, -1]) {
    const mat = new ShaderMaterial({
      uniforms: { uSunPos: { value: sunPos }, uLight: { value: light }, uSide: { value: side }, uTime: time },
      vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG, side: DoubleSide,
    });
    const mesh = new InstancedMesh(geo, mat, n);
    mesh.frustumCulled = false; mesh.count = 0;
    mesh.setColorAt(0, col.setRGB(0, 0, 0));
    halves.push(mesh);
    group.add(mesh);
  }
  const core = new InstancedMesh(new SphereGeometry(1, 24, 12), new MeshBasicMaterial({ color: 0xffffff }), n);
  core.frustumCulled = false; core.count = 0;
  core.setColorAt(0, col.setRGB(0, 0, 0));
  group.add(core);
  const top = halves[0]!, bottom = halves[1]!;
  const meshes: readonly InstancedMesh[] = [top, bottom, core];

  return {
    object: group,
    update(ctx) {
      const w = ctx.world, a = ctx.alpha;
      frustum.setFromProjectionMatrix(projView.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse));
      time.value = ctx.time;
      let k = 0;
      for (let s = 0; s < idx.length; s++) {
        const i = idx[s]!;
        const t = w.broken[i]!;
        if (t <= 0 || w.state[i] === DEAD) continue;
        const x = w.prevX[i] + (w.x[i] - w.prevX[i]) * a;
        const y = w.prevY[i] + (w.y[i] - w.prevY[i]) * a;
        const r = w.radius[i];
        pos.set(x, 0, -y);
        bound.center.copy(pos); bound.radius = r * 1.8;
        if (!frustum.intersectsSphere(bound)) continue;
        dir.set(w.breakAx[i]!, 0, -w.breakAy[i]!).normalize();
        qAlign.setFromUnitVectors(yAxis, dir);
        qSpin.setFromAxisAngle(yAxis, ctx.time * 0.05 + i);
        q.multiplyQuaternions(qAlign, qSpin);
        const sep = halfSeparation(t) * r, heat = breakHeat(t);
        col.setRGB((i * 0.6180339) % 1, heat, w.kind[i] === KIND_ICE ? 1 : 0);
        scl.setScalar(r);
        half.copy(pos).addScaledVector(dir, sep);
        m4.compose(half, q, scl); top.setMatrixAt(k, m4); top.setColorAt(k, col);
        half.copy(pos).addScaledVector(dir, -sep);
        m4.compose(half, q, scl); bottom.setMatrixAt(k, m4); bottom.setColorAt(k, col);
        scl.setScalar(r * 0.3);
        m4.compose(pos, q, scl); core.setMatrixAt(k, m4);
        core.setColorAt(k, col.setRGB(2.2 * heat, 0.7 * heat, 0.15 * heat));
        k++;
      }
      for (let j = 0; j < meshes.length; j++) {
        const m = meshes[j]!;
        m.count = k;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    },
    applyParams(p) {
      light.copy(LIGHT_BASE).multiplyScalar(p.lightIntensity / 2.4);
    },
  };
}
