import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Choque entre planetas: un destello blanco breve, una bola de roca vaporizada que se expande y se enfría
// (de blanco a naranja y a rojo oscuro) y una onda de choque tenue que se aleja. Aditivo, para que lo tome el bloom.
// Mide el tiempo en segundos y las distancias en radios de planeta (la mitad de la suma de los dos radios).

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv*2. - 1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FRAG = /* glsl */ `uniform float uT; uniform float uSeed; varying vec2 vUv;
void main(){
  vec2 q = vUv * 9.;                 // el cuadro mide 18 radios de planeta de lado
  float r = length(q);
  float t = uT;
  // Destello: muy breve, muy brillante.
  float flash = exp(-t*9.) * exp(-r*r*.6) * 6.;
  // Bola de fuego: crece rápido y frena; el borde es turbulento.
  float R = 1. + 1.6*(1. - exp(-t*1.4));
  float n = fbm(vec3(q*.9, uSeed + t*.35), 4);
  float body = 1. - smoothstep(R*.55, R*(1.05 + .25*n), r);
  float cool = exp(-t/1.6);
  vec3 hot = mix(vec3(.55,.08,.02), mix(vec3(1.6,.55,.12), vec3(2.4,2.1,1.7), cool*cool), cool);
  vec3 fire = hot * body * (.55 + .6*(n*.5+.5)) * (.08 + 1.3*cool) * 1.6/(R*R);   // se diluye al expandirse
  // Onda de choque: un anillo fino que se aleja y se apaga.
  float S = 1. + 4.*t;
  float shock = exp(-(r - S)*(r - S)*6.) * exp(-t*1.4) * smoothstep(0., .15, t) * (1. - smoothstep(6., 8.5, S)) * .4;
  float fade = 1. - smoothstep(4., 6., t);
  gl_FragColor = vec4((vec3(flash) * vec3(1., .9, .8) + fire + shock*vec3(1., .7, .45)) * fade, 1.);
}`;

const SPAN = 9;   // medio lado del cuadro, en radios de planeta

export function createImpactLayer(): Layer {
  const mat = new ShaderMaterial({
    uniforms: { uT: { value: 99 }, uSeed: { value: 0 } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 10;
  let seen = 0, start = 0;

  return {
    object: mesh,
    update(ctx) {
      const w = ctx.world;
      if (w.planetCrashes < seen) seen = w.planetCrashes;   // mundo nuevo
      if (w.planetCrashes > seen) {
        seen = w.planetCrashes;
        start = ctx.time;
        mat.uniforms['uSeed']!.value = (seen * 7.31) % 50;
        mesh.position.set(w.crashX, 0.5, -w.crashY);
        mesh.scale.setScalar(w.crashR * 0.5 * SPAN);
      }
      const t = ctx.time - start;
      mesh.visible = seen > 0 && t < 6;
      if (!mesh.visible) return;
      mat.uniforms['uT']!.value = t;
      mesh.quaternion.copy(ctx.camera.quaternion);   // siempre de frente a la cámara
    },
  };
}
