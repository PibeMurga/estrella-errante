import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { DEAD, KIND_ARTIFACT, type World } from '../../sim/world';
import type { Layer } from '../layer';

// Restos artificiales: piezas de una sonda o un satélite de otra civilización, muertas y a la deriva. Un cuerpo de metal
// gastado, un panel solar roto (uno entero y otro a medias), una antena y un mástil. Giran despacio sobre sí mismos y,
// al recibir la luz, el metal destella apenas. Nada brilla por sí solo: están apagados hace mucho.

export function createArtifactsLayer(world: World): Layer {
  const group = new Group();
  const metal = new MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.85, roughness: 0.38, emissive: 0x15171a });
  const dark = new MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.7, roughness: 0.55 });
  const panel = new MeshStandardMaterial({ color: 0x1b2a4a, metalness: 0.4, roughness: 0.25, emissive: 0x000000 });
  const gold = new MeshStandardMaterial({ color: 0x9c7a35, metalness: 0.9, roughness: 0.3, emissive: 0x2a1e08 });   // aislante térmico dorado (un leve reflejo propio: que se distinga con poca luz)
  const items: { body: number; g: Group; ax: number; ay: number; az: number }[] = [];
  for (let i = 0; i < world.count; i++) {
    if (world.kind[i] !== KIND_ARTIFACT) continue;
    const g = new Group();
    const core = new Mesh(new BoxGeometry(0.9, 0.7, 0.7), gold); g.add(core);
    const cap = new Mesh(new CylinderGeometry(0.28, 0.32, 0.5, 10), metal); cap.position.set(0, 0.55, 0); g.add(cap);
    const p1 = new Mesh(new BoxGeometry(2.4, 0.04, 0.8), panel); p1.position.set(-1.75, 0, 0); g.add(p1);
    const p2 = new Mesh(new BoxGeometry(1.1, 0.04, 0.8), panel); p2.position.set(1.1, 0, 0.05); p2.rotation.z = 0.5; g.add(p2);   // roto, torcido
    const mast = new Mesh(new CylinderGeometry(0.03, 0.03, 1.4, 6), dark); mast.position.set(0.2, -0.2, 0.7); mast.rotation.x = 1.1; g.add(mast);
    const dish = new Mesh(new ConeGeometry(0.45, 0.25, 16, 1, true), metal); dish.position.set(0.2, -0.6, 1.25); dish.rotation.x = 2.2; g.add(dish);
    g.traverse((o) => { o.frustumCulled = false; });
    group.add(g);
    const h = (k: number): number => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    items.push({ body: i, g, ax: (h(1) - 0.5) * 0.4, ay: (h(2) - 0.5) * 0.3, az: (h(3) - 0.5) * 0.35 });
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
        it.g.scale.setScalar(w.radius[i] * 0.9);
      }
    },
  };
}
