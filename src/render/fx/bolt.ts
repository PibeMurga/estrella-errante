import { AdditiveBlending, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { BOLT, GATHERING, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// El bólido: los asteroides que se juntan levantan una nube de polvo fino que la estrella ilumina.
// El montón que se está cargando y el bólido en vuelo tienen cada uno su nube (pueden existir los dos a la vez);
// la del vuelo se estira como una estela. Láminas aditivas, sin tocar la capa de asteroides.

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv*2. - 1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
// El polvo se revuelve (ruido deformado que gira y hierve), el núcleo titila con chispas y, en vuelo, la nube deja una
// estela que corre hacia atrás: nada queda quieto.
const FRAG = /* glsl */ `uniform float uTime; uniform float uAmount; uniform float uFly; varying vec2 vUv;
void main(){
  vec2 v = vUv;
  float r = length(v);
  float t = uTime;
  // Remolino: el polvo gira alrededor del centro y se deforma.
  float sw = 1.3*exp(-r*2.);
  vec2 q = vec2(v.x*cos(t*sw) - v.y*sin(t*sw), v.x*sin(t*sw) + v.y*cos(t*sw));
  vec3 P = vec3(q*3.2 + vec2(t*.9*uFly, 0.), t*1.1);
  P.xy += .45*vec2(snoise(P*1.3 + 4.), snoise(P*1.3 + 9.));
  float n = fbm(P, 4)*.5+.5;
  float edge = 1. - smoothstep(.55, 1., r);       // se apaga antes del borde de la lámina: nada de cantos
  // En vuelo, la nube se corre hacia atrás como una estela (el eje x local apunta hacia donde va).
  vec2 tv = v + vec2(.35*uFly, 0.);
  float tail = uFly * exp(-tv.y*tv.y*30.) * smoothstep(.2, -.8, v.x) * (.4 + .9*(fbm(vec3(v.x*6. + t*4., v.y*6., t), 3)*.5+.5));
  float dust = exp(-r*r*7.) * (.35 + 1.*n) + tail*.6;
  float flick = .75 + .25*sin(t*23. + n*6.) * sin(t*7.3);
  float sparks = smoothstep(.82, .95, snoise(vec3(v*14., t*3.))) * exp(-r*r*10.) * .8;
  float core = exp(-r*r*40.) * .35 * flick;
  vec3 col = vec3(1., .72, .44) * dust * .3 + vec3(1., .86, .66) * (core + sparks);
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
      uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uFly: { value: 0 } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
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
        cl.mat.uniforms['uFly']!.value = flying ? 1 : 0;
      }
    },
  };
}
