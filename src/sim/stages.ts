// Etapas de la estrella del jugador según su masa. La última es la hipergigante: desde ahí se puede colapsar.
export interface Stage { readonly name: string; readonly mass: number }

// De planeta gaseoso a hipergigante. Antes de la ignición sos un planeta (no brillás); en IGNITION_MASS se enciende
// la fusión y nace tu estrella. «Estrella blanca» (y no «enana blanca»: esa es una estrella muerta).
export const STAGES: readonly Stage[] = [
  { name: 'PLANETA GASEOSO', mass: 0 },
  { name: 'GIGANTE GASEOSO', mass: 8 },
  { name: 'ENANA MARRÓN', mass: 18 },
  { name: 'ENANA ROJA', mass: 30 },
  { name: 'ENANA AMARILLA', mass: 70 },
  { name: 'ESTRELLA BLANCA', mass: 120 },
  { name: 'GIGANTE AZUL', mass: 175 },
  { name: 'SUPERGIGANTE', mass: 235 },
  { name: 'HIPERGIGANTE', mass: 310 },
];

// Masa en la que se enciende la fusión (la enana roja) y su índice de etapa.
export const IGNITION_MASS = 30;
export const STAGE_IGNITION = 3;
// Índice de la hipergigante: la única etapa desde la que se puede colapsar.
export const STAGE_HYPER = 8;

export function stageFor(mass: number): number {
  if (!(mass > 0)) return 0;
  let s = 0;
  for (let i = 1; i < STAGES.length; i++) if (mass >= STAGES[i]!.mass) s = i;
  return s;
}

// Cuánto avanzó dentro de la etapa actual (0 a 1). En la última etapa es 1.
export function stageProgress(mass: number): number {
  const s = stageFor(mass);
  if (s >= STAGES.length - 1) return 1;
  const lo = STAGES[s]!.mass, hi = STAGES[s + 1]!.mass;
  return Math.min(1, Math.max(0, ((mass > 0 ? mass : 0) - lo) / (hi - lo)));
}
