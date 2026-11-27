import { AdditiveBlending, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { BOLT, GATHERING, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// El bólido: los asteroides que se juntan levantan una nube de polvo fino que la estrella ilumina.
// El montón que se está cargando y el bólido en vuelo tienen cada uno su nube (pueden existir los dos a la vez);
// la del vuelo se estira como una estela. Láminas aditivas, sin tocar la capa de asteroides.

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv*2. - 1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FRAG = /* glsl */ `uniform float uTime; uniform float uAmount; varying vec2 vUv;
void main(){
  float r = length(vUv);
  float n = fbm(vec3(vUv*3.2, uTime*.6), 4)*.5+.5;
  float edge = 1. - smoothstep(.55, 1., r);       // se apaga antes del borde de la lámina: nada de cantos
  float dust = exp(-r*r*7.) * (.45 + .8*n);
  float core = exp(-r*r*40.) * .35;
  vec3 col = vec3(1., .74, .46) * dust * .28 + vec3(1., .86, .66) * core;
  gl_FragColor = vec4(col * uAmount * edge, 1.);
}`;

export interface BoltCentroid { x: number; y: number; vx: number; vy: number }

// Centro (interpolado) y velocidad media de los cuerpos en un estado. Devuelve cuántos son.
export function boltCentroid(w: World, state: number, alpha: number, out: BoltCentroid): number {
  let n = 0, sx = 0, sy = 0, vx = 0, vy = 0;
  for (let i = 0; i < w.count; i++) {
    if (w.state[i] !== state) continue;
    n++;
    sx += w.prevX[i] + (w.x[i] - w.prevX[i]) * alpha;
    sy += w.prevY[i] + (w.y[i] - w.prevY[i]) * alpha;
    vx += w.vx[i]; vy += w.vy[i];
  }
  if (n > 0) { out.x = sx / n; out.y = sy / n; out.vx = vx / n; out.vy = vy / n; }
  return n;
}

export function createBoltLayer(): Layer {
  const group = new Group();
  const geo = new PlaneGeometry(2, 2);
  const make = (): { mesh: Mesh; mat: ShaderMaterial; amount: number; c: BoltCentroid } => {
    const mat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.visible = false;
    group.add(mesh);
    return { mesh, mat, amount: 0, c: { x: 0, y: 0, vx: 0, vy: 0 } };
  };
  const clouds = [make(), make()];
  const states = [GATHERING, BOLT];

  return {
    object: group,
    update(ctx) {
      for (let k = 0; k < 2; k++) {
        const cl = clouds[k]!, flying = k === 1;
        const n = boltCentroid(ctx.world, states[k]!, ctx.alpha, cl.c);
        // Aparece de a poco; al quedar vacío se apaga en el último lugar donde estuvo.
        const target = n > 0 ? Math.min(1, 0.35 + n / 12) : 0;
        cl.amount += (target - cl.amount) * Math.min(1, ctx.dt * 6);
        cl.mesh.visible = cl.amount > 0.01;
        if (!cl.mesh.visible) continue;
        cl.mesh.position.set(cl.c.x, 0.3, -cl.c.y);
        const size = 2.4 + Math.sqrt(Math.max(n, 1)) * 1.2;
        cl.mesh.scale.set(size * (flying ? 2.2 : 1), size, 1);   // en vuelo, la nube se estira como una estela
        cl.mesh.quaternion.copy(ctx.camera.quaternion);
        if (flying) cl.mesh.rotateZ(Math.atan2(cl.c.vy, cl.c.vx));
        cl.mat.uniforms['uTime']!.value = ctx.time;
        cl.mat.uniforms['uAmount']!.value = cl.amount;
      }
    },
  };
}
