import { type BufferAttribute, type BufferGeometry, Color, Frustum, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Sphere, Vector3 } from 'three';
import type { Rng } from '../../sim/rng';
import { DEAD, GATHERING, KIND_ASTEROID, ORBITING, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Rocas: cuatro formas distintas, como los asteroides fotografiados de cerca (Itokawa, Eros, Bennu): bultos grandes y
// desparejos, caras de fractura planas donde se partieron (cortes con planos al azar), cráteres con borde y proporciones
// alargadas. La deformación depende sólo de la posición, así los vértices repetidos no se separan. Las normales se
// promedian entre las caras que comparten un vértice: aristas de roca marcadas pero sin facetas de origami.
const h3 = (x: number, y: number, z: number, k: number): number => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 11.13) * 43758.5453; return v - Math.floor(v); };
function lumps(x: number, y: number, z: number, k: number): number {
  // Suma de senos rotados: barata y sin costuras, con aspecto de ruido.
  return Math.sin(x * 1.7 + k) * Math.cos(y * 2.3 - k * 0.7) * 0.5 + Math.sin(y * 1.9 + z * 1.3 + k * 1.3) * 0.3 + Math.cos(z * 2.1 - x * 1.1 + k * 2.1) * 0.2;
}
export function createRockGeometry(variant = 0): BufferGeometry {
  const g = new IcosahedronGeometry(1, 3);
  const p = g.attributes['position'] as BufferAttribute;
  const k = variant * 3.7 + 1.3;
  const dir = (a: number, b: number): [number, number, number] => {
    const u = h3(a, b, 2, k) * 2 - 1, th = h3(a, b, 4, k) * Math.PI * 2, sq = Math.sqrt(1 - u * u);
    return [Math.cos(th) * sq, u, Math.sin(th) * sq];
  };
  // Fracturas: 3 a 5 planos que rebanan la roca (caras planas y aristas).
  const cuts: [number, number, number, number][] = [];
  const nCuts = 3 + (variant % 3);
  for (let c = 0; c < nCuts; c++) { const [a, b, cc] = dir(c, 11); cuts.push([a, b, cc, 0.5 + h3(c, 12, 3, k) * 0.32]); }
  // Cráteres: cuencas hundidas con borde levantado.
  const craters: [number, number, number, number][] = [];
  for (let c = 0; c < 6; c++) { const [a, b, cc] = dir(c, 1); craters.push([a, b, cc, 0.2 + h3(c, 5, 6, k) * 0.3]); }
  const sx = 1.05 + 0.4 * h3(7, 7, 7, k), sy = 0.6 + 0.25 * h3(8, 8, 8, k), sz = 0.75 + 0.3 * h3(9, 9, 9, k);
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i);
    let d = 1 + 0.32 * lumps(x0 * 1.1, y0 * 1.1, z0 * 1.1, k) + 0.1 * lumps(x0 * 2.7, y0 * 2.7, z0 * 2.7, k + 5);
    for (const [cx, cy, cz, cr] of craters) {
      const t = Math.hypot(x0 - cx, y0 - cy, z0 - cz) / cr;
      if (t < 1.4) d += t < 1 ? -0.3 * cr * (1 - t * t) : 0.07 * cr * (1 - (t - 1) / 0.4);
    }
    let x = x0 * d, y = y0 * d, z = z0 * d;
    for (const [nx, ny, nz, o] of cuts) {
      const h = x * nx + y * ny + z * nz;
      if (h > o) { const e = h - o; x -= nx * e; y -= ny * e; z -= nz * e; }
    }
    p.setXYZ(i, x * sx, y * sy, z * sz);
  }
  // Normales promediadas por posición (la geometría viene con los vértices repetidos por cara).
  g.computeVertexNormals();
  const nrm = g.attributes['normal'] as BufferAttribute;
  const acc = new Map<string, [number, number, number]>();
  const key = (i: number): string => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  for (let i = 0; i < p.count; i++) {
    const kk = key(i), a = acc.get(kk) ?? [0, 0, 0];
    a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i); acc.set(kk, a);
  }
  for (let i = 0; i < p.count; i++) {
    const a = acc.get(key(i))!, l = Math.hypot(a[0], a[1], a[2]) || 1;
    nrm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  return g;
}

// Material de roca: manchas grandes de distinto tono (regolito más claro y más oscuro) y rugosidad pareja, en el espacio
// del objeto (acompañan al asteroide cuando gira). Nada de grano fino: a esta distancia se ve como ruido.
function rockMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.97, metalness: 0.02 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vRockP;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vRockP = position;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vRockP;
` + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float rs = snoise(vRockP * 1.6 + 7.) * .5 + .5, rm = snoise(vRockP * 3.4 + 2.) * .5 + .5;
      diffuseColor.rgb *= .72 + .4 * rs + .12 * (rm - .5);`);
  };
  return m;
}

const m4 = new Matrix4();
const q = new Quaternion();
const pos = new Vector3();
const scl = new Vector3();
const axis = new Vector3();
const tint = new Color();
const frustum = new Frustum();
const projView = new Matrix4();
const bound = new Sphere();

export function createAsteroidLayer(world: World, rng: Rng): Layer {
  let n = 0;
  for (let i = 0; i < world.count; i++) if (world.kind[i] === KIND_ASTEROID) n++;
  const indices = new Int32Array(n);
  let k = 0;
  for (let i = 0; i < world.count; i++) if (world.kind[i] === KIND_ASTEROID) indices[k++] = i;

  const VAR = 4, mat = rockMaterial();
  const meshes: InstancedMesh[] = [];
  const group = new Group();
  for (let g = 0; g < VAR; g++) {
    const mm = new InstancedMesh(createRockGeometry(g), mat, Math.max(1, Math.ceil(n / VAR) + 1));
    mm.count = 0; mm.frustumCulled = false;
    meshes.push(mm); group.add(mm);
  }
  const vCount = new Int32Array(VAR);
  const axes = new Float32Array(n * 3);
  const spin = new Float32Array(n);
  const lift = new Float32Array(n);
  const tints = new Float32Array(n * 3);
  const litS = new Float32Array(n).fill(1);
  const depthS = new Float32Array(n).fill(4);
  for (let s = 0; s < n; s++) {
    // Colores de rocas reales: la mayoría oscuras y pardas, y algunas distintas (gris claro, óxido, crema, hielo sucio).
    const b = 0.16 + rng.next() * 0.18, w = rng.next() * 0.04, kind = rng.next();
    if (kind < 0.6) tint.setRGB(b + w, b, b - w * 0.6);                              // carbonosa: oscura, parda
    else if (kind < 0.75) tint.setRGB(b * 1.25 + 0.04, b * 0.95, b * 0.7);          // parda más cálida
    else if (kind < 0.86) tint.setRGB(b * 1.4, b * 1.38, b * 1.34);                 // gris claro (silicato)
    else if (kind < 0.93) tint.setRGB(b * 1.55 + 0.05, b * 0.75, b * 0.5);          // rojiza, con óxido de hierro
    else if (kind < 0.97) tint.setRGB(b * 1.9 + 0.06, b * 1.75 + 0.05, b * 1.4);    // crema clara
    else tint.setRGB(b * 1.3, b * 1.45, b * 1.75 + 0.04);                            // gris azulado (hielo sucio)
    tints[s * 3] = tint.r; tints[s * 3 + 1] = tint.g; tints[s * 3 + 2] = tint.b;
    axis.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
    axes[s * 3] = axis.x; axes[s * 3 + 1] = axis.y; axes[s * 3 + 2] = axis.z;
    spin[s] = rng.range(0.2, 1.5);
    lift[s] = rng.range(-0.8, 0.8);
  }

  return {
    object: group,
    update(ctx) {
      const w = ctx.world, a = ctx.alpha;
      frustum.setFromProjectionMatrix(projView.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse));
      vCount.fill(0);
      for (let s = 0; s < n; s++) {
        const i = indices[s]!;
        if (w.state[i] === DEAD) continue;   // tragado
        // Profundidad sutil: los sueltos flotan a distintas alturas; en tu órbita se acomodan de a poco a tu plano.
        const inOrbit = w.state[i] === ORBITING || w.state[i] === GATHERING;
        depthS[s] = depthS[s]! + ((inOrbit ? 1 : 4) - depthS[s]!) * Math.min(1, ctx.dt * 0.8);
        pos.set(w.prevX[i] + (w.x[i] - w.prevX[i]) * a, lift[s]! * depthS[s]!, -(w.prevY[i] + (w.y[i] - w.prevY[i]) * a));
        bound.center.copy(pos); bound.radius = w.radius[i] * 1.3;
        if (!frustum.intersectsSphere(bound)) continue;   // fuera de cuadro: no se dibuja
        axis.set(axes[s * 3]!, axes[s * 3 + 1]!, axes[s * 3 + 2]!);
        q.setFromAxisAngle(axis, ctx.time * spin[s]! + s);
        scl.setScalar(w.radius[i]);
        m4.compose(pos, q, scl);
        const mesh = meshes[s % VAR]!, v = vCount[s % VAR]!;
        mesh.setMatrixAt(v, m4);
        // Lo que gira a tu alrededor está más cerca de tu estrella: se ve más iluminado.
        // (de a poco: nada de cambios de luz repentinos)
        const want = w.state[i] === ORBITING || w.state[i] === GATHERING ? 1.35 : 1;
        litS[s] = litS[s]! + (want - litS[s]!) * Math.min(1, ctx.dt * 1.5);
        const lit = litS[s]!;
        tint.setRGB(tints[s * 3]! * lit, tints[s * 3 + 1]! * lit, tints[s * 3 + 2]! * lit);
        mesh.setColorAt(v, tint);
        vCount[s % VAR] = v + 1;
      }
      for (let g = 0; g < VAR; g++) {
        const mesh = meshes[g]!;
        mesh.count = vCount[g]!;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
