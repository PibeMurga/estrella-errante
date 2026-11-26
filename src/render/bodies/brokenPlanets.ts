import { Color, DoubleSide, Frustum, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, ShaderMaterial, Sphere, SphereGeometry, Vector3 } from 'three';
import { DEAD, KIND_ICE, KIND_ROCKY, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Planetas partidos por marea: dos mitades de corteza que se separan de a poco, con el interior de roca en estratos,
// un borde incandescente fino y un núcleo al rojo que se van enfriando. Los escombros son asteroides de la simulación.
// Cada instancia tiene su eje local Y alineado con el eje de la ruptura (hacia el agujero negro).

const VERT = /* glsl */ `uniform float uSide; varying vec3 vN; varying vec3 vP; varying vec3 vO; varying vec3 vCut; varying float vSeed; varying float vHeat; varying float vIce;
void main(){
  mat4 m = modelMatrix * instanceMatrix;
  vSeed = instanceColor.r * 97.0; vHeat = instanceColor.g; vIce = instanceColor.b;
  vO = position; vec4 w = m*vec4(position,1.); vP = w.xyz; vN = normalize(mat3(m)*normal);
  vCut = normalize(mat3(m)*vec3(0., -uSide, 0.));   // normal de la cara del corte: al volcar, el sol la ilumina distinto
  gl_Position = projectionMatrix*viewMatrix*w;
}`;

const FRAG = /* glsl */ `uniform vec3 uSunPos; uniform vec3 uLight; uniform float uSide; uniform float uTime;
varying vec3 vN; varying vec3 vP; varying vec3 vO; varying vec3 vCut; varying float vSeed; varying float vHeat; varying float vIce;
void main(){
  vec3 p = normalize(vO);
  vec3 L = normalize(uSunPos - vP);
  float cut = p.y*uSide + .13*snoise(p*5.+vSeed) + .05*snoise(p*16.+vSeed);
  if (cut < .07) discard;
  float edge = 1. - smoothstep(.07, .11, cut);
  vec3 glow = vec3(1.6, .4, .08);
  if (!gl_FrontFacing) {
    // Interior: roca de fractura irregular, iluminada por el sol según hacia dónde mira el corte,
    // con estratos apenas insinuados y grietas de magma que se apagan al enfriarse.
    float n1 = fbm(p*7.+vSeed, 4)*.5+.5, n2 = fbm(p*23.+vSeed*1.7, 3)*.5+.5;
    float strata = smoothstep(.4, .6, sin(p.y*13. + n1*6.)*.5+.5) * .2;
    vec3 rockIn = mix(mix(vec3(.15,.13,.11), vec3(.29,.26,.22), n1), mix(vec3(.34,.40,.47), vec3(.58,.65,.72), n1), vIce);
    rockIn *= (.7 + .55*n2) * (1. - strata);
    float ndc = max(dot(vCut, L), 0.);
    float crack = smoothstep(.9, .98, 1. - abs(snoise(p*9. + vSeed + vec3(0., uTime*.02, 0.))));
    float heat = 1. - smoothstep(.0, .35, abs(p.y));
    vec3 c = rockIn * (uLight*ndc*.85 + .015) + glow*(1.1*crack*heat*vHeat + .2*(1.-n1)*vHeat*vHeat*vHeat);
    gl_FragColor = vec4(c, 1.); return;
  }
  float ndl = dot(normalize(vN), L);
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
const xAxis = new Vector3(1, 0, 0);
const qTumble = new Quaternion();
const qHalf = new Quaternion();
const off = new Vector3();
const col = new Color();
const frustum = new Frustum();
const projView = new Matrix4();
const bound = new Sphere();

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Separación de las mitades (en radios del planeta) según los segundos desde la ruptura:
// un tirón al partirse y después una deriva muy lenta que sigue durante minutos.
export function halfSeparation(t: number): number {
  return 0.32 * smooth(0, 2.5, t) + 0.9 * (1 - Math.exp(-t / 300));
}
// Vuelco de cada mitad (radianes): cada una gira despacio sobre su propio centro de masa, en sentidos opuestos,
// y con el tiempo deja ver la cara del corte. Arranca suave y no se detiene.
export function halfTumble(t: number, rate: number): number {
  return rate * (t - 4 * (1 - Math.exp(-t / 4)));
}
const CAP_CENTER = 0.42;   // centro de masa de cada mitad, en radios, sobre su eje
// Calor del borde y del núcleo: al rojo vivo al partirse, después queda un rescoldo que se apaga en unos minutos.
export function breakHeat(t: number): number {
  return 0.75 * Math.exp(-t / 12) + 0.25 * Math.exp(-t / 240);
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
        bound.center.copy(pos); bound.radius = r * 3.2;
        if (!frustum.intersectsSphere(bound)) continue;
        dir.set(w.breakAx[i]!, 0, -w.breakAy[i]!).normalize();
        qAlign.setFromUnitVectors(yAxis, dir);
        qSpin.setFromAxisAngle(yAxis, ctx.time * 0.05 + i);
        q.multiplyQuaternions(qAlign, qSpin);
        const sep = halfSeparation(t) * r, heat = breakHeat(t);
        col.setRGB((i * 0.6180339) % 1, heat, w.kind[i] === KIND_ICE ? 1 : 0);
        scl.setScalar(r);
        // Cada mitad vuelca sobre su centro de masa: se ubica ese centro y se corre la esfera según el giro.
        const rate = 0.006 + 0.009 * ((i * 0.7548776) % 1);
        for (let h = 0; h < 2; h++) {
          const sd = h === 0 ? 1 : -1;
          qTumble.setFromAxisAngle(xAxis, sd * halfTumble(t, rate));
          qHalf.multiplyQuaternions(q, qTumble);
          off.set(0, sd * CAP_CENTER * r, 0).applyQuaternion(qHalf);
          half.copy(pos).addScaledVector(dir, sd * (sep + CAP_CENTER * r)).sub(off);
          m4.compose(half, qHalf, scl);
          const m = h === 0 ? top : bottom;
          m.setMatrixAt(k, m4); m.setColorAt(k, col);
        }
        // El núcleo al rojo sólo se ve mientras las mitades están juntas: se encoge y se apaga en el primer medio minuto.
        scl.setScalar(r * 0.3 * Math.exp(-t / 12));
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
