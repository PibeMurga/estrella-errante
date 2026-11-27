import { AdditiveBlending, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry } from 'three';
import { MAX_COMETS } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Cometa cazador: núcleo helado muy brillante y una cola de gas que se deshilacha en contra del movimiento.
const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const TAIL_FRAG = /* glsl */ `uniform float uTime; uniform float uHurt; uniform vec3 uTintA; uniform vec3 uTintB; uniform float uBright; varying vec2 vUv;
void main(){
  float along = vUv.x;                       // 0 en el núcleo, 1 en la punta de la cola
  float across = (vUv.y - .5) * 2.;
  float width = mix(.18, 1., pow(clamp(along, 0., 1.), .6));
  float n = fbm(vec3(along*6. - uTime*2.2, across*2.5, uTime*.3), 4) * .5 + .5;
  float body = exp(-(across/width)*(across/width) * 3.) * pow(clamp(1. - along, 0., 1.), 1.6);
  float strands = smoothstep(.35, .9, n) * body;
  vec3 col = mix(uTintA, uTintB, along);
  col = mix(col, vec3(1., .45, .3), uHurt);
  gl_FragColor = vec4(col * (body*.9 + strands*1.6) * 1.4 * uBright, 1.);
}`;

const CORE = new Color(2.2, 3.4, 4.2);   // por encima de 1: lo toma el bloom
const CORE_HURT = new Color(4.5, 2.2, 1.6);
const CORE_TINTS = [new Color(1.8, 3.6, 3.0), new Color(2.2, 3.4, 4.2), new Color(3.4, 3.5, 3.6), new Color(3.8, 3.3, 2.2)];
const TAIL_A = [new Color(.45, .95, .8), new Color(.55, .85, 1.), new Color(.85, .9, 1.), new Color(1., .85, .55)];
const TAIL_B = [new Color(.2, .55, .6), new Color(.25, .45, 1.), new Color(.45, .55, .85), new Color(.7, .5, .3)];

export function createCometsLayer(): Layer {
  const group = new Group();
  const coreGeo = new SphereGeometry(1, 16, 12);
  const tailGeo = new PlaneGeometry(1, 1, 8, 1);
  tailGeo.rotateX(-Math.PI / 2);
  tailGeo.translate(0.5, 0, 0);
  const cores: Mesh[] = [], tails: Mesh[] = [], coreMats: MeshBasicMaterial[] = [], tailMats: ShaderMaterial[] = [];
  const lastHp = new Float32Array(MAX_COMETS);
  const hurtT = new Float32Array(MAX_COMETS);
  for (let k = 0; k < MAX_COMETS; k++) {
    const cm = new MeshBasicMaterial({ color: CORE.clone() });
    const core = new Mesh(coreGeo, cm);
    const tm = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHurt: { value: 0 }, uTintA: { value: new Color() }, uTintB: { value: new Color() }, uBright: { value: 1 } }, vertexShader: VERT, fragmentShader: NOISE_GLSL + TAIL_FRAG,
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    });
    const tail = new Mesh(tailGeo, tm);
    core.visible = tail.visible = false;
    core.frustumCulled = tail.frustumCulled = false;
    group.add(tail, core);
    cores.push(core); tails.push(tail); coreMats.push(cm); tailMats.push(tm);
  }

  return {
    object: group,
    update(ctx) {
      const c = ctx.world.comets, a = ctx.alpha;
      for (let k = 0; k < MAX_COMETS; k++) {
        const on = c.mode[k] !== 0;
        cores[k]!.visible = tails[k]!.visible = on;
        if (!on) { lastHp[k] = 0; continue; }
        // Destello rojizo al recibir daño.
        if (lastHp[k]! > 0 && c.hp[k]! < lastHp[k]!) hurtT[k] = 1;
        lastHp[k] = c.hp[k]!;
        hurtT[k] = Math.max(0, hurtT[k]! - ctx.dt * 2.5);
        const x = c.prevX[k]! + (c.x[k]! - c.prevX[k]!) * a;
        const y = c.prevY[k]! + (c.y[k]! - c.prevY[k]!) * a;
        const flicker = 1 + 0.12 * Math.sin(ctx.time * 23 + k * 7);
        cores[k]!.position.set(x, 0.4, -y);
        const sz = c.size[k]!, tn = c.tint[k]!, br = c.bright[k]!;
        cores[k]!.scale.setScalar(ctx.world.config.cometRadius * 0.45 * flicker * (0.7 + 0.5 * sz));
        // Colores de cometas reales: verde azulado (carbono), azul (iones), blanco y alguno más amarillento (polvo).
        const ti = tn < 0.3 ? 0 : tn < 0.6 ? 1 : tn < 0.85 ? 2 : 3;
        coreMats[k]!.color.copy(CORE_TINTS[ti]!).multiplyScalar(br).lerp(CORE_HURT, hurtT[k]!);
        (tailMats[k]!.uniforms['uTintA']!.value as Color).copy(TAIL_A[ti]!);
        (tailMats[k]!.uniforms['uTintB']!.value as Color).copy(TAIL_B[ti]!);
        tailMats[k]!.uniforms['uBright']!.value = br;
        tails[k]!.position.set(x, 0.35, -y);
        tails[k]!.rotation.y = Math.atan2(-c.vy[k]!, -c.vx[k]!);   // la cola apunta en contra del movimiento
        tails[k]!.scale.set(14 + 14 * sz * br, 1, 4 + 3 * sz);
        tailMats[k]!.uniforms['uTime']!.value = ctx.time + k * 3.1;
        tailMats[k]!.uniforms['uHurt']!.value = hurtT[k]!;
      }
    },
  };
}
