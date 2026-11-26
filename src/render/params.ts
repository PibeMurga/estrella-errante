export interface ViewParams {
  bloomIntensity: number;
  bloomThreshold: number;
  vignetteDarkness: number;
  nebulaIntensity: number;
  sunIntensity: number;
  lightIntensity: number;
  lensEnabled: boolean;
  einsteinScale: number;
  diskIntensity: number;
  blackHoleX: number;      // en coordenadas de la simulación
  blackHoleY: number;
  blackHoleRadius: number;
}

export const DEFAULT_PARAMS: ViewParams = {
  bloomIntensity: 0.95,
  bloomThreshold: 1.0,
  vignetteDarkness: 0.55,
  nebulaIntensity: 1,
  sunIntensity: 1.45,
  lightIntensity: 2.4,
  lensEnabled: true,
  einsteinScale: 1.6,
  diskIntensity: 2.6,
  blackHoleX: 70,
  blackHoleY: 45,
  blackHoleRadius: 5,
};
