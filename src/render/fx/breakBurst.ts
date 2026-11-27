import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import { KIND_GAS, KIND_ICE, type World } from '../../sim/world';
import type { Layer } from '../layer';
import { NOISE_GLSL } from '../shaders/noise';

// Un planeta que se parte: cada ruptura distinta. Se sortea el tipo y se cambian tamaño, duración, brillo y forma:
//   0 · bola de fuego que se enfría (roca vaporizada);
//   1 · nube de polvo lenta y opaca, casi sin fuego;
//   2 · dos chorros de escombros a lo largo del corte, que se abren y se frenan;
//   3 · onda que se aleja, con roca fundida salpicada en grumos.
// El color sale del planeta: vapor blanco azulado en los helados, polvo cálido en los rocosos, gas pálido en los gaseosos.
// Contenida, no exagerada: mide en radios del planeta y se apaga en unos segundos.

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv*2. - 1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FRAG = /* glsl */ `uniform float uT; uniform float uSeed; uniform float uType; uniform float uLife; uniform vec3 uTint; uniform vec2 uAxis; varying vec2 vUv;
void main(){
  vec2 q = vUv * 6.;                  // el cuadro mide 12 radios de planeta de lado
  float r = length(q), t = uT / uLife * 4.;   // tiempo normalizado: cada ruptura dura distinto
  float n = fbm(vec3(q*.8, uSeed + t*.3), 4);
  float flash = exp(-t*12.) * exp(-r*r*1.5) * 2.2;
  float fade = 1. - smoothstep(2.6, 4., t);
  vec3 col = vec3(1., .92, .8) * flash;
  if (uType < .5) {                    // bola de fuego
    float R = .8 + 1.2*(1. - exp(-t*1.2));
    float body = 1. - smoothstep(R*.5, R*(1. + .3*n), r);
    float cool = exp(-t/1.2);
    vec3 hot = mix(uTint*.35, mix(vec3(1.5,.55,.14), vec3(2.,1.7,1.3), cool), cool);
    col += hot * body * (.5 + .6*(n*.5+.5)) * (.1 + 1.1*cool) / (R*R*.8);
  } else if (uType < 1.5) {            // nube de polvo lenta
    float R = .9 + 1.5*(1. - exp(-t*.7));
    float body = (1. - smoothstep(R*.3, R*(1.1 + .5*n), r)) * (.4 + .8*(n*.5+.5));
    col += uTint * body * .45 * exp(-t*.35) + vec3(1.2,.5,.15) * exp(-t*3.) * exp(-r*r*2.) * .6;
  } else if (uType < 2.5) {            // dos chorros a lo largo del corte
    vec2 ax = normalize(uAxis);
    float along = dot(q, ax), side = dot(q, vec2(-ax.y, ax.x));
    float L = .6 + 2.6*(1. - exp(-t*1.5));
    float jet = exp(-pow(side/((.25 + .18*abs(along))*(.6 + .9*(n*.5+.5))), 2.)) * (1. - smoothstep(L*.6, L, abs(along))) * (.4 + .9*(n*.5+.5));
    float knots = smoothstep(.6, .9, snoise(vec3(along*3. - sign(along)*t*2., side*3., uSeed)));
    col += mix(uTint, vec3(1.4,.6,.2), exp(-t*.8)) * jet * (.5 + .8*knots) * exp(-t*.5) * .9;
  } else {                             // onda con roca fundida en grumos
    float S = .7 + 2.8*(1. - exp(-t*1.3));
    float an = atan(q.y, q.x);
    float wob = .35*fbm(vec3(cos(an)*2., sin(an)*2., uSeed), 3);                       // frente deforme, no un anillo
    float broken = smoothstep(-.1, .35, snoise(vec3(cos(an)*3., sin(an)*3., uSeed + t*.2)));   // se corta en tramos
    float ring = exp(-pow((r - S*(1. + wob))/(.2 + .25*n), 2.)) * exp(-t*.9) * .28 * broken;
    float blobs = smoothstep(.55, .85, fbm(vec3(q*2.2, uSeed), 3)*.5+.5) * (1. - smoothstep(S*.4, S*1.05, r)) * smoothstep(S*.15, S*.5, r);
    col += uTint * ring + vec3(1.6,.5,.12) * blobs * exp(-t*.9) * .9;
  }
  gl_FragColor = vec4(col * fade, 1.);
}`;

const SPAN = 6;
const TINT_ROCK = new Vector3(0.85, 0.6, 0.4), TINT_ICE = new Vector3(0.65, 0.8, 1.0), TINT_GAS = new Vector3(0.9, 0.82, 0.65);

export function createBreakBurstLayer(): Layer {
  const mat = new ShaderMaterial({
    uniforms: { uT: { value: 99 }, uSeed: { value: 0 }, uType: { value: 0 }, uLife: { value: 4 }, uTint: { value: new Vector3() }, uAxis: { value: new Vector2(1, 0) } },
    vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 10;
  let seen = 0, start = -99, life = 4, lastWorld: World | null = null;
  const u = mat.uniforms;

  return {
    object: mesh,
    update(ctx) {
      const w = ctx.world;
      if (w !== lastWorld || w.breakFxCount < seen) { lastWorld = w; seen = w.breakFxCount; }
      if (w.breakFxCount > seen) {
        seen = w.breakFxCount;
        start = ctx.time;
        // Sorteo propio de cada ruptura (el render no toca el azar de la simulación).
        const h = (k: number): number => { const v = Math.sin(seen * 12.9898 + k * 78.233 + w.breakFxX * 0.37) * 43758.5453; return v - Math.floor(v); };
        u['uType']!.value = Math.floor(h(1) * 4);
        u['uSeed']!.value = h(2) * 50;
        life = 2.5 + h(3) * 3;
        u['uLife']!.value = life;
        (u['uTint']!.value as Vector3).copy(w.breakFxKind === KIND_ICE ? TINT_ICE : w.breakFxKind === KIND_GAS ? TINT_GAS : TINT_ROCK);
        (u['uAxis']!.value as Vector2).set(w.breakFxAx, w.breakFxAy);
        mesh.position.set(w.breakFxX, 0.5, -w.breakFxY);
        mesh.scale.setScalar(w.breakFxR * (0.75 + 0.6 * h(4)) * SPAN);
      }
      const t = ctx.time - start;
      mesh.visible = t >= 0 && t < life;
      if (!mesh.visible) return;
      u['uT']!.value = t;
      mesh.quaternion.copy(ctx.camera.quaternion);
    },
  };
}
