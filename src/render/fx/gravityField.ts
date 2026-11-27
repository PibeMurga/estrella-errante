import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from 'three';
import { PHASE_PLAY, starSize, type World } from '../../sim/world';
import type { Layer } from '../layer';

// La gravedad del agujero negro, a la vista:
// · Polvo que cae en espiral hacia él desde todo su alcance, cada vez más rápido y más brillante cerca del centro:
//   se ve hasta dónde llega su tirón y cuánto aprieta.
// · Si tu estrella está dentro del alcance, de su lado del agujero se le desprende un hilo de plasma que se estira hacia
//   él (como una estrella real cerca de un agujero negro): cuanto más fuerte te tira, más denso.
// Puntos aditivos actualizados en la CPU, sin crear objetos por cuadro.

const VERT = /* glsl */ `attribute float aB; varying float vB; uniform float uScale;
void main(){ vB = aB; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = uScale * (.6 + 1.4*aB) / -mv.z; gl_Position = projectionMatrix*mv; }`;
const FRAG = /* glsl */ `uniform vec3 uCol; varying float vB;
void main(){ vec2 c = gl_PointCoord*2. - 1.; float d = dot(c,c); if (d > 1.) discard; gl_FragColor = vec4(uCol * vB * exp(-d*3.), 1.); }`;

const DUST = 700, STREAM = 160;

export function createGravityFieldLayer(): Layer {
  const n = DUST + STREAM;
  const pos = new Float32Array(n * 3), bright = new Float32Array(n);
  const geo = new BufferGeometry();
  const pAttr = new BufferAttribute(pos, 3), bAttr = new BufferAttribute(bright, 1);
  geo.setAttribute('position', pAttr); geo.setAttribute('aB', bAttr);
  const mat = new ShaderMaterial({
    uniforms: { uCol: { value: new Vector3(1.0, 0.62, 0.38) }, uScale: { value: 480 } }, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  // Polvo: distancia y ángulo alrededor del agujero. Hilo: avance (0 = en la estrella, 1 = en el agujero) y desvío.
  const r = new Float32Array(DUST), ang = new Float32Array(DUST), sAt = new Float32Array(STREAM), sOff = new Float32Array(STREAM);
  let seedN = 1;
  const rnd = (): number => { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
  let ready = false, show = 0;

  return {
    object: points,
    update(ctx) {
      const w: World = ctx.world, bh = w.bh, c = w.config, dt = Math.min(ctx.dt, 0.05);
      const on = bh.active && w.phase === PHASE_PLAY && w.over === 0;
      show += ((on ? 1 : 0) - show) * Math.min(1, dt * 2);
      points.visible = show > 0.01;
      if (!points.visible) return;
      const range = c.bhRange, inner = bh.radius * 1.3;
      if (!ready) {
        for (let k = 0; k < DUST; k++) { r[k] = inner + Math.pow(rnd(), 0.7) * (range - inner); ang[k] = rnd() * Math.PI * 2; }
        for (let k = 0; k < STREAM; k++) { sAt[k] = rnd(); sOff[k] = rnd() - 0.5; }
        ready = true;
      }
      const bx = bh.prevX + (bh.x - bh.prevX) * ctx.alpha, by = bh.prevY + (bh.y - bh.prevY) * ctx.alpha;
      for (let k = 0; k < DUST; k++) {
        // Cae más rápido cuanto más cerca: la velocidad sigue a la gravedad (∝ 1/r).
        const rr = r[k]!;
        const fall = 6 + 900 / Math.max(rr, inner);
        r[k] = rr - fall * dt;
        ang[k] = ang[k]! + (2.2 / Math.sqrt(Math.max(rr, inner))) * dt * 1.6;
        if (r[k]! < inner) { r[k] = range * (0.75 + 0.25 * rnd()); ang[k] = rnd() * Math.PI * 2; }
        const x = bx + Math.cos(ang[k]!) * r[k]!, y = by + Math.sin(ang[k]!) * r[k]!;
        pos[k * 3] = x; pos[k * 3 + 1] = 0.2; pos[k * 3 + 2] = -y;
        const near = 1 - (r[k]! - inner) / (range - inner);
        bright[k] = show * (0.12 + 0.9 * near * near) * Math.min(1, (range - r[k]!) / 12);   // aparece suave en el borde
      }
      // Hilo de plasma de tu estrella hacia el agujero, si te alcanza su tirón.
      const sx = ctx.starX, sy = ctx.starY, dx = bx - sx, dy = by - sy, d = Math.hypot(dx, dy) || 1;
      const E = starSize(w.star.mass);
      const pull = d < range ? Math.min(1, ((range - d) / range) * 1.6) : 0;
      const ux = dx / d, uy = dy / d, px = -uy, py = ux;
      for (let k = 0; k < STREAM; k++) {
        const j = DUST + k;
        sAt[k] = sAt[k]! + dt * (0.18 + 0.5 * pull);
        if (sAt[k]! > 1) { sAt[k] = 0; sOff[k] = rnd() - 0.5; }
        const t = sAt[k]!;
        // Sale de la superficie del lado del agujero y se va angostando y curvando hacia él.
        const along = E * 0.9 + t * Math.max(0, d - E - bh.radius * 1.5) * 0.85;
        const bend = Math.sin(t * Math.PI) * E * 0.6;
        const wide = E * 0.45 * (1 - t * 0.8);
        const x = sx + ux * along + px * (sOff[k]! * wide + bend * 0.4), y = sy + uy * along + py * (sOff[k]! * wide + bend * 0.4);
        pos[j * 3] = x; pos[j * 3 + 1] = 0.3; pos[j * 3 + 2] = -y;
        bright[j] = show * pull * (1 - t) * (0.6 + 0.6 * (1 - Math.abs(sOff[k]!) * 2));
      }
      pAttr.needsUpdate = true; bAttr.needsUpdate = true;
    },
  };
}
