// Etapas de la estrella del jugador según su masa. Los umbrales son una "decisión a revisar" con Lucas.
export interface Stage { readonly name: string; readonly mass: number }

export const STAGES: readonly Stage[] = [
  { name: 'ENANA ROJA', mass: 0 },
  { name: 'ENANA AMARILLA', mass: 25 },
  { name: 'ENANA BLANCA', mass: 80 },
  { name: 'GIGANTE AZUL', mass: 200 },
  { name: 'SUPERGIGANTE', mass: 450 },
];

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
