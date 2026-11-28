import { Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { OVER_SHATTERED, OVER_SWALLOWED, PHASE_IGNITION, starSize, type World } from '../../sim/world';
import { toWorld } from '../cameraRig';
import type { Layer } from '../layer';
import { sceneLight } from '../lighting';
import { GAS_TYPES, playerLook } from '../playerLook';
import { NOISE_GLSL } from '../shaders/noise';
import { smoothToward } from '../smooth';

// Tu cuerpo antes de la ignición: un planeta gaseoso con bandas que fluyen, iluminado por la estrella lejana, con un
// borde de atmósfera. Al acercarse a la enana marrón se calienta: las bandas se vuelven brasas de un rojo oscuro, con
// luz propia muy tenue. En la ignición se comprime, el centro brilla, destella y se desvanece mientras nace el sol.
// Los colores son de gaseosos reales y cambian según la partida (ocre como Júpiter, crema como Saturno, azul como Neptuno).

const VERT = /* glsl */ `varying vec3 vN; varying vec3 vO; varying vec3 vP; varying vec3 vV;
void main(){ vO = position; vec4 w = modelMatrix*vec4(position,1.); vP = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;

const FRAG = /* glsl */ `uniform float uTime; uniform vec3 uSunPos; uniform vec3 uLight; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
uniform float uHeat; uniform float uGlow; uniform float uCore; uniform float uFade; uniform float uSeed;
varying vec3 vN; varying vec3 vO; varying vec3 vP; varying vec3 vV;
void main(){
  vec3 p = normalize(vO), n = normalize(vN);
  float lat = p.y, lon = atan(p.z, p.x);
  // Rotación diferencial: cada franja de latitud gira a su propio ritmo (chorros alternados, como en Júpiter).
  float jet = sin(lat * 19. + uSeed) * .5 + sin(lat * 7.3 + uSeed * 2.) * .5;
  float lonF = lon + uTime * (.03 + .05 * jet);
  vec3 q = vec3(cos(lonF) * sqrt(1. - lat*lat), lat, sin(lonF) * sqrt(1. - lat*lat));
  // Deformación de las franjas: remolinos y festones a lo largo de los bordes.
  float warp = fbm(vec3(q.x * 2.6, lat * 9., q.z * 2.6) + uSeed, 4);
  float warp2 = fbm(vec3(q.x * 6., lat * 24., q.z * 6.) + uSeed * 1.7 + vec3(0., 0., uTime * .02), 3);
  float y = lat + warp * .045 + warp2 * .018;
  // Perfil de bandas de ancho desparejo: zonas claras anchas y cinturones oscuros, con franjitas finas.
  float prof = fbm(vec3(0., y * 5.5, uSeed * .3), 4) * .5 + .5;
  float fine = sin(y * 85. + warp * 6.) * .5 + .5;
  vec3 alb = mix(uC, uA, smoothstep(.25, .5, prof));
  alb = mix(alb, uB, smoothstep(.52, .72, prof));
  alb *= .9 + .14 * fine;
  // Turbulencia en los bordes de las bandas (donde el perfil cambia rápido).
  float edge = abs(fract(prof * 3.) - .5);
  float turb = fbm(q * 9. + vec3(uTime * .04, 0., 0.) + uSeed, 3) * .5 + .5;
  alb = mix(alb, mix(uB, uC, turb), (1. - smoothstep(.0, .12, edge)) * .35);
  float band = prof * 2. - 1.;
  // Una gran tormenta oval y algunos óvalos blancos chicos.
  float storm = 1. - smoothstep(.0, .16, length(vec2((lon - 1.1 - uTime*.02)*.6, (lat + .28)*2.2)));
  alb = mix(alb, uC * 1.15 + vec3(.06, .02, 0.), storm * .65);
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    vec2 c = vec2(fract(uSeed * .37 + fk * .29) * 6.283 - 3.14, -.55 + fk * .32 + sin(uSeed + fk) * .05);
    float ov = 1. - smoothstep(.0, .05, length(vec2((lon - c.x - uTime * (.015 + .01 * fk)) * .7, (lat - c.y) * 2.4)));
    alb = mix(alb, uB * 1.12, ov * .7);
  }
  // Polos más oscuros y apagados.
  alb = mix(alb, uC * .6, smoothstep(.72, .95, abs(lat)) * .6);
  vec3 L = normalize(uSunPos - vP);
  float ndl = dot(n, L), lit = max(ndl, 0.) * smoothstep(-.05, .15, ndl);
  float mu = clamp(dot(n, normalize(vV)), 0., 1.);
  // Oscurecimiento hacia el borde (la luz atraviesa más atmósfera) y un relleno tenue del lado oscuro.
  vec3 col = alb * uLight * lit * (.6 + .4 * pow(mu, .45)) + alb * .035;
  // Atmósfera en el borde, del lado iluminado.
  col += uA * pow(1. - mu, 3.) * (.15 + .85*max(ndl + .2, 0.)) * .35 * uLight;
  // Gigantes calientes (magenta, brasa): brillan un poco por su propio calor, más en las bandas.
  col += vec3(.55, .1, .05) * uGlow * (.25 + .75*(band*.5+.5)) * (.5 + .5*turb) * .5;
  // Enana marrón: las bandas se calientan; brillo propio rojo oscuro que no depende de la luz de afuera.
  // Una enana marrón real es oscura: rojo apagado, tirando a magenta, con bandas un poco más vivas.
  vec3 ember = vec3(.42, .07, .09) * (.3 + .7*(band*.5+.5)) * (.5 + .5*turb) * (.4 + .6*pow(mu, .7));
  col = mix(col, col*.35 + ember, uHeat);
  // Ignición: el centro se enciende desde adentro.
  col += vec3(2.4, 1.5, .8) * uCore * (pow(mu, 1.5) * 1.6 + .2);
  gl_FragColor = vec4(col * uFade, 1.);
}`;



const smooth01 = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export function createPlayerPlanetLayer(sunPos: Vector3): Layer {
  let shownType = playerLook.planetType;
  const pal = GAS_TYPES[shownType % GAS_TYPES.length]!.colors;
  const light = new Vector3();
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSunPos: { value: sunPos }, uLight: { value: light },
      uA: { value: new Color(pal[0]) }, uB: { value: new Color(pal[1]) }, uC: { value: new Color(pal[2]) },
      uHeat: { value: 0 }, uGlow: { value: GAS_TYPES[shownType % GAS_TYPES.length]!.glow }, uCore: { value: 0 }, uFade: { value: 1 }, uSeed: { value: 3.7 },
    },
    vertexShader: VERT, fragmentShader: NOISE_GLSL + FRAG,
  });
  const mesh = new Mesh(new SphereGeometry(1, 96, 48), mat);
  mesh.frustumCulled = false;
  const pos = new Vector3();
  let shownR = -1;

  return {
    object: mesh,
    update(ctx) {
      const w: World = ctx.world;
      const igniting = w.phase === PHASE_IGNITION, t = igniting ? w.phaseTime : 0;
      const fade = igniting ? 1 - smooth01((t - 1.2) / 0.7) : w.ignited ? 0 : 1;
      mesh.visible = fade > 0.01 && w.over !== OVER_SWALLOWED && w.over !== OVER_SHATTERED;
      if (!mesh.visible) { shownR = -1; return; }
      const target = starSize(w.star.mass) * (igniting ? 1 - 0.28 * smooth01(t / 1.2) : 1);   // se comprime antes de encenderse
      shownR = shownR < 0 ? target : smoothToward(shownR, target, igniting ? 6 : 1.2, ctx.dt);
      toWorld(ctx.starX, ctx.starY, pos);
      mesh.position.copy(pos);
      mesh.scale.setScalar(shownR);
      mesh.rotation.y = ctx.time * 0.12;
      light.set(1.25, 1.02, 0.8).multiplyScalar(sceneLight.level * 1.1);
      const u = mat.uniforms;
      if (playerLook.planetType !== shownType) {   // lo eligió en la pantalla del nombre
        shownType = playerLook.planetType;
        const p = GAS_TYPES[shownType % GAS_TYPES.length]!.colors;
        u['uGlow']!.value = GAS_TYPES[shownType % GAS_TYPES.length]!.glow;
        (u['uA']!.value as Color).set(p[0]); (u['uB']!.value as Color).set(p[1]); (u['uC']!.value as Color).set(p[2]);
      }
      u['uTime']!.value = ctx.time;
      u['uHeat']!.value = smooth01((w.star.mass - 16) / 14);   // enana marrón desde 18, al rojo al llegar a la ignición
      u['uCore']!.value = igniting ? smooth01(t / 1.2) * (0.45 + 0.55 * smooth01((t - 1.0) / 0.2)) : 0;   // contenido
      u['uFade']!.value = fade;
    },
  };
}
