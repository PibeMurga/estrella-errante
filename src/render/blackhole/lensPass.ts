import { ShaderMaterial, Uniform, Vector2 } from 'three';
import { ShaderPass } from 'postprocessing';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

// Lente de masa puntual: lo que se ve a distancia r viene de r - θE²/r.
// Dentro de θE la imagen se invierte, y eso arma el anillo de Einstein.
const FRAG = /* glsl */ `
uniform sampler2D inputBuffer;
uniform vec2 uCenter;
uniform float uAspect;
uniform float uEinsteinR;
uniform float uEnabled;
varying vec2 vUv;
void main() {
  vec2 d = vUv - uCenter;
  d.x *= uAspect;
  float r = max(length(d), 1e-4);
  vec2 dir = d / r;
  float beta = r - (uEinsteinR * uEinsteinR) / r;
  float w = (1.0 - smoothstep(uEinsteinR * 2.2, uEinsteinR * 3.6, r)) * uEnabled;
  vec2 src = dir * mix(r, beta, w);
  src.x /= uAspect;
  gl_FragColor = texture2D(inputBuffer, uCenter + src);
}
`;

export interface LensUniforms {
  uCenter: Uniform<Vector2>;
  uAspect: Uniform<number>;
  uEinsteinR: Uniform<number>;
  uEnabled: Uniform<number>;
}

export class LensPass extends ShaderPass {
  readonly lensUniforms: LensUniforms;

  constructor() {
    const uniforms = {
      inputBuffer: new Uniform(null),
      uCenter: new Uniform(new Vector2(0.5, 0.5)),
      uAspect: new Uniform(1),
      uEinsteinR: new Uniform(0),
      uEnabled: new Uniform(0),
    };
    super(new ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }), 'inputBuffer');
    this.lensUniforms = uniforms;
  }
}
