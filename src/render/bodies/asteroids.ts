import { type BufferAttribute, type BufferGeometry, Color, Frustum, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Sphere, Vector3 } from 'three';
import type { Rng } from '../../sim/rng';
import { DEAD, GATHERING, KIND_ASTEROID, ORBITING, type World } from '../../sim/world';
import type { Layer } from '../layer';

// Roca irregular: la deformación depende sólo de la posición, así los vértices repetidos no se separan.
export function createRockGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(1, 2);
  const p = g.attributes['position'] as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1
      + 0.22 * Math.sin(3.1 * x + 1.7) * Math.cos(2.3 * y + 0.4)
      + 0.14 * Math.sin(5.3 * z + 2.2 + 1.9 * x)
      + 0.06 * Math.sin(11 * (x + y));
    p.setXYZ(i, x * d, y * d * 0.8, z * d);
  }
  g.computeVertexNormals();
  return g;
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

  const mesh = new InstancedMesh(createRockGeometry(), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.05, flatShading: true }), Math.max(1, n));
  mesh.count = n;
  mesh.frustumCulled = false;
  const axes = new Float32Array(n * 3);
  const spin = new Float32Array(n);
  const lift = new Float32Array(n);
  const tints = new Float32Array(n * 3);
  for (let s = 0; s < n; s++) {
    const b = 0.16 + rng.next() * 0.18, w = rng.next() * 0.04;
    tint.setRGB(b + w, b, b - w * 0.6);
    tints[s * 3] = tint.r; tints[s * 3 + 1] = tint.g; tints[s * 3 + 2] = tint.b;
    axis.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
    axes[s * 3] = axis.x; axes[s * 3 + 1] = axis.y; axes[s * 3 + 2] = axis.z;
    spin[s] = rng.range(0.2, 1.5);
    lift[s] = rng.range(-0.8, 0.8);
  }

  return {
    object: mesh,
    update(ctx) {
      const w = ctx.world, a = ctx.alpha;
      frustum.setFromProjectionMatrix(projView.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse));
      let v = 0;
      for (let s = 0; s < n; s++) {
        const i = indices[s]!;
        if (w.state[i] === DEAD) continue;   // tragado
        pos.set(w.prevX[i] + (w.x[i] - w.prevX[i]) * a, lift[s]!, -(w.prevY[i] + (w.y[i] - w.prevY[i]) * a));
        bound.center.copy(pos); bound.radius = w.radius[i] * 1.3;
        if (!frustum.intersectsSphere(bound)) continue;   // fuera de cuadro: no se dibuja
        axis.set(axes[s * 3]!, axes[s * 3 + 1]!, axes[s * 3 + 2]!);
        q.setFromAxisAngle(axis, ctx.time * spin[s]! + s);
        scl.setScalar(w.radius[i]);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(v, m4);
        // Lo que gira a tu alrededor está más cerca de tu estrella: se ve más iluminado.
        const lit = w.state[i] === ORBITING || w.state[i] === GATHERING ? 1.35 : 1;
        tint.setRGB(tints[s * 3]! * lit, tints[s * 3 + 1]! * lit, tints[s * 3 + 2]! * lit);
        mesh.setColorAt(v, tint);
        v++;
      }
      mesh.count = v;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
