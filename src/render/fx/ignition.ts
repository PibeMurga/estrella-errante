import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { PHASE_IGNITION } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Ignición: a los 1,2 s de la cinemática, un destello breve y blanco cálido (sin rayos) y una onda de gas irregular que
// se abre hasta unas 25 unidades (la misma que en la simulación empuja lo suelto) y se disipa. Más contenida que el colapso. Aditivo, lo toma el bloom.

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv*2. - 1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FRAG = /* glsl */ `uniform float uT; varying vec2 vUv;
void main(){
  vec2 q = vUv * 30.;                 // en unidades del mundo (el cuadro mide 60 de lado)
  float r = length(q), t = uT, a = atan(q.y, q.x);
  float flash = exp(-t*6.) * exp(-r*r/(12. + 60.*t)) * 1.4;   // contenido: el gran estallido es el del colapso
  float S = 4. + 21.*(1. - exp(-t*1.5));
  float wob = 2.5*fbm(vec3(cos(a)*2., sin(a)*2., t*.4), 3);
  float n = fbm(vec3(q*.08, t*.3), 3)*.5+.5;
  float wave = exp(-pow((r - S - wob)/(2. + 3.*n), 2.)) * exp(-t*1.2) * (.35 + .65*n) * .3;
  float inner = (1. - smoothstep(0., S, r)) * exp(-t*2.) * .15 * n;
  vec3 col = vec3(1., .9, .78)*flash + vec3(1., .55, .25)*wave + vec3(1., .42, .18)*inner;
  gl_FragColor = vec4(col * (1. - smoothstep(.85, 1., length(vUv))), 1.);
}`;

export function createIgnitionLayer(): Layer {
  const mat = new ShaderMaterial({
    uniforms: { uT: { value: 0 } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 11;
  mesh.scale.setScalar(30);
  let start = -1, wasIgniting = false;

  return {
    object: mesh,
    update(ctx) {
      const w = ctx.world, igniting = w.phase === PHASE_IGNITION;
      if (igniting && !wasIgniting) start = ctx.time - w.phaseTime;   // por si la página arrancó a mitad de la cinemática
      wasIgniting = igniting;
      const t = ctx.time - start - 1.2;
      mesh.visible = start >= 0 && t >= 0 && t < 3;
      if (!mesh.visible) return;
      mesh.position.set(ctx.starX, 0.6, -ctx.starY);
      mesh.quaternion.copy(ctx.camera.quaternion);
      mat.uniforms['uT']!.value = t;
    },
  };
}
