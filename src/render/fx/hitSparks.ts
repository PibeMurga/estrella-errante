import { AdditiveBlending, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { MAX_IMPACTS } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Golpe de un asteroide (honda o bólido) contra el terreno de un planeta: una pequeña explosión en el punto del
// impacto. Destello blanco muy breve, una bocanada de roca al rojo que se enfría a polvo, chispas que salen
// disparadas hacia afuera del planeta y un anillo de polvo que se abre a ras del suelo. Aditivo, lo toma el bloom.
// La explosión acompaña al planeta (se ancla a su superficie, en el ángulo del golpe).

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv*2. - 1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FRAG = /* glsl */ `uniform float uT; uniform float uSeed; uniform vec2 uOut; uniform vec3 uDust; varying vec2 vUv;
void main(){
  vec2 q = vUv * 4.;                       // el cuadro mide 8 unidades de explosión de lado
  float r = length(q), t = uT;
  // Destello: un parpadeo blanco.
  float flash = exp(-t*30.) * exp(-r*r*9.) * 4.;
  // Bocanada: roca vaporizada que crece, sale hacia afuera del planeta y se enfría a polvo.
  vec2 c = q - uOut * (.9*(1. - exp(-t*5.)));
  float R = .5 + 1.1*(1. - exp(-t*4.));
  float n = fbm(vec3(c*1.6, uSeed + t*.8), 4);
  float puff = 1. - smoothstep(R*.35, R*(1. + .35*n), length(c));
  float cool = exp(-t/.22);
  vec3 hot = mix(uDust*.5, mix(vec3(1.7,.6,.15), vec3(2.4,2.,1.6), cool), cool);
  vec3 fire = hot * puff * (.6 + .7*(n*.5+.5)) * (.3 + 2.2*cool) / (R*R*.9);
  // Chispas: trazos finos que salen en abanico hacia afuera del planeta y se apagan.
  float a = atan(q.y, q.x), along = dot(normalize(q + 1e-5), uOut);
  float ray = pow(max(0., snoise(vec3(a*7., uSeed, 0.)) ), 6.) * smoothstep(-.2, .6, along);
  float head = 3.4*(1. - exp(-t*3.5));
  float spark = ray * exp(-pow((r - head)/.3, 2.)) * exp(-t*3.) * 6.;
  // Anillo de polvo a ras del suelo.
  float S = .4 + 1.8*(1. - exp(-t*3.));
  float ring = exp(-pow((r - S)/.3, 2.)) * exp(-t*4.5) * .18 * smoothstep(-.3, .5, along) * (.6 + .8*(n*.5+.5));   // polvo hacia afuera, irregular
  float fade = 1. - smoothstep(.8, 1.2, t);
  vec3 col = vec3(1., .92, .8)*flash + fire + vec3(1.8,.8,.3)*spark + uDust*ring*2.;
  gl_FragColor = vec4(col * fade, 1.);
}`;

const LIFE = 1.2;
const SPAN = 4;   // medio lado del cuadro, en unidades de explosión

export interface HitSparksLayer extends Layer { readonly active: number }

export function createHitSparksLayer(): HitSparksLayer {
  const group = new Group();
  const geo = new PlaneGeometry(2, 2);
  const meshes: Mesh[] = [], mats: ShaderMaterial[] = [];
  const planet = new Int32Array(MAX_IMPACTS), angle = new Float32Array(MAX_IMPACTS), size = new Float32Array(MAX_IMPACTS), start = new Float32Array(MAX_IMPACTS).fill(-99);
  for (let k = 0; k < MAX_IMPACTS; k++) {
    const mat = new ShaderMaterial({
      uniforms: { uT: { value: 99 }, uSeed: { value: k * 3.7 }, uOut: { value: { x: 1, y: 0 } }, uDust: { value: { x: 0.6, y: 0.45, z: 0.32 } } },
      vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
      transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    });
    const m = new Mesh(geo, mat);
    m.frustumCulled = false; m.visible = false; m.renderOrder = 9;
    group.add(m); meshes.push(m); mats.push(mat);
  }
  let seen = 0, active = 0;

  return {
    object: group,
    get active() { return active; },
    update(ctx) {
      const w = ctx.world, a = ctx.alpha;
      if (w.impactCount < seen) seen = w.impactCount;   // mundo nuevo
      // Los golpes nuevos desde el último cuadro (como mucho, los que caben en el anillo).
      for (let n = Math.max(seen, w.impactCount - MAX_IMPACTS); n < w.impactCount; n++) {
        const k = n % MAX_IMPACTS, o = k * 4;
        planet[k] = w.impacts[o]!; angle[k] = w.impacts[o + 1]!; size[k] = w.impacts[o + 2]!; start[k] = ctx.time;
        mats[k]!.uniforms['uSeed']!.value = (n * 7.31) % 50;
      }
      seen = w.impactCount;
      active = 0;
      for (let k = 0; k < MAX_IMPACTS; k++) {
        const t = ctx.time - start[k]!, m = meshes[k]!;
        if (t >= LIFE || t < 0) { m.visible = false; continue; }
        const p = planet[k]!;
        const px = w.prevX[p] + (w.x[p] - w.prevX[p]) * a, py = w.prevY[p] + (w.y[p] - w.prevY[p]) * a;
        const ca = Math.cos(angle[k]!), sa = Math.sin(angle[k]!), r = w.radius[p];
        m.visible = true;
        m.position.set(px + ca * r, 0.6, -(py + sa * r));
        m.scale.setScalar((0.7 + 1.8 * size[k]!) * SPAN * 0.5);
        m.quaternion.copy(ctx.camera.quaternion);
        const u = mats[k]!.uniforms;
        u['uT']!.value = t;
        // Hacia afuera del planeta, visto en pantalla (la cámara mira inclinada pero sin girar: el eje y del mundo es -z).
        (u['uOut']!.value as { x: number; y: number }).x = ca; (u['uOut']!.value as { x: number; y: number }).y = sa;
        active++;
      }
    },
  };
}
