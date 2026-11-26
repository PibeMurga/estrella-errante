import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { toWorld } from '../cameraRig';
import type { Layer } from '../layer';
import type { Pipeline } from '../pipeline';
import { NOISE_GLSL } from '../shaders/noise';

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

export function createBlackHoleLayer(pipeline: Pipeline): Layer {
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

  return {
    object: group,
    update(ctx) {
      const p = ctx.params, cam = ctx.camera, rig = ctx.rig;
      // En partida manda la simulación; con el agujero negro apagado (laboratorio, banco) mandan los parámetros.
      const bh = ctx.world.bh;
      const radius = bh.active ? bh.radius : p.blackHoleRadius;
      if (bh.active) toWorld(bh.prevX + (bh.x - bh.prevX) * ctx.alpha, bh.prevY + (bh.y - bh.prevY) * ctx.alpha, center);
      else toWorld(p.blackHoleX, p.blackHoleY, center);
      group.position.copy(center);
      group.scale.setScalar(radius / HORIZON);
      diskMat.uniforms['uTime']!.value = ctx.time;

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
    applyParams(p) { diskMat.uniforms['uIntensity']!.value = p.diskIntensity; },
  };
}
