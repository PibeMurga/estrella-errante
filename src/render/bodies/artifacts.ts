import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import { DEAD, KIND_ARTIFACT, type World } from '../../sim/world';
import type { Layer } from '../layer';

// Restos artificiales de otra civilización, muertos y a la deriva: cosas singulares, grandes, que no se parecen a nada
// natural. Cuatro clases: una sonda con paneles rotos, un pedazo de casco de nave (costillas, ventanillas y el borde
// arrancado), un tramo de anillo de una estación (con rayos cortados) y una antena parabólica gigante. Metal gastado,
// aislante dorado, paneles oscuros; nada brilla por sí solo (están apagados hace mucho), salvo un leve reflejo.

const metal = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.85, roughness: 0.38, emissive: 0x15171a });
const dark = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.7, roughness: 0.55 });
const panel = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x1b2a4a, metalness: 0.4, roughness: 0.25 });
const gold = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x9c7a35, metalness: 0.9, roughness: 0.3, emissive: 0x2a1e08 });
const hullMat = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x6f6a62, metalness: 0.75, roughness: 0.5, emissive: 0x0e0d0b });
const glass = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x0c1418, metalness: 0.2, roughness: 0.1, emissive: 0x05121a });

function probe(): Group {
  const g = new Group();
  const core = new Mesh(new BoxGeometry(0.9, 0.7, 0.7), gold()); g.add(core);
  const cap = new Mesh(new CylinderGeometry(0.28, 0.32, 0.5, 10), metal()); cap.position.set(0, 0.55, 0); g.add(cap);
  const p1 = new Mesh(new BoxGeometry(2.4, 0.04, 0.8), panel()); p1.position.set(-1.75, 0, 0); g.add(p1);
  const p2 = new Mesh(new BoxGeometry(1.1, 0.04, 0.8), panel()); p2.position.set(1.1, 0, 0.05); p2.rotation.z = 0.5; g.add(p2);
  const mast = new Mesh(new CylinderGeometry(0.03, 0.03, 1.4, 6), dark()); mast.position.set(0.2, -0.2, 0.7); mast.rotation.x = 1.1; g.add(mast);
  const dish = new Mesh(new ConeGeometry(0.45, 0.25, 16, 1, true), metal()); dish.position.set(0.2, -0.6, 1.25); dish.rotation.x = 2.2; g.add(dish);
  return g;
}

// Pedazo de casco: una placa curva (parte de un cilindro) con costillas por dentro, una fila de ventanillas y el borde
// arrancado (placas sueltas de distinto largo).
function hull(): Group {
  const g = new Group(), m = hullMat(), d = dark(), gl = glass();
  const skin = new Mesh(new CylinderGeometry(1.6, 1.6, 2.6, 18, 1, true, 0, Math.PI * 0.85), m); skin.material.side = 2; g.add(skin);
  for (let k = 0; k < 4; k++) {
    const rib = new Mesh(new TorusGeometry(1.5, 0.07, 6, 14, Math.PI * 0.85), d);
    rib.rotation.x = Math.PI / 2; rib.rotation.z = -Math.PI / 2; rib.position.y = -1 + k * 0.66; g.add(rib);
  }
  for (let k = 0; k < 6; k++) {
    const a = 0.25 + k * 0.33, win = new Mesh(new BoxGeometry(0.2, 0.32, 0.06), gl);
    win.position.set(Math.sin(a) * 1.62, 0.55, Math.cos(a) * 1.62); win.rotation.y = a; g.add(win);
  }
  for (let k = 0; k < 5; k++) {   // borde arrancado
    const a = 0.2 + k * 0.5, len = 0.4 + ((k * 37) % 5) * 0.18, pl = new Mesh(new BoxGeometry(0.42, len, 0.05), m);
    pl.position.set(Math.sin(a) * 1.6, 1.3 + len / 2, Math.cos(a) * 1.6); pl.rotation.set(0.25 * (k % 2 ? 1 : -1), a, 0.2); g.add(pl);
  }
  return g;
}

// Tramo de anillo de estación: un arco grueso con módulos, y rayos que iban al centro, cortados.
function ring(): Group {
  const g = new Group(), m = metal(), d = dark();
  const arc = new Mesh(new TorusGeometry(2.2, 0.32, 10, 28, Math.PI * 0.9), m); g.add(arc);
  for (let k = 0; k < 5; k++) {
    const a = 0.15 + k * 0.6, mod = new Mesh(new BoxGeometry(0.7, 0.55, 0.55), k % 2 ? d : gold());
    mod.position.set(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0); mod.rotation.z = a; g.add(mod);
  }
  for (let k = 0; k < 3; k++) {
    const a = 0.4 + k * 0.9, sp = new Mesh(new CylinderGeometry(0.07, 0.07, 1.3 - k * 0.25, 6), d);
    sp.position.set(Math.cos(a) * (1.5 + k * 0.1), Math.sin(a) * (1.5 + k * 0.1), 0); sp.rotation.z = a + Math.PI / 2; g.add(sp);
  }
  return g;
}

// Antena parabólica gigante: el plato (con un sector roto), el foco sobre tres patas y la base.
function dishAntenna(): Group {
  const g = new Group(), m = metal(), d = dark();
  const plate = new Mesh(new CylinderGeometry(2.1, 0.5, 0.7, 24, 1, true, 0, Math.PI * 1.7), m); plate.material.side = 2; g.add(plate);
  const back = new Mesh(new CylinderGeometry(0.5, 0.5, 0.3, 12), d); back.position.y = -0.45; g.add(back);
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1, leg = new Mesh(new CylinderGeometry(0.04, 0.04, 2.0, 5), d);
    leg.position.set(Math.cos(a) * 0.7, 1.0, Math.sin(a) * 0.7); leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(leg);
  }
  const focus = new Mesh(new CylinderGeometry(0.18, 0.12, 0.35, 8), gold()); focus.position.y = 1.95; g.add(focus);
  const base = new Mesh(new BoxGeometry(0.8, 0.6, 0.8), gold()); base.position.y = -0.85; g.add(base);
  return g;
}

// Clase de cada resto (por su índice) y cuánto más grande se dibuja que su radio de juego.
const MODELS = [hull, ring, dishAntenna, probe];
const SCALE = [1.5, 1.35, 1.45, 0.9];

export function createArtifactsLayer(world: World): Layer {
  const group = new Group();
  const items: { body: number; g: Group; ax: number; ay: number; az: number; sc: number }[] = [];
  let n = 0;
  for (let i = 0; i < world.count; i++) {
    if (world.kind[i] !== KIND_ARTIFACT) continue;
    const h = (k: number): number => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    const model = (n + Math.floor(h(9) * 4)) % MODELS.length;
    n++;
    const g = MODELS[model]!();
    g.traverse((o) => { o.frustumCulled = false; });
    group.add(g);
    items.push({ body: i, g, ax: (h(1) - 0.5) * 0.3, ay: (h(2) - 0.5) * 0.25, az: (h(3) - 0.5) * 0.3, sc: SCALE[model]! });
  }

  return {
    object: group,
    update(ctx) {
      const w = ctx.world, a = ctx.alpha;
      for (let k = 0; k < items.length; k++) {
        const it = items[k]!, i = it.body;
        it.g.visible = w.state[i] !== DEAD;
        if (!it.g.visible) continue;
        it.g.position.set(w.prevX[i] + (w.x[i] - w.prevX[i]) * a, 0.6, -(w.prevY[i] + (w.y[i] - w.prevY[i]) * a));
        it.g.rotation.set(ctx.time * it.ax + i, ctx.time * it.ay, ctx.time * it.az);
        it.g.scale.setScalar(w.radius[i] * it.sc);
      }
    },
  };
}
