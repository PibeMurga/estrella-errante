import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { BOLT, GATHERING } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// El bólido: los asteroides que se juntan levantan una nube de polvo fino que la estrella ilumina.
// Mientras se carga, la nube crece y se aprieta; en vuelo, se estira detrás como una estela.
// Se dibuja una sola lámina aditiva en el centro del montón (sin tocar la capa de asteroides).

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

export function createBoltLayer(): Layer {
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  let amount = 0;

  return {
    object: mesh,
    update(ctx) {
      const w = ctx.world, a = ctx.alpha;
      let n = 0, sx = 0, sy = 0, vx = 0, vy = 0, flying = 0;
      for (let i = 0; i < w.count; i++) {
        const st = w.state[i];
        if (st !== GATHERING && st !== BOLT) continue;
        n++;
        sx += w.prevX[i] + (w.x[i] - w.prevX[i]) * a;
        sy += w.prevY[i] + (w.y[i] - w.prevY[i]) * a;
        if (st === BOLT) { flying++; vx += w.vx[i]; vy += w.vy[i]; }
      }
      // Aparece y se apaga de a poco.
      const target = n > 0 ? Math.min(1, 0.35 + n / 12) : 0;
      amount += (target - amount) * Math.min(1, ctx.dt * 6);
      mesh.visible = amount > 0.01 && n > 0;
      if (!mesh.visible) return;
      const cx = sx / n, cy = sy / n;
      mesh.position.set(cx, 0.3, -cy);
      const size = 2.4 + Math.sqrt(n) * 1.2;
      mesh.scale.set(size * (flying > 0 ? 2.2 : 1), size, 1);   // en vuelo, la nube se estira como una estela
      mesh.quaternion.copy(ctx.camera.quaternion);
      // En vuelo, la lámina gira para que la estela quede detrás del movimiento (en pantalla, aproximado sobre el plano).
      if (flying > 0) mesh.rotateZ(Math.atan2(vy, vx));
      mat.uniforms['uTime']!.value = ctx.time;
      mat.uniforms['uAmount']!.value = amount;
    },
  };
}
