import { type BufferAttribute, type BufferGeometry, Color, Frustum, Group, Float32BufferAttribute, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Sphere, Vector3 } from 'three';
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
  // Familias 8 a 15: rugosas, muy irregulares y llenas de cráteres (más detalle de malla para que se vean). Son más
  // de la mitad: así son la mayoría de los asteroides reales.
  const fam = variant % 16, rough = fam >= 8;
  const g = new IcosahedronGeometry(1, rough ? 4 : 3);
  const p = g.attributes['position'] as BufferAttribute;
  const k = variant * 3.7 + 1.3;
  const dir = (a: number, b: number): [number, number, number] => {
    const u = h3(a, b, 2, k) * 2 - 1, th = h3(a, b, 4, k) * Math.PI * 2, sq = Math.sqrt(1 - u * u);
    return [Math.cos(th) * sq, u, Math.sin(th) * sq];
  };
  // Fracturas: 3 a 5 planos que rebanan la roca (caras planas y aristas).
  const cuts: [number, number, number, number][] = [];
  // Ocho familias de forma: anguladas (muchos cortes), redondeadas tipo Ceres, alargadas tipo Eros, bilobuladas (dos
  // rocas pegadas, como Arrokoth o Itokawa), montones de escombros con bultos chicos (Bennu) y fragmentos chatos.
  const nCuts = [5, 1, 3, 2, 3, 6, 2, 4, 2, 3, 4, 1, 5, 3, 2, 4][fam]!;
  const lumpA = [0.28, 0.14, 0.3, 0.26, 0.22, 0.2, 0.36, 0.24, 0.34, 0.4, 0.3, 0.42, 0.32, 0.38, 0.45, 0.35][fam]!;
  const rubble = fam === 4 ? 0.14 : fam === 6 ? 0.06 : rough ? 0.05 : 0.03;
  for (let c = 0; c < nCuts; c++) { const [a, b, cc] = dir(c, 11); cuts.push([a, b, cc, 0.5 + h3(c, 12, 3, k) * 0.32]); }
  // Cráteres: cuencas hundidas con borde levantado.
  const craters: [number, number, number, number][] = [];
  const nCr = rough ? 20 + (fam % 3) * 6 : 6;
  for (let c = 0; c < nCr; c++) {
    const [a, b, cc] = dir(c, 1), u = h3(c, 5, 6, k);
    craters.push([a, b, cc, rough ? (c < 3 ? 0.38 + u * 0.2 : 0.1 + u * u * 0.32) : 0.2 + u * 0.3]);   // tres grandes y muchos chicos   // en las rugosas: muchos chicos y pocos grandes
  }
  const crDepth = rough ? 0.8 : 0.35;
  let sx = 1.05 + 0.4 * h3(7, 7, 7, k), sy = 0.6 + 0.25 * h3(8, 8, 8, k), sz = 0.75 + 0.3 * h3(9, 9, 9, k);
  if (fam === 1) { sx = 1; sy = 0.92; sz = 0.96; }          // casi redonda
  if (fam === 2) { sx = 1.6; sy = 0.6; sz = 0.7; }          // alargada
  if (fam === 3) { sx = 1.55; sy = 0.75; sz = 0.8; }        // bilobulada
  if (fam === 5) { sx = 1.2; sy = 0.42; sz = 1.0; }         // fragmento chato
  if (fam === 10 || fam === 13) { sx = 1.5; sy = 0.62; sz = 0.72; }   // rugosas alargadas
  if (fam === 12) { sx = 1.35; sy = 0.5; sz = 0.95; }       // rugosa chata
  const shade = new Float32Array(p.count).fill(1);   // fondo de cráter más oscuro, borde más claro (color de vértice)
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i);
    let d = 1 + lumpA * lumps(x0 * 1.1, y0 * 1.1, z0 * 1.1, k) + 0.1 * lumps(x0 * 2.7, y0 * 2.7, z0 * 2.7, k + 5)
      + rubble * (lumps(x0 * 6.1, y0 * 6.1, z0 * 6.1, k + 2) + 0.6 * lumps(x0 * 9.7, y0 * 9.7, z0 * 9.7, k + 7));
    if (fam === 3 || fam === 14) d *= 1 - 0.3 * Math.exp(-x0 * x0 * 9);
    if (rough) d += 0.07 * (1 - Math.abs(lumps(x0 * 5.3, y0 * 5.3, z0 * 5.3, k + 4))) - 0.035 + 0.03 * lumps(x0 * 13, y0 * 13, z0 * 13, k + 6);   // crestas y aspereza
    for (const [cx, cy, cz, cr] of craters) {
      const t = Math.hypot(x0 - cx, y0 - cy, z0 - cz) / cr;
      if (t < 1.4) {
        d += t < 1 ? -crDepth * cr * (1 - t * t) : (rough ? 0.14 : 0.07) * cr * (1 - (t - 1) / 0.4);
        shade[i] = shade[i]! * (t < 0.85 ? 0.55 + 0.4 * t : t < 1.2 ? 1.2 : 1);
      }
    }
    let x = x0 * d, y = y0 * d, z = z0 * d;
    for (const [nx, ny, nz, o] of cuts) {
      const h = x * nx + y * ny + z * nz;
      if (h > o) { const e = h - o; x -= nx * e; y -= ny * e; z -= nz * e; }
    }
    p.setXYZ(i, x * sx, y * sy, z * sz);
  }
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = Math.min(1.3, Math.max(0.5, shade[i]!)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  // Cuánto se marcan los cráteres pintados en la superficie (las rugosas, mucho; las lisas, poco).
  g.setAttribute('aRough', new Float32BufferAttribute(new Float32Array(p.count).fill(rough ? 1 : 0.35), 1));
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

// Cráteres por celdas: cada celda tiene un punto al azar; cerca de él, un hoyo (más oscuro hacia el centro) con un
// borde más claro. Sólo depende de la posición en la roca: no titila ni hace ruido de píxeles.
const CRATER_GLSL = /* glsl */ `
vec3 crHash(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
float craterShade(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float s = 1.;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)), h = crHash(i + g);
    float r = .18 + .3 * h.x;
    if (h.y > .65) continue;                    // no todas las celdas tienen cráter
    float d = length(g + h * .8 + .1 - f) / r;
    if (d < 1.) s *= .55 + .45 * d * d;          // hoyo: oscuro al centro
    else if (d < 1.3) s *= 1. + .35 * (1. - (d - 1.) / .3);   // borde claro
  }
  return s;
}`;

// Material de roca: manchas grandes de distinto tono (regolito más claro y más oscuro) y rugosidad pareja, en el espacio
// del objeto (acompañan al asteroide cuando gira). Nada de grano fino: a esta distancia se ve como ruido.
function rockMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.97, metalness: 0.02, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vRockP; attribute float aSeed; varying float vSeed; attribute float aRough; varying float vRough;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vRockP = position; vSeed = aSeed; vRough = aRough;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vRockP; varying float vSeed; varying float vRough;
` + NOISE_GLSL + CRATER_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
      // Cada roca tiene su propia superficie (aSeed): manchas de otro mineral, cráteres frescos más claros, vetas
      // oscuras, una cara más clara que la otra (como Vesta o Iapetus) o un tono parejo.
      vec3 o = vRockP + vSeed * 37.;
      float rs = snoise(o * 1.6 + 7.) * .5 + .5, rm = snoise(o * 3.4 + 2.) * .5 + .5;
      float sty = fract(vSeed * 7.13);
      float shade = .72 + .4 * rs + .12 * (rm - .5);
      if (sty < .22) shade *= 1. + .55 * smoothstep(.72, .8, snoise(o * 2.2 + 11.) * .5 + .5);             // cráteres frescos, claros
      else if (sty < .42) shade *= 1. - .3 * smoothstep(.07, .0, abs(snoise(o * vec3(.7, 2.6, .9) + 5.)) - .03); // vetas oscuras
      else if (sty < .58) shade *= mix(.65, 1.25, smoothstep(-.35, .35, dot(normalize(vRockP), normalize(vec3(sin(vSeed*40.), .4, cos(vSeed*40.)))))); // dos caras
      else if (sty < .75) diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.35, 1.0, .72), smoothstep(.5, .75, rm) * .7);   // manchas de otro mineral
      diffuseColor.rgb *= shade;
      // Cráteres pintados: hoyo oscuro con borde claro, en dos tamaños. Se apagan cuando la roca se ve diminuta.
      float px = length(fwidth(vRockP));
      float fadeC = (1. - smoothstep(.06, .16, px)) * vRough;
      diffuseColor.rgb *= mix(1., craterShade(vRockP * 3.2 + vSeed * 11.), fadeC);
      diffuseColor.rgb *= mix(1., craterShade(vRockP * 7.5 + vSeed * 23.), fadeC * (1. - smoothstep(.03, .07, px)) * .8);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(.97, .6, step(.93, fract(vSeed * 3.71)));   // algunas metálicas (tipo M): más lisas y con brillo`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = mix(.02, .55, step(.93, fract(vSeed * 3.71)));`);
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

  const VAR = 16, mat = rockMaterial();
  const meshes: InstancedMesh[] = [];
  const seedAttrs: InstancedBufferAttribute[] = [];
  const group = new Group();
  for (let g = 0; g < VAR; g++) {
    const cap = Math.max(1, Math.ceil(n / VAR) + 1);
    const geo = createRockGeometry(g);
    const sa = new InstancedBufferAttribute(new Float32Array(cap), 1);
    geo.setAttribute('aSeed', sa);
    const mm = new InstancedMesh(geo, mat, cap);
    mm.count = 0; mm.frustumCulled = false;
    meshes.push(mm); seedAttrs.push(sa); group.add(mm);
  }
  const seeds = new Float32Array(n);
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
    seeds[s] = rng.next();
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
        seedAttrs[s % VAR]!.setX(v, seeds[s]!);
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
        seedAttrs[g]!.needsUpdate = true;
      }
    },
  };
}
