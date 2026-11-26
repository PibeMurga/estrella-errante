// PRUEBA DESCARTABLE v2: sol realista y planetas en alta definición, cámara inclinada.
import * as THREE from 'three';
import { BloomEffect, EffectComposer, EffectPass, RenderPass, ShaderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';

const q = new URLSearchParams(location.search);
const tilt = Number(q.get('tilt') ?? 35);
document.getElementById('lbl').textContent = 'PRUEBA 3D · INCLINACIÓN ' + tilt + '°';

// ---------- Ruido (simplex 3D de Ashima Arts, MIT) + fbm, ridged y Worley ----------
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+10.)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 105.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float fbm(vec3 p, int o){float a=.5,s=0.;for(int i=0;i<10;i++){if(i>=o)break;s+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
float ridged(vec3 p, int o){float a=.5,s=0.;for(int i=0;i<10;i++){if(i>=o)break;float n=1.-abs(snoise(p));s+=a*n*n;p=p*2.1+vec3(3.1,1.7,5.2);a*=.5;}return s;}
vec3 hash33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float worley(vec3 p){vec3 i=floor(p),f=fract(p);float d=8.;for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 g=vec3(x,y,z);vec3 o=hash33(i+g);d=min(d,length(g+o-f));}return d;}
`;

const renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance', antialias: false, stencil: false, depth: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.5, 6000);
const close = q.has("close"); const target = close ? new THREE.Vector3(4, 0, 2) : new THREE.Vector3(6, 0, -6);
const camDist = close ? 62 : 150;
const placeCamera = (t) => {
  const e = THREE.MathUtils.degToRad(tilt), az = Math.sin(t * .05) * .07;
  camera.position.set(target.x + Math.sin(az) * camDist * Math.cos(e), target.y + camDist * Math.sin(e), target.z + Math.cos(az) * camDist * Math.cos(e));
  camera.lookAt(target);
};

// ---------- Cielo ----------
scene.add(new THREE.Mesh(new THREE.SphereGeometry(2500, 64, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: NOISE + `varying vec3 vDir; void main(){ vec3 d = vDir; float n1 = fbm(d*1.3, 5); float n2 = fbm(d*1.7 + n1*.8 + 4.0, 6);
    float dens = smoothstep(.2, .95, n2*.5+.5); dens *= dens; vec3 col = mix(vec3(.02,.03,.08), vec3(.10,.035,.08), smoothstep(.3,.8,n1*.5+.5));
    col = mix(col, vec3(.22,.11,.05), smoothstep(.65,.98,dens)); col *= dens * .3; col *= 1. - .75*smoothstep(.48,.78, fbm(d*7., 4)*.5+.5);
    gl_FragColor = vec4(col, 1.); }`,
})));
{
  const N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 2300, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * s * r, u * r, Math.sin(th) * s * r], i * 3);
    const b = .08 + Math.pow(Math.random(), 8) * 3.2, t = [[.72, .82, 1], [1, 1, 1], [1, .9, .76], [1, .74, .55]][Math.floor(Math.random() * 4)];
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3); size[i] = .8 + Math.random() * 1.5;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  scene.add(new THREE.Points(g, new THREE.ShaderMaterial({ depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, uniforms: { uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `uniform float uPR; attribute vec3 aCol; attribute float aSize; varying vec3 vC; void main(){ vC = aCol; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize = aSize * uPR; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d = gl_PointCoord-.5; float a = exp(-dot(d,d)*24.); gl_FragColor = vec4(vC*a,1.); }` })));
}

// ---------- El sol (estrella del jugador) ----------
const SUN_R = 7;
const sunMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vO; varying vec3 vV; void main(){ vO = position; vec4 w = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: NOISE + `uniform float uTime; varying vec3 vN; varying vec3 vO; varying vec3 vV;
  void main(){
    vec3 p = normalize(vO); float t = uTime;
    float mu = clamp(dot(normalize(vN), normalize(vV)), 0., 1.);
    vec3 q = p*22. + vec3(0., t*.18, t*.11) + .35*vec3(snoise(p*6.+t*.2), snoise(p*6.+9.+t*.2), snoise(p*6.+17.+t*.2));
    float c = worley(q); float gran = 1. - smoothstep(.05, .85, c);
    float fine = fbm(p*60. + t*.3, 3)*.5+.5;
    float sg = fbm(p*3.2 + vec3(t*.01), 5)*.5+.5;
    float spot = smoothstep(.73, .78, fbm(p*2.6 + 11.3, 5)*.5+.5);
    float pen = smoothstep(.69, .74, fbm(p*2.6 + 11.3, 5)*.5+.5);
    float fac = smoothstep(.62, .8, fbm(p*9. + 3.1, 4)*.5+.5) * (1. - mu);
    vec3 hot = vec3(1.0, .58, .18), mid = vec3(.95, .30, .05), cool = vec3(.62, .09, .015);
    vec3 col = mix(mid, hot, gran*.75 + fine*.15);
    col *= .82 + .3*sg;
    col = mix(col, cool*.55, pen*.55); col = mix(col, vec3(.12,.03,.01), spot*.85);
    col += hot*fac*.35;
    float limb = pow(mu, .55);
    col = mix(cool*.7, col, smoothstep(0., .55, mu)) * (.28 + .72*limb);
    gl_FragColor = vec4(col * 1.45, 1.);
  }` });
const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 128, 64), sunMat); scene.add(sun);

const halo = new THREE.Mesh(new THREE.PlaneGeometry(SUN_R * 7, SUN_R * 7), new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: NOISE + `uniform float uTime; varying vec2 vUv;
  void main(){
    vec2 d = (vUv*2.-1.)*3.5; float r = length(d); float a = atan(d.y, d.x);
    if (r < .985) discard;
    float h = r - 1.;
    vec3 ring = vec3(1.,.28,.06) * exp(-h*55.) * 1.8;
    float flow = fbm(vec3(cos(a)*3., sin(a)*3., h*3.5 - uTime*.12), 5)*.5+.5;
    float loops = smoothstep(.6, .8, flow) * exp(-h*9.) * smoothstep(0., .03, h);
    float spikes = smoothstep(.55, .9, fbm(vec3(cos(a)*7., sin(a)*7., uTime*.05), 4)*.5+.5);
    vec3 prom = vec3(1.,.36,.1) * loops * (1.2 + spikes) * 1.4;
    vec3 cor = vec3(1.,.45,.15) * exp(-h*2.2) * .28;
    gl_FragColor = vec4((ring + prom + cor) * (1. - smoothstep(1.8, 3.3, r)), 1.);
  }` }));
scene.add(halo);
const sunLight = new THREE.PointLight(0xffc890, 2.4, 0, 0); scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x1a2233, .03));

// ---------- Planetas HD ----------
const planetVert = `varying vec3 vN; varying vec3 vP; varying vec3 vO; varying mat3 vM; void main(){ vO = position; vec4 w = modelMatrix*vec4(position,1.); vP = w.xyz; vM = mat3(modelMatrix); vN = normalize(vM*normal); gl_Position = projectionMatrix*viewMatrix*w; }`;
const planetFrag = NOISE + `
uniform int uType; uniform float uSeed, uTime; varying vec3 vN; varying vec3 vP; varying vec3 vO; varying mat3 vM;
float height(vec3 p){
  vec3 s = p + uSeed;
  if (uType == 0) { float h = fbm(s*3., 7)*.35; float c1 = worley(s*5.); float c2 = worley(s*13.);
    h += -.5*(1.-smoothstep(0.,.25,c1)) + .3*exp(-pow((c1-.26)/.05,2.)); h += (-.25*(1.-smoothstep(0.,.22,c2)) + .14*exp(-pow((c2-.23)/.04,2.)))*.6; return h; }
  if (uType == 1) { vec3 w = s*1.6 + .55*vec3(fbm(s*1.2,4), fbm(s*1.2+5.,4), fbm(s*1.2+9.,4)); return fbm(w, 8); }
  if (uType == 2) { return ridged(s*2.6, 6)*.6 + fbm(s*5., 4)*.15; }
  if (uType == 4) { return fbm(s*3.5, 7); }
  return 0.;
}
void main(){
  vec3 p = normalize(vO); vec3 L = normalize(-vP); vec3 V = normalize(cameraPosition - vP);
  vec3 T = normalize(cross(p, abs(p.y) < .99 ? vec3(0.,1.,0.) : vec3(1.,0.,0.))); vec3 B = cross(p, T);
  float e = .0025, h0 = height(p), hT = height(normalize(p + T*e)), hB = height(normalize(p + B*e));
  float k = uType == 1 ? (h0 > .06 ? .9 : 0.) : (uType == 3 ? 0. : 1.1);
  vec3 nObj = normalize(p - k*((hT-h0)/e*T + (hB-h0)/e*B)*.02);
  vec3 n = normalize(vM*nObj), ng = normalize(vN);
  float ndl = dot(n, L), ndlg = dot(ng, L);
  float lit = max(ndl, 0.) * smoothstep(-.04, .12, ndlg);
  vec3 lc = vec3(1.25, 1.02, .8);
  vec3 alb = vec3(.5); vec3 emit = vec3(0.); float spec = 0.;
  float lat = p.y;
  if (uType == 0) { float mar = smoothstep(.45,.6, fbm(p*1.4+uSeed,4)*.5+.5); alb = mix(vec3(.46,.42,.38), vec3(.22,.2,.19), mar) * (.8 + h0*.5); }
  if (uType == 1) {
    float sea = .06;
    if (h0 < sea) { float dpt = smoothstep(sea, sea-.35, h0); alb = mix(vec3(.04,.16,.24), vec3(.01,.04,.11), dpt); spec = 1.; }
    else { float hh = (h0-sea); float moist = fbm(p*4.+uSeed+7.,4)*.5+.5;
      alb = mix(vec3(.24,.30,.12), vec3(.42,.34,.22), smoothstep(.35,.65,moist)); alb = mix(alb, vec3(.33,.31,.29), smoothstep(.18,.32,hh)); }
    float ice = smoothstep(.72, .82, abs(lat) + fbm(p*6.,3)*.08); alb = mix(alb, vec3(.9,.93,.96), ice); spec *= 1.-ice;
  }
  if (uType == 2) { float cr = ridged(p*2.6+uSeed, 6); alb = mix(vec3(.55,.68,.80), vec3(.88,.93,.97), smoothstep(.35,.7,cr)); alb = mix(alb, vec3(.25,.38,.55), smoothstep(.82,.95,cr)*.8); spec = .35; }
  if (uType == 3) {
    vec3 qq = p + .12*vec3(fbm(p*4.+uTime*.01,5), fbm(p*4.+3.+uTime*.01,5), 0.);
    float band = sin(qq.y*19. + fbm(qq*2.5+uSeed,5)*2.4)*.5+.5; float fine2 = fbm(vec3(qq.x*2., qq.y*40., qq.z*2.)+uSeed, 4)*.5+.5;
    alb = mix(vec3(.62,.44,.28), vec3(.93,.84,.68), band); alb = mix(alb, vec3(.45,.24,.14), smoothstep(.62,.9,fine2)*.6);
    float lon = atan(p.z, p.x); float sd = length(vec2((lon - 1.2)*1.7, (lat + .32)*4.)); float sw = snoise(vec3(lon*6., lat*14., uTime*.05));
    alb = mix(alb, vec3(.78,.34,.18) + sw*.05, smoothstep(.45, .05, sd));
  }
  if (uType == 4) {
    float cracks = ridged(p*4.+uSeed, 5); float glow = smoothstep(.72, .92, cracks);
    alb = mix(vec3(.07,.06,.06), vec3(.16,.12,.11), h0*.5+.5) * (1.-glow*.8);
    emit = vec3(2.6, .75, .18) * glow * (.7 + .3*snoise(p*20. + uTime*.4));
  }
  vec3 col = alb * lc * lit + alb * .004;
  if (spec > 0.) { vec3 H = normalize(L + V); col += spec * lc * pow(max(dot(n, H), 0.), 80.) * 1.3 * smoothstep(0., .1, ndlg); }
  if (uType == 3) col *= .55 + .45*pow(max(dot(ng, V), 0.), .35);
  col += emit;
  gl_FragColor = vec4(col, 1.);
}`;
const cloudFrag = NOISE + `uniform float uTime, uSeed; varying vec3 vN; varying vec3 vP; varying vec3 vO; varying mat3 vM;
void main(){ vec3 p = normalize(vO); vec3 L = normalize(-vP); float ndl = dot(normalize(vN), L);
  vec3 w = p*2.3 + vec3(uTime*.012, 0., 0.) + .6*vec3(fbm(p*1.5+uSeed,4), fbm(p*1.5+4.,4), 0.);
  float c = smoothstep(.52, .78, fbm(w, 7)*.5+.5); float lit = max(ndl, 0.) * smoothstep(-.04, .12, ndl);
  gl_FragColor = vec4(vec3(1.,.97,.93) * 1.15 * lit, c * .92); }`;

const planets = [];
const sphere = new THREE.SphereGeometry(1, 128, 64);
// [distancia, radio, tipo]  0 rocoso · 1 oceánico · 2 hielo · 3 gaseoso · 4 lava
[[19, 1.6, 4], [28, 2.5, 1], [44, 2.2, 2], [58, 5.0, 3], [70, 1.7, 0], [25, 1.2, 0], [50, 1.9, 4], [80, 2.6, 2]].forEach(([d, r, type], i) => {
  const u = { uType: { value: type }, uSeed: { value: i * 7.31 }, uTime: { value: 0 } };
  const m = new THREE.Mesh(sphere, new THREE.ShaderMaterial({ uniforms: u, vertexShader: planetVert, fragmentShader: planetFrag }));
  m.scale.setScalar(r * 1.8); scene.add(m);
  let clouds = null;
  if (type === 1) { clouds = new THREE.Mesh(sphere, new THREE.ShaderMaterial({ uniforms: { uTime: u.uTime, uSeed: u.uSeed }, vertexShader: planetVert, fragmentShader: cloudFrag, transparent: true, depthWrite: false }));
    clouds.scale.setScalar(r * 1.8 * 1.015); scene.add(clouds); }
  planets.push({ m, clouds, d, a: i * 2.1 + .6, w: 1.4 / Math.pow(d, 1.5) * 6, u, spin: .15 + Math.random() * .2 });
});

// ---------- Cinturón de asteroides ----------
const rockGeo = new THREE.IcosahedronGeometry(1, 2);
{ const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
  const d = 1 + .22 * Math.sin(3.1 * x + 1.7) * Math.cos(2.3 * y + .4) + .14 * Math.sin(5.3 * z + 2.2 + 1.9 * x) + .06 * Math.sin(11 * (x + y)); p.setXYZ(i, x * d, y * d * .8, z * d); } rockGeo.computeVertexNormals(); }
const NR = 1100, rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92, metalness: .05, flatShading: true }), NR);
const rk = [], tint = new THREE.Color();
for (let i = 0; i < NR; i++) {
  rk.push({ a: Math.random() * 6.283, d: 34 + Math.random() * 7 + (Math.random() - .5) * 3, y: (Math.random() - .5) * 1.6, s: .06 + Math.pow(Math.random(), 4) * .42, sp: Math.random() * 1.5, ax: new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize() });
  const b = .16 + Math.random() * .18, w = Math.random() * .04; tint.setRGB(b + w, b, b - w * .6); rocks.setColorAt(i, tint);
}
scene.add(rocks);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();

// ---------- Agujero negro lejano ----------
const BH = new THREE.Vector3(118, -2, -40);
const bhGroup = new THREE.Group(); bhGroup.position.copy(BH); bhGroup.scale.setScalar(.55); scene.add(bhGroup);
bhGroup.add(new THREE.Mesh(new THREE.SphereGeometry(9, 48, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })));
const diskMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: NOISE + `uniform float uTime; varying vec3 vL; void main(){ float r = length(vL.xy); float t = clamp((r-13.)/(44.-13.),0.,1.); float ang = atan(vL.y, vL.x);
    float a2 = ang + uTime*1.4/pow(r/13.,1.5); float n = fbm(vec3(cos(a2)*r*.09, sin(a2)*r*.09, r*.05), 5)*.5+.5; float dop = 1. + .7*cos(ang - .6);
    float rad = pow(1.-t,1.7)*smoothstep(0.,.04,t); vec3 col = mix(vec3(.9,.32,.08), vec3(1.,.86,.62), pow(1.-t,2.)); gl_FragColor = vec4(col*rad*(.5+.8*n)*dop*4.,1.); }` });
const disk = new THREE.Mesh(new THREE.RingGeometry(13, 44, 220, 4), diskMat); disk.rotation.x = -Math.PI / 2 + .18; bhGroup.add(disk);

// ---------- Postproceso ----------
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
const lensMat = new THREE.ShaderMaterial({ uniforms: { inputBuffer: { value: null }, uCenter: { value: new THREE.Vector2() }, uAspect: { value: 1 }, uE: { value: .03 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = position.xy*.5+.5; gl_Position = vec4(position.xy,1.,1.); }`,
  fragmentShader: `uniform sampler2D inputBuffer; uniform vec2 uCenter; uniform float uAspect, uE; varying vec2 vUv;
    void main(){ vec2 d = vUv-uCenter; d.x *= uAspect; float r = max(length(d),1e-4); vec2 dir = d/r; float beta = r - uE*uE/r; float w = 1.-smoothstep(uE*5.,uE*8.,r);
    vec2 src = dir*mix(r,beta,w); src.x /= uAspect; gl_FragColor = texture2D(inputBuffer, uCenter+src); }` });
composer.addPass(new ShaderPass(lensMat, 'inputBuffer'));
composer.addPass(new EffectPass(camera,
  new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.0, luminanceSmoothing: .35, intensity: .95, radius: .7 }),
  new VignetteEffect({ offset: .3, darkness: .55 }),
  new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));
composer.addPass(new EffectPass(camera, new SMAAEffect()));

const resize = () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

const proj = new THREE.Vector3(), side = new THREE.Vector3();
function frame(ms){
  const t = ms / 1000;
  placeCamera(t);
  sunMat.uniforms.uTime.value = t; halo.material.uniforms.uTime.value = t; diskMat.uniforms.uTime.value = t;
  sun.rotation.y = t * .03; halo.quaternion.copy(camera.quaternion);
  for (const p of planets) { const a = p.a + t * p.w; p.m.position.set(Math.cos(a) * p.d, 0, Math.sin(a) * p.d); p.m.rotation.y = t * p.spin; p.u.uTime.value = t;
    if (p.clouds) { p.clouds.position.copy(p.m.position); p.clouds.rotation.y = t * p.spin * 1.15; } }
  for (let i = 0; i < NR; i++) { const r = rk[i], a = r.a + t * .22 / Math.pow(r.d / 34, 1.5); tmpP.set(Math.cos(a) * r.d, r.y, Math.sin(a) * r.d); tmpQ.setFromAxisAngle(r.ax, t * r.sp + i); tmpS.setScalar(r.s); tmpM.compose(tmpP, tmpQ, tmpS); rocks.setMatrixAt(i, tmpM); }
  rocks.instanceMatrix.needsUpdate = true;
  proj.copy(BH).project(camera); lensMat.uniforms.uCenter.value.set(proj.x * .5 + .5, proj.y * .5 + .5); lensMat.uniforms.uAspect.value = innerWidth / innerHeight;
  side.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(11).add(BH).project(camera); lensMat.uniforms.uE.value = Math.abs(side.x - proj.x) * .5 * (innerWidth / innerHeight);
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
