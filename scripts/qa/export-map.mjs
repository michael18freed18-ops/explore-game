import { writeFileSync } from "node:fs";
import { getWorld } from "../../src/game/world/catalog.js";
import { HALF, WATER, sampleInto } from "../../src/game/world/sample.js";
import { encodePNG } from "./png.mjs";

const omit = new Set(
  (process.argv.find((a) => a.startsWith("--omit=")) || "")
    .slice(7)
    .split(",")
    .filter(Boolean)
    .map(Number),
);

const world = getWorld();
const S = 1024;
const rgba = new Uint8Array(S * S * 4);
const tmp = { y: 0, biome: "meadow", moisture: 0, temp: 0 };
const rgb = {
  meadow: [158, 176, 104],
  forest: [62, 112, 74],
  desert: [214, 184, 112],
  snow: [226, 232, 236],
  shore: [214, 196, 156],
  swamp: [86, 104, 74],
  autumn: [186, 112, 58],
  lake: [48, 116, 142],
};

for (let y = 0; y < S; y++) {
  const z = HALF - ((y + 0.5) / S) * HALF * 2;
  for (let x = 0; x < S; x++) {
    const wx = -HALF + ((x + 0.5) / S) * HALF * 2;
    sampleInto(wx, z, tmp);
    const key = tmp.biome === "shore" && tmp.y < WATER ? "lake" : tmp.biome;
    const c = rgb[key] || rgb.meadow;
    const i = (y * S + x) * 4;
    rgba[i] = c[0];
    rgba[i + 1] = c[1];
    rgba[i + 2] = c[2];
    rgba[i + 3] = 255;
  }
}

function plot(wx, wz, color, rad) {
  const x = Math.round(((wx + HALF) / (HALF * 2)) * (S - 1));
  const y = Math.round(((HALF - wz) / (HALF * 2)) * (S - 1));
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= S || py >= S) continue;
      const i = (py * S + px) * 4;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = 255;
    }
  }
}

let markers = 0;
for (const t of world.treasures) {
  if (omit.has(t.id)) continue;
  const color = t.kind === "relic" ? [180, 40, 50] : t.kind === "chest" ? [230, 200, 60] : [250, 250, 250];
  plot(t.mapX, t.mapZ, color, t.kind === "trinket" ? 2 : 4);
  markers++;
}
for (const lm of world.landmarks) plot(lm.x, lm.z, [20, 40, 120], 5);
plot(world.spawn.x, world.spawn.z, [20, 20, 20], 6);

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) || "/workspace/screenshots/world-map.png";
writeFileSync(out, encodePNG(S, S, rgba));

const list = world.treasures.map((t) => ({
  id: t.id,
  kind: t.kind,
  biome: t.biome,
  x: Math.round(t.x * 10) / 10,
  y: Math.round(t.y * 10) / 10,
  z: Math.round(t.z * 10) / 10,
  mapX: Math.round(t.mapX),
  mapZ: Math.round(t.mapZ),
  caveId: t.caveId,
  landmarkId: t.landmarkId,
}));
if (!omit.size) {
  writeFileSync("/workspace/screenshots/treasures.json", JSON.stringify({ spawn: world.spawn, markers, list }, null, 2));
}
console.log(JSON.stringify({ out, markers, treasures: world.treasures.length, omitted: [...omit] }));
