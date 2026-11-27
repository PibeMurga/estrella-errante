import type { World } from './world';

// Mejoras: cada vez que subís de etapa, se pausa la partida y elegís una entre tres al azar. Cada una se puede tomar
// hasta tres veces (se acumula). Los efectos los leen los sistemas con upg(w, ID).

export const U_MAGNET = 0, U_SPIN = 1, U_BOLT = 2, U_CHARGE = 3, U_ARMOR = 4, U_REGEN = 5, U_SLING = 6, U_DENSE = 7,
  U_WAKE = 8, U_ANCHOR = 9, U_REPEL = 10, U_TIDE = 11;
export const UPGRADE_COUNT = 12;
export const UPGRADE_MAX = 3;

export interface UpgradeInfo { readonly name: string; readonly desc: string }
export const UPGRADES: readonly UpgradeInfo[] = [
  { name: 'IMÁN', desc: 'Tu gravedad atrae más fuerte y desde más lejos' },
  { name: 'CINTURÓN VELOZ', desc: 'Tu órbita gira un 25 % más rápido' },
  { name: 'BÓLIDO MAYOR', desc: '8 asteroides más en cada bólido' },
  { name: 'CARGA RÁPIDA', desc: 'Juntás asteroides un 40 % más rápido' },
  { name: 'CORAZA', desc: 'Perdés un 22 % menos en los choques' },
  { name: 'REGENERACIÓN', desc: 'La resistencia se recarga un 60 % más rápido' },
  { name: 'HONDA PESADA', desc: 'La honda hace el doble de daño' },
  { name: 'MASA DENSA', desc: 'Cada cuerpo que atrapás suma un 15 % más de masa' },
  { name: 'ESTELA', desc: 'Te movés un 12 % más rápido' },
  { name: 'ANCLA', desc: 'El agujero negro te tira un 20 % menos' },
  { name: 'REPELENTE', desc: 'Los cometas tardan más en llegar y roban menos' },
  { name: 'MAREA PROPIA', desc: 'Les robás lunas y anillos a tus planetas el doble de rápido' },
];

// Nivel de una mejora (0 a 3).
export const upg = (w: World, id: number): number => w.upg[id]!;

// Ofrece tres mejoras distintas al azar (entre las que todavía se pueden subir). Si no queda ninguna, no ofrece.
export function offerUpgrades(w: World): void {
  let avail = 0;
  for (let k = 0; k < UPGRADE_COUNT; k++) if (w.upg[k]! < UPGRADE_MAX) avail++;
  if (avail === 0) return;
  const n = Math.min(3, avail);
  w.offer.fill(-1);
  for (let k = 0; k < n; k++) {
    for (let tries = 0; tries < 50; tries++) {
      const id = Math.floor(w.rng.next() * UPGRADE_COUNT);
      if (w.upg[id]! >= UPGRADE_MAX || w.offer[0] === id || w.offer[1] === id || w.offer[2] === id) continue;
      w.offer[k] = id;
      break;
    }
  }
  w.choosing = true;
}

// Toma la mejora k (0 a 2) de las ofrecidas y sigue la partida.
export function chooseUpgrade(w: World, k: number): void {
  if (!w.choosing) return;
  const id = w.offer[k]!;
  if (id < 0) return;
  w.upg[id] = Math.min(UPGRADE_MAX, w.upg[id]! + 1);
  w.upgradesTaken++;
  w.choosing = false;
  w.offer.fill(-1);
}
