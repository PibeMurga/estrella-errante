export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualitySettings {
  level: QualityLevel;
  dprCap: number;
  starCount: number;       // estrellas de fondo
  planetSegments: number;
  planetOctaves: number;   // detalle de superficie de los planetas
  skyOctaves: number;      // detalle de la nebulosa
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  low: { level: 'low', dprCap: 1, starCount: 3000, planetSegments: 48, planetOctaves: 4, skyOctaves: 3 },
  medium: { level: 'medium', dprCap: 1.5, starCount: 6000, planetSegments: 80, planetOctaves: 6, skyOctaves: 4 },
  high: { level: 'high', dprCap: 2, starCount: 9000, planetSegments: 128, planetOctaves: 8, skyOctaves: 5 },
};

export function lowerQuality(level: QualityLevel): QualityLevel | null {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return null;
}
