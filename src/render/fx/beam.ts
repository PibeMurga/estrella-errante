import { AdditiveBlending, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import type { Layer } from '../layer';

// Rayo del eclipse: un haz de luz cálida desde la estrella en la dirección de la alineación. Aditivo, para que lo tome el bloom.
const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FRAG = /* glsl */ `uniform float uFade; uniform float uTime; varying vec2 vUv;
void main(){
  float across = (vUv.y - .5) * 2.;
  float core = exp(-across*across*28.);
  float glow = exp(-across*across*4.) * .35;
  float along = pow(clamp(1. - vUv.x, 0., 1.), .7) * smoothstep(0., .03, vUv.x);
  float flicker = .85 + .15 * sin(uTime*40. + vUv.x*30.);
  vec3 col = mix(vec3(1., .55, .22), vec3(1., .93, .8), core);
  gl_FragColor = vec4(col * (core*3.2 + glow) * along * flicker * uFade, 1.);
}`;

export function createBeamLayer(): Layer {
  const geo = new PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);   // acostado sobre el plano de juego
  geo.translate(0.5, 0, 0);    // empieza en la estrella
  const mat = new ShaderMaterial({
    uniforms: { uFade: { value: 0 }, uTime: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;

  return {
    object: mesh,
    update(ctx) {
      const w = ctx.world, c = w.config;
      mesh.visible = w.beamTime > 0;
      if (!mesh.visible) return;
      const t = w.beamTime / c.beamDuration;           // 1 al aparecer, 0 al apagarse
      mat.uniforms['uFade']!.value = Math.min(1, t * 3) * Math.sqrt(t);
      mat.uniforms['uTime']!.value = ctx.time;
      mesh.position.set(ctx.starX, 0.3, -ctx.starY);
      mesh.rotation.y = w.eclipseAngle;                 // sim (cos, sin) → 3D (cos, 0, -sin)
      mesh.scale.set(c.beamLength, 1, 2.2 + w.eclipseStrength * 0.35);
    },
  };
}
