import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { toWorld } from '../cameraRig';
import type { Layer } from '../layer';
import type { Pipeline } from '../pipeline';
import { NOISE_GLSL } from '../shaders/noise';
import { playerHoleRadius } from '../../sim/phase';
import { OVER_WON, PHASE_COLLAPSE, PHASE_HUNT, PHASE_MERGE, type World } from '../../sim/world';

const DISK_VERT = /* glsl */ `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const DISK_FRAG = /* glsl */ `uniform float uTime; uniform float uIntensity; varying vec3 vL;
void main(){
  float r = length(vL.xy); float t = clamp((r-13.)/(44.-13.),0.,1.); float ang = atan(vL.y, vL.x);
  float a2 = ang + uTime*1.4/pow(r/13.,1.5);
  float n = fbm(vec3(cos(a2)*r*.09, sin(a2)*r*.09, r*.05), 5)*.5+.5;
  float dop = 1. + .7*cos(ang - .6);
  float rad = pow(1.-t,1.7)*smoothstep(0.,.04,t);
  vec3 col = mix(vec3(.9,.32,.08), vec3(1.,.86,.62), pow(1.-t,2.));
  gl_FragColor = vec4(col*rad*(.5+.8*n)*dop*uIntensity, 1.);
}`;

const HORIZON = 9; // radio del horizonte en unidades del modelo
const center = new Vector3();
const edge = new Vector3();
const ndc = new Vector3();
const toBH = new Vector3();

const smoothStep = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Tu agujero negro nace en el colapso (después del estallido) y ya está entero en la caza y la fusión.
function playerGrowth(w: World): number {
  if (w.phase === PHASE_HUNT || w.phase === PHASE_MERGE) return 1;
  if (w.phase === PHASE_COLLAPSE) return smoothStep(2.3, 4.5, w.phaseTime);
  return 0;
}
// Su disco de acreción se enciende de a poco.
const ignition = (w: World): number => (w.phase === PHASE_COLLAPSE ? smoothStep(2.6, 5.5, w.phaseTime) : 1);

// role 'rival': el agujero negro que te persigue. role 'player': el tuyo, que nace al colapsar.
export function createBlackHoleLayer(pipeline: Pipeline, role: 'rival' | 'player' = 'rival'): Layer {
  const group = new Group();
  group.add(new Mesh(new SphereGeometry(HORIZON, 48, 24), new MeshBasicMaterial({ color: 0x000000 })));
  const diskMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 4 } }, vertexShader: DISK_VERT, fragmentShader: NOISE_GLSL + DISK_FRAG,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  });
  const disk = new Mesh(new RingGeometry(13, 44, 220, 4), diskMat);
  disk.rotation.x = -Math.PI / 2 + 0.18;
  group.add(disk);
  const lens = pipeline.lens.lensUniforms;
  let diskBase = 4, diskT = 0, slowK = 0;   // slowK: 0 = normal, 1 = frenado por un bólido (disco apagado y lento)

  return {
    object: group,
    update(ctx) {
      const p = ctx.params, cam = ctx.camera, rig = ctx.rig;
      // En partida manda la simulación; con el agujero negro apagado (laboratorio, banco) mandan los parámetros.
      const w = ctx.world, bh = w.bh;
      const mine = playerGrowth(w);
      let radius: number;
      if (role === 'player') {
        group.visible = mine > 0.001;
        if (!group.visible) return;
        toWorld(ctx.starX, ctx.starY, center);
        radius = playerHoleRadius(w) * mine;
      } else {
        group.visible = w.over !== OVER_WON;   // después de la fusión queda uno solo: el tuyo
        if (!group.visible) return;
        radius = bh.active ? bh.radius : p.blackHoleRadius;
        if (bh.active) toWorld(bh.prevX + (bh.x - bh.prevX) * ctx.alpha, bh.prevY + (bh.y - bh.prevY) * ctx.alpha, center);
        else toWorld(p.blackHoleX, p.blackHoleY, center);
      }
      group.position.copy(center);
      group.scale.setScalar(radius / HORIZON);
      // Frenado por un bólido: el disco se apaga y gira más lento mientras dura (se ve que el golpe le hizo efecto).
      const slowed = role === 'rival' && w.bhSlow > 0 ? 1 : 0;
      slowK += (slowed - slowK) * Math.min(1, ctx.dt * 5);
      diskT += ctx.dt * (1 - 0.7 * slowK);
      diskMat.uniforms['uTime']!.value = diskT;
      diskMat.uniforms['uIntensity']!.value = diskBase * (role === 'player' ? ignition(w) : 1) * (1 - 0.6 * slowK);
      // Hay una sola lente: cuando existe tu agujero negro, la maneja él (está en el centro de la pantalla).
      if (role === 'rival' && mine > 0.001) return;

      // Lente: sólo si el agujero negro está delante de la cámara y cerca de la pantalla.
      toBH.copy(center).sub(cam.position);
      const ahead = toBH.x * rig.forward.x + toBH.y * rig.forward.y + toBH.z * rig.forward.z > 0;
      ndc.copy(center).project(cam);
      const onScreen = ahead && Math.abs(ndc.x) < 1.4 && Math.abs(ndc.y) < 1.4;
      lens.uEnabled.value = p.lensEnabled && onScreen ? 1 : 0;
      if (!onScreen) return;
      lens.uCenter.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
      lens.uAspect.value = ctx.width / ctx.height;
      const er = radius * p.einsteinScale;
      edge.set(center.x + rig.right.x * er, center.y + rig.right.y * er, center.z + rig.right.z * er).project(cam);
      lens.uEinsteinR.value = Math.abs(edge.x - ndc.x) * 0.5 * (ctx.width / ctx.height);
    },
    applyParams(p) { diskBase = p.diskIntensity; },
  };
}
