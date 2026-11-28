import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { DEAD, KIND_ARTIFACT, type World } from '../../sim/world';
import type { Layer } from '../layer';

// Restos artificiales de otra civilización, muertos y a la deriva: cosas singulares, grandes, que no se parecen a nada
// natural, de cualquier civilización. Cuatro clases: una nave chica con alas de paneles solares, una chapa suelta, una
// antena parabólica con un sector roto y una sonda con paneles rotos. Metal gastado,
// aislante dorado, paneles oscuros; nada brilla por sí solo (están apagados hace mucho), salvo un leve reflejo.

const metal = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.85, roughness: 0.38, emissive: 0x15171a });
const dark = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.7, roughness: 0.55 });
const panel = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x1b2a4a, metalness: 0.4, roughness: 0.25 });
const gold = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x9c7a35, metalness: 0.9, roughness: 0.3, emissive: 0x2a1e08 });
const hullMat = (): MeshStandardMaterial => new MeshStandardMaterial({ color: 0x6f6a62, metalness: 0.75, roughness: 0.5, emissive: 0x0e0d0b });

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

// Nave chica (genérica, de cualquier civilización): un módulo cilíndrico con su escudo trasero, un módulo esférico
// adelante, dos alas de paneles solares por segmentos (con marco) y un par de antenas.
function craft(): Group {
  const g = new Group(), m = metal(), d = dark(), pn = panel(), gd = gold();
  const body = new Mesh(new CylinderGeometry(0.55, 0.55, 1.2, 18), m); body.rotation.z = Math.PI / 2; g.add(body);
  const shield = new Mesh(new CylinderGeometry(0.72, 0.72, 0.12, 22), d); shield.rotation.z = Math.PI / 2; shield.position.x = -0.66; g.add(shield);
  const nozzle = new Mesh(new ConeGeometry(0.22, 0.3, 12, 1, true), d); nozzle.rotation.z = Math.PI / 2; nozzle.position.x = -0.85; g.add(nozzle);
  const neck = new Mesh(new CylinderGeometry(0.28, 0.4, 0.3, 14), gd); neck.rotation.z = Math.PI / 2; neck.position.x = 0.73; g.add(neck);
  const orb = new Mesh(new SphereGeometry(0.5, 18, 12), m); orb.position.x = 1.15; orb.scale.set(1, 0.9, 0.9); g.add(orb);
  for (const side of [-1, 1]) {   // alas: 4 segmentos cada una, con marco
    const arm = new Mesh(new CylinderGeometry(0.03, 0.03, 0.4, 5), d); arm.position.set(-0.1, 0, side * 0.75); arm.rotation.x = Math.PI / 2; g.add(arm);
    for (let k = 0; k < 4; k++) {
      const seg = new Mesh(new BoxGeometry(0.62, 0.02, 0.42), pn); seg.position.set(-0.1, 0, side * (1.2 + k * 0.46)); g.add(seg);
      const fr = new Mesh(new BoxGeometry(0.66, 0.03, 0.03), d); fr.position.set(-0.1, 0.005, side * (1.2 + k * 0.46 + 0.22)); g.add(fr);
    }
  }
  const dish = new Mesh(new ConeGeometry(0.18, 0.09, 14, 1, true), m); dish.position.set(1.15, 0.55, 0); dish.rotation.z = Math.PI; g.add(dish);
  const ant = new Mesh(new CylinderGeometry(0.015, 0.015, 0.6, 4), d); ant.position.set(0.3, 0.5, 0.2); ant.rotation.x = 0.4; g.add(ant);
  return g;
}

// Una chapa suelta: una placa de metal apenas curvada, con remaches en el borde y una esquina arrancada.
function plate(): Group {
  const g = new Group(), m = hullMat(), d = dark();
  const sheet = new Mesh(new CylinderGeometry(3, 3, 1.4, 10, 1, true, 0, 0.55), m); sheet.material.side = 2; sheet.position.z = -3; g.add(sheet);
  for (let k = 0; k < 7; k++) {
    const a = 0.04 + k * 0.075, rv = new Mesh(new SphereGeometry(0.035, 5, 4), d);
    rv.position.set(Math.sin(a) * 3.02, 0.62, Math.cos(a) * 3.02 - 3); g.add(rv);
  }
  const torn = new Mesh(new BoxGeometry(0.4, 0.5, 0.03), m); torn.position.set(Math.sin(0.5) * 3.05, -0.55, Math.cos(0.5) * 3.05 - 3); torn.rotation.set(0.5, 0.5, 0.6); g.add(torn);
  g.children.forEach((c) => { c.position.z += 3; });   // centrada en su propio medio
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
const MODELS = [craft, plate, dishAntenna, probe];
const SCALE = [1.1, 0.8, 0.8, 0.9];

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
