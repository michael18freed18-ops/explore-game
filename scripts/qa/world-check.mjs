import { assessWorld, getWorld } from "../../src/game/world/catalog.js";
import { BIOMES } from "../../src/game/world/sample.js";

const world = getWorld();
const report = assessWorld(world);
const reach = world.reach;
const nav = world.nav;
let land = 0;
let reached = 0;
const biomeReach = Object.fromEntries(BIOMES.map((b) => [b, 0]));
const biomeAll = Object.fromEntries(BIOMES.map((b) => [b, 0]));
for (let k = 0; k < reach.length; k++) {
  const b = BIOMES[nav.biome[k]];
  biomeAll[b]++;
  if (nav.h[k] >= 19.7) land++;
  if (reach[k]) {
    reached++;
    biomeReach[b]++;
  }
}
const treasureBiomes = {};
for (const t of world.treasures) treasureBiomes[t.biome] = (treasureBiomes[t.biome] || 0) + 1;
const summary = {
  ms: world.ms,
  ok: report.ok,
  problems: report.problems.slice(0, 30),
  problemCount: report.problems.length,
  kinds: report.kinds,
  spawn: world.spawn,
  reached,
  land,
  reachPct: Math.round((reached / Math.max(1, land)) * 1000) / 10,
  biomeReach,
  biomeAll,
  treasureBiomes,
  landmarks: world.landmarks.map((l) => ({
    name: l.name,
    biome: l.biome,
    nearby: l.nearby,
    x: Math.round(l.x),
    z: Math.round(l.z),
  })),
  caves: world.caves.map((c) => ({
    id: c.id,
    biome: c.biome,
    x: Math.round(c.x),
    z: Math.round(c.z),
    y: Math.round(c.y),
  })),
};
console.log(JSON.stringify(summary, null, 2));
if (!report.ok) process.exit(1);
