// Aspecto elegido para tu cuerpo: el tipo de gaseoso con el que arrancás. Lo fija la pantalla del nombre.
// Todos son reales: colores de gigantes gaseosos conocidos.
export interface GasType { readonly name: string; readonly note: string; readonly colors: readonly [string, string, string]; readonly glow: number }

export const GAS_TYPES: readonly GasType[] = [
  { name: 'OCRE', note: 'COMO JÚPITER', colors: ['#c39a6b', '#eadbc0', '#8f5f3e'], glow: 0 },
  { name: 'CREMA', note: 'COMO SATURNO', colors: ['#d6c296', '#f2e8cc', '#b0925c'], glow: 0 },
  { name: 'AZUL', note: 'COMO NEPTUNO', colors: ['#3f68b4', '#86aee4', '#26407c'], glow: 0 },
  { name: 'CELESTE', note: 'COMO URANO', colors: ['#8fd3dc', '#c4eef0', '#6bb3c0'], glow: 0 },
  { name: 'MAGENTA', note: 'COMO GJ 504 b, JOVEN Y CALIENTE', colors: ['#a3527a', '#d58fae', '#6e2c4f'], glow: 0.25 },
  { name: 'BRASA', note: 'UN JÚPITER CALIENTE', colors: ['#3a2a28', '#5a3a30', '#1e1414'], glow: 0.6 },
];

export const playerLook = { planetType: 0 };
