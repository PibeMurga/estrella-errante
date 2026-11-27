import { Color, DoubleSide, Frustum, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, ShaderMaterial, Sphere, SphereGeometry, Vector3 } from 'three';
import { DEAD, KIND_ICE, KIND_ROCKY, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';
import { capCentroid, capVolume, cutOffset, halfSeed } from '../../sim/halves';
import { planetVisualFor, VISUALS } from './planets';

// Planetas partidos: dos pedazos de corteza, no necesariamente iguales (el corte cae en cualquier altura),
// que se separan y vuelcan de a poco. La cara del corte es plana: se dibuja con las caras traseras de la esfera,
// pero la textura y el calor se calculan sobre el plano del corte (intersección del rayo de la cámara con ese plano),
// así se ve roca maciza y no una cáscara hueca. Los escombros son asteroides de la simulación.
// Cada instancia tiene su eje local Y alineado con el eje de la ruptura. Cada planeta partido conserva los colores
// de su tipo (desierto, oceánico, lava, hielo…): se reconoce qué planeta era.

const VERT = /* glsl */ `uniform float uSide; attribute vec3 aA; attribute vec3 aB; attribute vec3 aC; varying vec3 vA; varying vec3 vB; varying vec3 vC; varying vec3 vN; varying vec3 vP; varying vec3 vO; varying vec3 vCut; varying vec3 vCamO; varying float vSeed; varying float vHeat; varying float vIce;
void main(){
  mat4 m = modelMatrix * instanceMatrix;
  vA = aA; vB = aB; vC = aC;
  vSeed = instanceColor.r * 97.0; vHeat = instanceColor.g; vIce = instanceColor.b;
  vO = position; vec4 w = m*vec4(position,1.); vP = w.xyz; vN = normalize(mat3(m)*normal);
  vCut = normalize(mat3(m)*vec3(0., -uSide, 0.));   // normal de la cara del corte: al volcar, el sol la ilumina distinto
  vCamO = (inverse(m) * vec4(cameraPosition, 1.)).xyz;   // la cámara en el espacio del planeta
  gl_Position = projectionMatrix*viewMatrix*w;
}`;

const FRAG = /* glsl */ `uniform vec3 uSunPos; uniform vec3 uLight; uniform float uSide; uniform float uTime;
varying vec3 vA; varying vec3 vB; varying vec3 vC; varying vec3 vN; varying vec3 vP; varying vec3 vO; varying vec3 vCut; varying vec3 vCamO; varying float vSeed; varying float vHeat; varying float vIce;
void main(){
  vec3 p = normalize(vO);
  vec3 L = normalize(uSunPos - vP);
  float off = (fract(vSeed * .371) - .5) * .9;   // altura del corte: misma cuenta que cutOffset() en TypeScript
  float cut = (p.y - off)*uSide + .2*snoise(p*2.3+vSeed) + .08*snoise(p*7.+vSeed) + .03*snoise(p*19.+vSeed);
  if (cut < .05) discard;
  float edge = 1. - smoothstep(.05, .1, cut);
  vec3 glow = vec3(1.6, .4, .08);
  if (!gl_FrontFacing) {
    // Cara del corte: punto donde el rayo de la cámara cruza el plano del corte.
    vec3 d = vO - vCamO; float s = (off - vCamO.y) / (abs(d.y) > 1e-5 ? d.y : 1e-5);
    vec3 P = (s > 0. && s < 1.) ? vCamO + d*s : vO;
    float rr = length(P.xz);
    float n1 = fbm(P*5.+vSeed, 4)*.5+.5, n2 = fbm(P*19.+vSeed*1.7, 3)*.5+.5;
    float strata = smoothstep(.4, .6, sin(rr*16. + n1*5.)*.5+.5) * .18;   // capas del manto, insinuadas
    // El interior sale de los colores del planeta, más oscuros y apagados: la roca de adentro de ese mismo mundo.
    // Roca del manto: basalto gris pardo, apenas teñido por el planeta (nunca el color de sus mares o nubes).
    vec3 tint = mix(vA, vB, .5); float lum = dot(tint, vec3(.3, .59, .11));
    vec3 basalt = mix(vec3(.2, .17, .15), vec3(.34, .29, .24), n1);
    vec3 rockIn = mix(basalt, basalt * (tint / max(lum, .05)) * .9, .18) * (vIce > .5 ? 1.25 : 1.);
    rockIn *= (.7 + .55*n2) * (1. - strata);
    float ndc = max(dot(vCut, L), 0.);
    float crack = smoothstep(.86, .97, 1. - abs(snoise(P*3.5 + vSeed + vec3(0., uTime*.02, 0.))));
    float core = 1. - smoothstep(.0, .55, rr);        // el centro conserva el calor
    vec3 c = rockIn * (uLight*ndc*.85 + .015) + glow*(1.1*crack*(.3+.7*core)*vHeat*vHeat + .35*core*vHeat*vHeat);   // las grietas se apagan antes que el centro
    gl_FragColor = vec4(c, 1.); return;
  }
  float ndl = dot(normalize(vN), L);
  float lit = max(ndl, 0.) * smoothstep(-.04, .12, ndl);
  float f = fbm(p*4.+vSeed, 5)*.5+.5, g = fbm(p*15.+vSeed*1.3, 3)*.5+.5;
  // La superficie conserva los colores de su tipo: mezcla de sus tonos A y B, y manchas del tercero (mares, vetas, hielo).
  float g2 = fbm(p*2.6 + vSeed*.7, 4)*.5+.5;
  vec3 alb = mix(vA, vB, f);
  alb = mix(alb, vC, smoothstep(.56, .72, g2) * .55);
  alb *= .78 + .4*g;                                  // grano de superficie: que no se vea liso
  float vein = smoothstep(.93, .99, 1. - abs(snoise(p*7.+vSeed))) * (1. - smoothstep(.05, .16, cut));
  vec3 col = alb * uLight * lit + alb*.004;
  col += glow * (edge*.6 + vein*.25) * vHeat;
  gl_FragColor = vec4(col, 1.);
}`;

const LIGHT_BASE = new Vector3(1.25, 1.02, 0.8);
const m4 = new Matrix4();
const ZERO = new Matrix4().makeScale(0, 0, 0);
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

// Separación entre los pedazos (en radios del planeta) según los segundos desde la ruptura:
// un tirón al partirse y después una deriva muy lenta que sigue durante minutos.
export function halfSeparation(t: number): number {
  return 0.45 * smooth(0, 2.5, t) + 1.4 * (1 - Math.exp(-t / 300));
}
export { capCentroid, capVolume, cutOffset } from '../../sim/halves';
// Vuelco de cada mitad (radianes): cada una gira despacio sobre su propio centro de masa, en sentidos opuestos,
// y con el tiempo deja ver la cara del corte. Arranca suave y no se detiene.
export function halfTumble(t: number, rate: number): number {
  return rate * (t - 4 * (1 - Math.exp(-t / 4)));
}
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
  // Colores del tipo de cada planeta (los mismos de la capa de planetas), por instancia.
  const colA = new Float32Array(n * 3), colB = new Float32Array(n * 3), colC = new Float32Array(n * 3);
  const attrA = new InstancedBufferAttribute(colA, 3), attrB = new InstancedBufferAttribute(colB, 3), attrC = new InstancedBufferAttribute(colC, 3);
  geo.setAttribute('aA', attrA); geo.setAttribute('aB', attrB); geo.setAttribute('aC', attrC);
  const palette = new Float32Array(world.capacity * 9);   // A, B y C de cada planeta, armados una sola vez
  const tmpC = new Color();
  // Cada pedazo de reserva (el segundo de un partido) usa el aspecto del planeta del que salió.
  const srcOf = (i: number): number => { const t = world.twin[i]!; return t >= 0 && t < i ? t : i; };
  for (let s = 0; s < idx.length; s++) {
    const i = idx[s]!, v = VISUALS[planetVisualFor(world.kind[i]!, srcOf(i))]!;
    const hexes = [v.A, v.B ?? v.A, v.C ?? v.B ?? v.A];
    for (let h = 0; h < 3; h++) { tmpC.set(hexes[h]!); palette[i * 9 + h * 3] = tmpC.r; palette[i * 9 + h * 3 + 1] = tmpC.g; palette[i * 9 + h * 3 + 2] = tmpC.b; }
  }
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
        const src = srcOf(i), side = w.halfSide[i]!;
        const seed = halfSeed(src), h0 = cutOffset(seed);
        // Un pedazo suelto es un cuerpo con su radio de volumen: el dibujo usa el radio de la esfera entera.
        const r = side === 0 ? w.radius[i] : w.radius[i] / Math.cbrt(capVolume(side * h0));
        pos.set(x, 0, -y);
        bound.center.copy(pos); bound.radius = r * 4.2;
        if (!frustum.intersectsSphere(bound)) continue;
        dir.set(w.breakAx[i]!, 0, -w.breakAy[i]!).normalize();
        qAlign.setFromUnitVectors(yAxis, dir);
        qSpin.setFromAxisAngle(yAxis, ctx.time * 0.05 + src);
        q.multiplyQuaternions(qAlign, qSpin);
        const sep = halfSeparation(t) * r, heat = breakHeat(t);   // sep: lo que se aleja cada pedazo si fueran iguales
        for (let h = 0; h < 3; h++) { colA[k * 3 + h] = palette[i * 9 + h]!; colB[k * 3 + h] = palette[i * 9 + 3 + h]!; colC[k * 3 + h] = palette[i * 9 + 6 + h]!; }
        col.setRGB(seed, heat, w.kind[i] === KIND_ICE ? 1 : 0);
        scl.setScalar(r);
        // Cada pedazo vuelca sobre su centro de masa. El chico se aleja y gira más que el grande
        // (se reparten el empujón según su masa), y el centro de masa del conjunto queda quieto.
        const rate = 0.006 + 0.009 * ((src * 0.7548776) % 1);
        for (let h = 0; h < 2; h++) {
          const sd = h === 0 ? 1 : -1;
          if (side !== 0 && sd !== side) { (h === 0 ? top : bottom).setMatrixAt(k, ZERO); continue; }   // pedazo suelto: sólo el suyo
          const hh = sd * h0;                       // altura del corte vista desde este pedazo
          const mine = capVolume(hh), cen = capCentroid(hh);
          const push = sep * 2 * (1 - mine);
          qTumble.setFromAxisAngle(xAxis, sd * halfTumble(t, rate * Math.sqrt(0.5 / Math.max(mine, 0.1))));
          qHalf.multiplyQuaternions(q, qTumble);
          off.set(0, sd * cen * r, 0).applyQuaternion(qHalf);
          // Pedazo suelto: su posición ya es su centro de masa. Si no, los dos salen del centro de la esfera.
          if (side !== 0) half.copy(pos).sub(off);
          else half.copy(pos).addScaledVector(dir, sd * (push + cen * r)).sub(off);
          m4.compose(half, qHalf, scl);
          const m = h === 0 ? top : bottom;
          m.setMatrixAt(k, m4); m.setColorAt(k, col);
        }
        // El núcleo al rojo sólo se ve mientras las mitades están juntas: se encoge y se apaga en el primer medio minuto.
        // Con los pedazos sueltos, el núcleo queda entre los dos (lo dibuja el de arriba).
        const tw = w.twin[i]!;
        if (side === 1 && tw >= 0) pos.set((x + w.prevX[tw] + (w.x[tw] - w.prevX[tw]) * a) / 2, 0, -(y + w.prevY[tw] + (w.y[tw] - w.prevY[tw]) * a) / 2);
        scl.setScalar(side === -1 ? 0 : r * 0.3 * Math.exp(-t / 12));
        m4.compose(pos, q, scl); core.setMatrixAt(k, m4);
        core.setColorAt(k, col.setRGB(2.2 * heat, 0.7 * heat, 0.15 * heat));
        k++;
      }
      attrA.needsUpdate = attrB.needsUpdate = attrC.needsUpdate = true;
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
