// Nombre del cuerpo del jugador: lo elige al empezar y lo acompaña de planeta a agujero negro. Se guarda en el equipo.
import { GAS_TYPES } from '../render/playerLook';

const KEY = 'magnar.nombre';
export const NAME_MAX = 16;

// Sugerencias: nombres inventados, cortos, que suenan bien en español y en inglés.
const SUGGESTIONS = ['TÁURIDE', 'OSSIRAN', 'VELKOR', 'AMARIS', 'KORVEN', 'ILIARA', 'DRAVEN', 'SOLANE', 'TERVAN', 'ORIVEL', 'KAELIS', 'MIRDAN', 'ZEPHRA', 'NOVIAN', 'ARKEN', 'LIVARA'];

export function suggestName(): string {
  return SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)]!;
}

// Limpio: sin espacios a los lados, en mayúsculas y con largo máximo. Vacío si no queda nada.
export function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase().slice(0, NAME_MAX);
}

export function savedName(): string {
  try { const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null; return v ? cleanName(v) : ''; } catch { return ''; }
}

export function setPlayerName(name: string): string {
  const n = cleanName(name) || suggestName();
  try { localStorage.setItem(KEY, n); } catch { /* sin almacenamiento */ }
  current = n;
  return n;
}

// Tipo de gaseoso con el que arrancás (índice en GAS_TYPES).
const TYPE_KEY = 'magnar.tipo';
export function savedPlanetType(): number {
  try { const v = Number(localStorage.getItem(TYPE_KEY)); return Number.isInteger(v) && v >= 0 && v < GAS_TYPES.length ? v : 0; } catch { return 0; }
}
export function setPlanetType(t: number): void {
  try { localStorage.setItem(TYPE_KEY, String(t)); } catch { /* sin almacenamiento */ }
}

let current = '';
export function playerName(): string {
  return current || savedName() || 'TU MUNDO';
}
