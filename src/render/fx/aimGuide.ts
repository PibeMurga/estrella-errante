import { AdditiveBlending, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { starSize } from '../../sim/world';
import type { Layer } from '../layer';

// Mira de disparo: mientras mantenés el clic derecho, una línea punteada que corre desde tu cuerpo hacia donde apuntás y
// un anillo en la punta que se llena según lo que cargaste. Fósforo del visor, aditivo.

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const LINE = /* glsl */ `uniform float uT; uniform float uA; uniform float uLen; varying vec2 vUv;
void main(){
  float along = vUv.x * uLen, across = abs(vUv.y - .5) * 2.;
  float dash = smoothstep(.35, .5, fract(along / 3. - uT * 1.6)) * (1. - smoothstep(.5, .65, fract(along / 3. - uT * 1.6)));
  float core = 1. - smoothstep(.2, 1., across);
  float fade = smoothstep(0., .08, vUv.x) * (1. - smoothstep(.85, 1., vUv.x));
  gl_FragColor = vec4(vec3(.48, .96, .79) * (dash * .9 + .15) * core * fade * uA, 1.);
}`;
const RING = /* glsl */ `uniform float uA; uniform float uFill; uniform float uT; varying vec2 vUv;
void main(){
  vec2 d = vUv*2. - 1.; float r = length(d), a = atan(d.y, d.x) / 6.2832 + .5;
  float ring = exp(-pow((r - .8)/.06, 2.));
  float filled = step(a, uFill);
  float tick = .25 + .75*filled;
  float dot = exp(-r*r*40.) * .8;
  gl_FragColor = vec4(vec3(.48, .96, .79) * (ring * tick + dot) * uA * (.85 + .15*sin(uT*8.)), 1.);
}`;

export function createAimGuideLayer(): Layer {
  const group = new Group();
  const lineMat = new ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uLen: { value: 40 } }, vertexShader: VERT, fragmentShader: LINE, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending });
  const ringMat = new ShaderMaterial({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uFill: { value: 0 } }, vertexShader: VERT, fragmentShader: RING, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending });
  const geo = new PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); geo.translate(0.5, 0, 0);   // el largo sobre x, desde el origen
  const line = new Mesh(geo, lineMat);
  const ring = new Mesh(new PlaneGeometry(2, 2), ringMat);
  line.frustumCulled = ring.frustumCulled = false; line.renderOrder = ring.renderOrder = 12;
  group.add(line, ring);
  let alpha = 0;

  return {
    object: group,
    update(ctx) {
      const w = ctx.world;
      const holding = w.charge > 0 && w.ignited && w.over === 0;
      alpha += ((holding ? 1 : 0) - alpha) * Math.min(1, ctx.dt * 10);
      group.visible = alpha > 0.02;
      if (!group.visible) return;
      const size = starSize(w.star.mass), ang = w.boltAngle;
      const len = 30 + size * 2.5 + w.gathered * 1.2;
      const x0 = ctx.starX + Math.cos(ang) * size * 1.15, y0 = ctx.starY + Math.sin(ang) * size * 1.15;
      line.position.set(x0, 0.7, -y0);
      line.rotation.set(0, ang, 0);
      line.scale.set(len, 1, 0.9 + size * 0.04);
      lineMat.uniforms['uT']!.value = ctx.time; lineMat.uniforms['uA']!.value = alpha; lineMat.uniforms['uLen']!.value = len;
      const tx = x0 + Math.cos(ang) * len, ty = y0 + Math.sin(ang) * len;
      ring.position.set(tx, 0.8, -ty);
      ring.quaternion.copy(ctx.camera.quaternion);
      ring.scale.setScalar(3 + size * 0.15);
      const max = w.config.boltMax;
      ringMat.uniforms['uFill']!.value = Math.min(1, w.gathered / max);
      ringMat.uniforms['uA']!.value = alpha; ringMat.uniforms['uT']!.value = ctx.time;
    },
  };
}
