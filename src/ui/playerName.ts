// Nombre del cuerpo del jugador (el que elige al empezar; lo acompaña de planeta a agujero negro).
// Hasta que exista la pantalla para elegirlo, se lee de lo guardado o se usa uno provisorio.
const KEY = 'magnar.nombre';

export function playerName(): string {
  try { const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null; if (v && v.trim()) return v.trim().toUpperCase().slice(0, 18); } catch { /* sin almacenamiento */ }
  return 'TU ESTRELLA';
}
