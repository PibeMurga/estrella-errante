import { Frustum, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Sphere, SphereGeometry, Vector3 } from 'three';
import { planetHp } from '../../sim/planetCapture';
import { DEAD, KIND_GAS, KIND_ICE, KIND_ROCKY, MAX_IMPACTS, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { sceneLight } from '../lighting';
import { NOISE_GLSL } from '../shaders/noise';

// Marcas de los golpes en los planetas. Cada golpe deja un cráter donde pegó (cuenca oscura, borde que recibe la luz
// del sol y un halo de polvo eyectado); en un gaseoso, que no tiene superficie, una mancha oscura en las nubes (como
// las que dejó el cometa Shoemaker-Levy 9 en Júpiter). En los que se pueden partir, el daño abre grietas al rojo que
// crecen hasta partirlo. Es una cáscara apenas por encima del planeta que gira con él (mismo giro que la capa de
// planetas): las marcas quedan en el terreno.

const VERT = /* glsl */ `attribute vec4 aC0; attribute vec4 aC1; attribute vec4 aC2; attribute vec4 aC3; attribute vec3 aInfo;
varying vec4 vC0; varying vec4 vC1; varying vec4 vC2; varying vec4 vC3; varying vec3 vInfo; varying vec3 vO; varying vec3 vN; varying vec3 vP;
void main(){
  vC0 = aC0; vC1 = aC1; vC2 = aC2; vC3 = aC3; vInfo = aInfo; vO = position;
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m*vec4(position,1.); vP = w.xyz; vN = normalize(mat3(m)*normal);
  gl_Position = projectionMatrix*viewMatrix*w;
}`;

const FRAG = /* glsl */ `uniform vec3 uSunPos; uniform vec3 uLight;
varying vec4 vC0; varying vec4 vC1; varying vec4 vC2; varying vec4 vC3; varying vec3 vInfo; varying vec3 vO; varying vec3 vN; varying vec3 vP;
// Un cráter en la dirección c.xyz, de tamaño c.w (0 = no hay). Devuelve (oscuro de la cuenca, luz del borde, polvo).
vec3 crater(vec3 p, vec4 c, float gas){
  if (c.w <= 0.) return vec3(0.);
  float d = length(p - c.xyz) / c.w;
  float wob = .12*snoise(p*30. + c.xyz*7.);
  d += wob;
  if (gas > .5) return vec3((1. - smoothstep(.3, 1.3, d)) * (.55 + .3*snoise(p*12. + c.xyz)), 0., 0.);   // mancha en las nubes
  float basin = 1. - smoothstep(.55, .85, d);
  float rim = exp(-pow((d - .9)/.12, 2.));
  float rays = (1. - smoothstep(.9, 2.6, d)) * smoothstep(.2, .9, snoise(vec3(atan(p.y - c.y, p.x - c.x)*4., c.w*20., 0.)) * .5 + .5) * .5;
  return vec3(basin, rim, rays);
}
void main(){
  vec3 p = normalize(vO);
  float gas = vInfo.y;
  vec3 k = crater(p, vC0, gas) + crater(p, vC1, gas) + crater(p, vC2, gas) + crater(p, vC3, gas);
  vec3 L = normalize(uSunPos - vP);
  float ndl = dot(normalize(vN), L), lit = max(ndl, 0.) * smoothstep(-.04, .12, ndl);
  // Grietas: líneas que se abren con el daño (vInfo.x, de 0 a 1) y brillan al rojo desde adentro.
  float f = vInfo.x;
  // Las grietas son las líneas donde el ruido cruza el cero: continuas. Una máscara las va extendiendo con el daño.
  float z1 = abs(snoise(p*2.4 + vInfo.z*13.)), z2 = abs(snoise(p*5.5 + vInfo.z*7.));
  float reach = smoothstep(1. - 1.6*f, 1.2 - 1.6*f, .5 - .5*snoise(p*1.3 + vInfo.z*3.));
  float crack = ((1. - smoothstep(.0, .012 + .02*f, z1)) + .5*(1. - smoothstep(.0, .008 + .012*f, z2))) * reach * step(.01, f);
  float dark = min(1., k.x*.75 + k.z*.25 + crack*.6);
  vec3 col = vec3(.85, .8, .72) * uLight * lit * k.y * .55 + vec3(1.5, .38, .07) * crack * (.25 + .9*f);
  float alpha = clamp(dark + k.y*.35*lit + crack*.5, 0., 1.);
  gl_FragColor = vec4(col, alpha);
}`;

const MAX = 48;     // planetas marcados que se dibujan a la vez
const SLOTS = 4;    // cráteres que recuerda cada planeta (los más viejos se reemplazan)
const m4 = new Matrix4();
const q = new Quaternion();
const pos = new Vector3();
const scl = new Vector3();
const yAxis = new Vector3(0, 1, 0);
const frustum = new Frustum();
const projView = new Matrix4();
const bound = new Sphere();

export function createPlanetScarsLayer(world: World, sunPos: Vector3, light: Vector3, spinOf: Float32Array): Layer {
  const geo = new SphereGeometry(1, 64, 32);
  const lit = light.clone();
  const cAttr: InstancedBufferAttribute[] = [];
  for (let k = 0; k < SLOTS; k++) { const a = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4); geo.setAttribute(`aC${k}`, a); cAttr.push(a); }
  const info = new InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  geo.setAttribute('aInfo', info);
  const mat = new ShaderMaterial({
    uniforms: { uSunPos: { value: sunPos }, uLight: { value: lit } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
    transparent: true, depthWrite: false,
  });
  const mesh = new InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 1;
  const group = new Group();
  group.add(mesh);
  // Cráteres de cada cuerpo: dirección en el espacio del planeta (gira con él) y tamaño; y cuántos lleva.
  const craters = new Float32Array(world.capacity * SLOTS * 4);
  const count = new Uint16Array(world.capacity);
  let seen = 0, lastWorld: World | null = null;

  return {
    object: group,
    update(ctx) {
      const w = ctx.world, a = ctx.alpha;
      lit.copy(light).multiplyScalar(sceneLight.level);
      if (w !== lastWorld) { lastWorld = w; seen = 0; craters.fill(0); count.fill(0); }
      if (w.impactCount < seen) seen = w.impactCount;
      for (let n = Math.max(seen, w.impactCount - MAX_IMPACTS); n < w.impactCount; n++) {
        const o = (n % MAX_IMPACTS) * 4, p = w.impacts[o]!, ang = w.impacts[o + 1]!, sz = w.impacts[o + 2]!;
        if (p < 0 || p >= w.count) continue;
        // Del golpe en el plano a la superficie que gira: se deshace el giro de ese momento. Un poco fuera del ecuador.
        const t = -ctx.time * spinOf[p]!, lat = (((n * 0.618034) % 1) - 0.5) * 0.5;
        const dx = Math.cos(ang), dz = -Math.sin(ang), cl = Math.cos(lat);
        const ox = (dx * Math.cos(t) + dz * Math.sin(t)) * cl, oz = (-dx * Math.sin(t) + dz * Math.cos(t)) * cl, oy = Math.sin(lat);
        const k = (p * SLOTS + (count[p]! % SLOTS)) * 4;
        craters[k] = ox; craters[k + 1] = oy; craters[k + 2] = oz;
        craters[k + 3] = (0.1 + 0.12 * sz) * Math.min(1.6, 3.5 / Math.max(w.radius[p], 1)) ;   // más grande el golpe del bólido; en planetas chicos se ve más
        count[p] = count[p]! + 1;
      }
      seen = w.impactCount;
      frustum.setFromProjectionMatrix(projView.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse));
      let used = 0;
      const P = w.planets;
      for (let s = 0; s < P.length && used < MAX; s++) {
        const p = P[s]!;
        if (w.state[p] === DEAD || (w.broken[p]! > 0 && w.kind[p] !== KIND_GAS)) continue;
        const hp = planetHp(w, p), dmg = hp > 0 ? Math.min(1, w.planetDmg[p]! / hp) : 0;
        if (count[p] === 0 && dmg <= 0) continue;
        const x = w.prevX[p] + (w.x[p] - w.prevX[p]) * a, y = w.prevY[p] + (w.y[p] - w.prevY[p]) * a, r = w.radius[p];
        pos.set(x, 0, -y);
        bound.center.copy(pos); bound.radius = r * 1.1;
        if (!frustum.intersectsSphere(bound)) continue;
        q.setFromAxisAngle(yAxis, ctx.time * spinOf[p]!);
        scl.setScalar(r * 1.004);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(used, m4);
        for (let k = 0; k < SLOTS; k++) {
          const src = (p * SLOTS + k) * 4, arr = cAttr[k]!.array as Float32Array;
          arr[used * 4] = craters[src]!; arr[used * 4 + 1] = craters[src + 1]!; arr[used * 4 + 2] = craters[src + 2]!; arr[used * 4 + 3] = craters[src + 3]!;
        }
        const solid = w.kind[p] === KIND_ROCKY || w.kind[p] === KIND_ICE;
        const ia = info.array as Float32Array;
        ia[used * 3] = solid ? dmg : 0; ia[used * 3 + 1] = w.kind[p] === KIND_GAS ? 1 : 0; ia[used * 3 + 2] = (p * 0.618034) % 1;
        used++;
      }
      mesh.count = used;
      mesh.instanceMatrix.needsUpdate = true;
      for (let k = 0; k < SLOTS; k++) cAttr[k]!.needsUpdate = true;
      info.needsUpdate = true;
    },
  };
}
