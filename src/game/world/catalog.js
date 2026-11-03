// @ts-nocheck
/**
 * Landmarks, caves, and the 150 treasures. Pure data — no Three.js.
 * Same output in the browser and in the Node checks.
 */
import {
  BIOMES,
  HALF,
  MAX_CLIMB,
  SEED,
  WATER,
  sample,
  sampleInto,
} from "./sample.js";
import { biomeAtCell, buildNav, cellCenter, cellOf, flood, inGrid } from "./nav.js";

export const LANDMARK_TYPES = [
  { type: "peak", name: "Central Peak", biome: "snow", fixed: true },
  { type: "great-tree", name: "The Great Tree", biome: "forest" },
  { type: "desert-arch", name: "Sun Arch", biome: "desert" },
  { type: "frozen-tower", name: "Frozen Tower", biome: "snow" },
  { type: "waterfall", name: "Veil Falls", biome: "forest" },
  { type: "ruined-bridge", name: "Ruined Bridge", biome: "meadow" },
  { type: "stone-circle", name: "Stone Circle", biome: "meadow" },
  { type: "autumn-spire", name: "Amber Spire", biome: "autumn" },
  { type: "swamp-lanterns", name: "Lantern Marsh", biome: "swamp" },
  { type: "wreck", name: "The Beached Hull", biome: "shore" },
  { type: "mesa", name: "Red Mesa", biome: "desert" },
  { type: "glacier", name: "Glass Shelf", biome: "snow" },
  { type: "hollow-oak", name: "Hollow Oak", biome: "forest" },
  { type: "menhirs", name: "Twin Menhirs", biome: "meadow" },
  { type: "aqueduct", name: "Fallen Aqueduct", biome: "meadow" },
  { type: "windmill", name: "Windmill Ruin", biome: "meadow" },
  { type: "needle", name: "Obsidian Needle", biome: "snow" },
  { type: "lilies", name: "Lily Stones", biome: "swamp" },
  { type: "canyon-gate", name: "Canyon Gate", biome: "desert" },
  { type: "pine-ring", name: "Pine Cathedral", biome: "forest" },
  { type: "cairn", name: "Shepherd's Cairn", biome: "meadow" },
  { type: "colonnade", name: "Amber Colonnade", biome: "autumn" },
  { type: "tide", name: "Tide Pools", biome: "shore" },
  { type: "watchtower", name: "Watchfire", biome: "forest" },
];

let cached = null;

export function getWorld() {
  if (!cached) cached = generateWorld();
  return cached;
}

/** Test hook. Pass null to rebuild on the next getWorld(). */
export function setWorldForTests(world) {
  cached = world;
}

let placementMode = "scatter";

export function setPlacementMode(mode) {
  placementMode = mode === "row" ? "row" : "scatter";
  cached = null;
}

export function getPlacementMode() {
  return placementMode;
}

function rand(n) {
  let x = Math.imul(n ^ SEED, 0x27bb2ee6);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

function tooClose(list, x, z, min = 40) {
  const m2 = min * min;
  for (let i = 0; i < list.length; i++) {
    const dx = list[i].x - x;
    const dz = list[i].z - z;
    if (dx * dx + dz * dz < m2) return true;
  }
  return false;
}

function pickSpawn(nav) {
  let best = null;
  let bestScore = Infinity;
  for (let j = 0; j < nav.rows; j++) {
    for (let i = 0; i < nav.cols; i++) {
      const k = j * nav.cols + i;
      if (biomeAtCell(nav, i, j) !== "meadow") continue;
      const [x, z] = cellCenter(nav, i, j);
      const d = Math.hypot(x, z);
      if (d < 1050 || d > 1750) continue;
      const y = nav.h[k];
      if (y < 26 || y > 70) continue;
      let steep = 0;
      let ok = true;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ni = i + di;
        const nj = j + dj;
        if (!inGrid(nav, ni, nj)) {
          ok = false;
          break;
        }
        const slope = Math.abs(nav.h[nj * nav.cols + ni] - y) / nav.cell;
        steep = Math.max(steep, slope);
      }
      if (!ok || steep > 0.25) continue;
      const score = Math.abs(d - 1400) + Math.abs(Math.atan2(z, x) - 0.7) * 400 + steep * 80;
      if (score < bestScore) {
        bestScore = score;
        best = { i, j, x, z, y };
      }
    }
  }
  if (!best) {
    best = { i: 200, j: 230, x: 10, z: 610, y: sample(10, 610).y };
  }
  return best;
}

function placeLandmarks(nav, reach) {
  const placed = [];
  for (let n = 0; n < LANDMARK_TYPES.length; n++) {
    const spec = LANDMARK_TYPES[n];
    if (spec.fixed) {
      const s = sample(0, 0);
      placed.push({
        id: n,
        type: spec.type,
        name: spec.name,
        x: 0,
        z: 0,
        y: s.y,
        biome: s.biome,
        yaw: 0,
      });
      continue;
    }
    let best = null;
    let bestScore = -Infinity;
    for (let j = 2; j < nav.rows - 2; j += 2) {
      for (let i = 2; i < nav.cols - 2; i += 2) {
        const k = j * nav.cols + i;
        if (!reach[k]) continue;
        if (biomeAtCell(nav, i, j) !== spec.biome) continue;
        const [x, z] = cellCenter(nav, i, j);
        const y = nav.h[k];
        if (y < WATER + 0.4) continue;
        const border = Math.min(HALF - Math.abs(x), HALF - Math.abs(z));
        if (border < 420) continue;
        const ring = Math.hypot(x, z);
        if (spec.biome !== "snow" && ring < 800) continue;
        let minD = 1e9;
        for (let p = 0; p < placed.length; p++) {
          minD = Math.min(minD, Math.hypot(placed[p].x - x, placed[p].z - z));
        }
        if (minD < 760) continue;
        let flat = 0;
        for (const [di, dj] of [
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
        ]) {
          flat += Math.abs(nav.h[(j + dj) * nav.cols + (i + di)] - y);
        }
        const wantsCliff = spec.type === "waterfall" || spec.type === "frozen-tower" || spec.type === "canyon-gate";
        const cliff = wantsCliff ? flat : -flat * 0.15;
        const ringScore = ring > 900 && ring < 3400 ? 240 : 0;
        const score = minD * 0.2 + ringScore + cliff + rand(n * 917 + i * 13 + j) * 40;
        if (score > bestScore) {
          bestScore = score;
          best = { x, z, y };
        }
      }
    }
    if (!best) {
      for (let j = 2; j < nav.rows - 2 && !best; j += 2) {
        for (let i = 2; i < nav.cols - 2; i += 2) {
          const k = j * nav.cols + i;
          if (!reach[k]) continue;
          if (biomeAtCell(nav, i, j) !== spec.biome) continue;
          const [x, z] = cellCenter(nav, i, j);
          let minD = 1e9;
          for (let p = 0; p < placed.length; p++) {
            minD = Math.min(minD, Math.hypot(placed[p].x - x, placed[p].z - z));
          }
          if (minD < 480) continue;
          best = { x, z, y: nav.h[k] };
          break;
        }
      }
    }
    if (!best) best = { x: Math.cos(n) * 2000, z: Math.sin(n * 1.7) * 2000, y: 30 };
    const s = sample(best.x, best.z);
    placed.push({
      id: n,
      type: spec.type,
      name: spec.name,
      x: best.x,
      z: best.z,
      y: s.y,
      biome: s.biome,
      yaw: rand(n * 77) * Math.PI * 2,
    });
  }
  return placed;
}

function placeCaves(nav, reach) {
  const caves = [];
  for (let sector = 0; sector < 10; sector++) {
    let best = null;
    let bestScore = -Infinity;
    for (let j = 1; j < nav.rows - 1; j += 2) {
      for (let i = 1; i < nav.cols - 1; i += 2) {
        const k = j * nav.cols + i;
        if (!reach[k]) continue;
        const y = nav.h[k];
        if (y < WATER + 1) continue;
        const [x, z] = cellCenter(nav, i, j);
        if (Math.min(HALF - Math.abs(x), HALF - Math.abs(z)) < 450) continue;
        const ang = Math.atan2(z, x);
        const sec = Math.floor((((ang + Math.PI) / (Math.PI * 2)) * 10) % 10);
        if (sec !== sector) continue;
        if (Math.hypot(x, z) < 900) continue;
        let upI = 0;
        let upJ = 0;
        let rise = 0;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nk = (j + dj) * nav.cols + (i + di);
          if (!reach[nk]) continue;
          const dy = nav.h[nk] - y;
          const slope = dy / nav.cell;
          if (slope > rise) {
            rise = slope;
            upI = di;
            upJ = dj;
          }
        }
        if (rise < Math.tan((34 * Math.PI) / 180) || rise > MAX_CLIMB) continue;
        let crowded = false;
        for (const c of caves) {
          const dx = c.x - x;
          const dz = c.z - z;
          if (dx * dx + dz * dz < 700 * 700) crowded = true;
        }
        if (crowded) continue;
        const score = rise * 40 + rand(sector * 333 + i + j * 17) * 5 + Math.min(y, 80) * 0.01;
        if (score > bestScore) {
          bestScore = score;
          best = { x, z, y, upI, upJ, rise };
        }
      }
    }
    if (!best) {
      const ang = -Math.PI + ((sector + 0.5) / 10) * Math.PI * 2;
      const x = Math.cos(ang) * 2200;
      const z = Math.sin(ang) * 2200;
      const cell = cellOf(nav, x, z);
      best = { x, z, y: sample(x, z).y, upI: 0, upJ: 1, rise: 0.8, fallback: true, cell };
    }
    const s = sample(best.x, best.z);
    const yaw = Math.atan2(best.upI, best.upJ);
    caves.push({
      id: sector,
      x: best.x,
      z: best.z,
      y: s.y,
      biome: s.biome,
      yaw,
      intoX: best.upI,
      intoZ: best.upJ,
    });
  }
  return caves;
}

export function caveOrigin(id) {
  return { x: 14000 + id * 500, z: 0 };
}

function candidatesNear(nav, reach, x, z, minR, maxR) {
  const c0 = cellOf(nav, x, z);
  const rad = Math.ceil(maxR / nav.cell) + 1;
  const out = [];
  for (let dj = -rad; dj <= rad; dj++) {
    for (let di = -rad; di <= rad; di++) {
      const i = c0.i + di;
      const j = c0.j + dj;
      if (!inGrid(nav, i, j)) continue;
      const k = j * nav.cols + i;
      if (!reach[k]) continue;
      const y = nav.h[k];
      if (y < WATER + 0.3) continue;
      const [cx, cz] = cellCenter(nav, i, j);
      const dist = Math.hypot(cx - x, cz - z);
      if (dist < minR || dist > maxR) continue;
      let hide = 0;
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nk = (j + b) * nav.cols + (i + a);
        if (nk >= 0 && nk < nav.h.length) hide = Math.max(hide, nav.h[nk] - y);
      }
      out.push({ x: cx, z: cz, y, hide, dist, i, j });
    }
  }
  return out;
}

function borderOf(x, z) {
  return Math.min(HALF - Math.abs(x), HALF - Math.abs(z));
}

function placeOutdoor(outdoor, spot, kind, variant, landmarkId) {
  const s = sample(spot.x, spot.z);
  outdoor.push({
    kind,
    variant,
    x: spot.x,
    z: spot.z,
    y: s.y + (kind === "chest" ? 0.55 : 0.7),
    biome: s.biome,
    landmarkId,
    caveId: null,
    mapX: spot.x,
    mapZ: spot.z,
  });
}

function placeTreasuresRow(nav, reach, landmarks, caves) {
  const outdoor = [];
  for (let li = 0; li < landmarks.length; li++) {
    const lm = landmarks[li];
    const n = 1 + Math.floor(rand(li * 19 + 4) * 3);
    let pool = candidatesNear(nav, reach, lm.x, lm.z, 42, 180);
    if (pool.length < n) pool = candidatesNear(nav, reach, lm.x, lm.z, 36, 280);
    pool.sort((a, b) => b.hide - a.hide || a.i - b.i || a.j - b.j);
    let got = 0;
    for (let c = 0; c < pool.length && got < n; c++) {
      const spot = pool[c];
      if (tooClose(outdoor, spot.x, spot.z, 40)) continue;
      const chests = outdoor.filter((t) => t.kind === "chest").length;
      const kind = chests < 20 && got === 0 ? "chest" : "trinket";
      const trinkets = outdoor.filter((t) => t.kind === "trinket").length;
      if (kind === "trinket" && trinkets >= 120) continue;
      placeOutdoor(outdoor, spot, kind, (li + got) % 3, lm.id);
      got++;
    }
    lm.nearby = got;
  }

  const order = [];
  const total = nav.cols * nav.rows;
  for (let n = 0; n < total; n += 7) order.push(n % total);

  const needBiome = Object.fromEntries(BIOMES.map((b) => [b, 6]));
  function countBiome(b) {
    let c = 0;
    for (const t of outdoor) if (t.biome === b && t.kind !== "relic") c++;
    return c;
  }

  function tryFill(kind, biomeLimit) {
    for (let n = 0; n < order.length; n++) {
      const have = outdoor.filter((t) => t.kind === kind).length;
      const cap = kind === "chest" ? 20 : 120;
      if (have >= cap) return;
      const k = order[n];
      if (!reach[k]) continue;
      const j = Math.floor(k / nav.cols);
      const i = k - j * nav.cols;
      const y = nav.h[k];
      if (y < WATER + 0.4) continue;
      const biome = biomeAtCell(nav, i, j);
      if (biomeLimit && countBiome(biome) >= needBiome[biome]) continue;
      const [x, z] = cellCenter(nav, i, j);
      if (tooClose(outdoor, x, z, 40)) continue;
      if (Math.hypot(x, z) < 80) continue;
      let byLandmark = false;
      for (let li = 0; li < landmarks.length; li++) {
        if (Math.hypot(landmarks[li].x - x, landmarks[li].z - z) < 200) {
          byLandmark = true;
          break;
        }
      }
      if (byLandmark) continue;
      placeOutdoor(outdoor, { x, z }, kind, n % 3, null);
    }
  }

  tryFill("trinket", true);
  tryFill("trinket", false);
  tryFill("chest", false);
  return finishTreasures(outdoor, caves);
}

function placeTreasuresScatter(nav, reach, landmarks, caves) {
  const outdoor = [];
  const bins = new Map();
  const binKey = (x, z) => `${Math.floor((x + HALF) / 500)}:${Math.floor((z + HALF) / 500)}`;
  const binCount = (x, z) => bins.get(binKey(x, z)) || 0;
  const addBin = (x, z) => bins.set(binKey(x, z), binCount(x, z) + 1);

  for (let li = 0; li < landmarks.length; li++) {
    const lm = landmarks[li];
    const n = 1 + Math.floor(rand(li * 19 + 4) * 3);
    let pool = candidatesNear(nav, reach, lm.x, lm.z, 42, 180);
    if (pool.length < n) pool = candidatesNear(nav, reach, lm.x, lm.z, 36, 280);
    const inward = pool.filter((spot) => borderOf(spot.x, spot.z) >= 400 && binCount(spot.x, spot.z) < 8);
    const usable = inward.length ? inward : pool.filter((spot) => binCount(spot.x, spot.z) < 8);
    usable.sort((a, b) => b.hide - a.hide || a.i - b.i || a.j - b.j);
    let got = 0;
    for (let c = 0; c < usable.length && got < n; c++) {
      const spot = usable[c];
      if (tooClose(outdoor, spot.x, spot.z, 40)) continue;
      if (binCount(spot.x, spot.z) >= 8) continue;
      const chests = outdoor.filter((t) => t.kind === "chest").length;
      const kind = chests < 20 && got === 0 ? "chest" : "trinket";
      const trinkets = outdoor.filter((t) => t.kind === "trinket").length;
      if (kind === "trinket" && trinkets >= 120) continue;
      placeOutdoor(outdoor, spot, kind, (li + got) % 3, lm.id);
      addBin(spot.x, spot.z);
      got++;
    }
    lm.nearby = got;
  }

  const cells = [];
  const total = nav.cols * nav.rows;
  for (let k = 0; k < total; k++) {
    if (!reach[k]) continue;
    const j = Math.floor(k / nav.cols);
    const i = k - j * nav.cols;
    if (nav.h[k] < WATER + 0.4) continue;
    const [x, z] = cellCenter(nav, i, j);
    if (borderOf(x, z) < 400) continue;
    if (Math.hypot(x, z) < 80) continue;
    let byLandmark = false;
    for (let li = 0; li < landmarks.length; li++) {
      if (Math.hypot(landmarks[li].x - x, landmarks[li].z - z) < 200) {
        byLandmark = true;
        break;
      }
    }
    if (byLandmark) continue;
    cells.push(k);
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand(i * 9176 + 13) * (i + 1));
    const swap = cells[i];
    cells[i] = cells[j];
    cells[j] = swap;
  }

  function tryFill(kind, minDist) {
    for (let n = 0; n < cells.length; n++) {
      const have = outdoor.filter((t) => t.kind === kind).length;
      const cap = kind === "chest" ? 20 : 120;
      if (have >= cap) return;
      const k = cells[n];
      const j = Math.floor(k / nav.cols);
      const i = k - j * nav.cols;
      const [x, z] = cellCenter(nav, i, j);
      if (tooClose(outdoor, x, z, minDist)) continue;
      if (binCount(x, z) >= 8) continue;
      placeOutdoor(outdoor, { x, z }, kind, n % 3, null);
      addBin(x, z);
    }
  }

  tryFill("trinket", 55);
  if (outdoor.filter((t) => t.kind === "trinket").length < 120) tryFill("trinket", 40);
  tryFill("chest", 55);
  if (outdoor.filter((t) => t.kind === "chest").length < 20) tryFill("chest", 40);
  return finishTreasures(outdoor, caves);
}

function finishTreasures(outdoor, caves) {
  const relics = caves.map((cave) => {
    const o = caveOrigin(cave.id);
    return {
      kind: "relic",
      variant: 0,
      x: o.x + 16.5,
      z: o.z + 0.2,
      y: 1.15,
      biome: cave.biome,
      landmarkId: null,
      caveId: cave.id,
      mapX: cave.x,
      mapZ: cave.z,
    };
  });
  const trinkets = outdoor.filter((t) => t.kind === "trinket").slice(0, 120);
  const chests = outdoor.filter((t) => t.kind === "chest").slice(0, 20);
  return [...trinkets, ...chests, ...relics].map((t, id) => ({ ...t, id }));
}

function placeTreasures(nav, reach, landmarks, caves) {
  return placementMode === "row"
    ? placeTreasuresRow(nav, reach, landmarks, caves)
    : placeTreasuresScatter(nav, reach, landmarks, caves);
}

export function generateWorld() {
  const t0 = Date.now();
  const nav = buildNav();
  const spawnCell = pickSpawn(nav);
  const reach = flood(nav, spawnCell.i, spawnCell.j);
  const landmarks = placeLandmarks(nav, reach);
  const caves = placeCaves(nav, reach);
  const treasures = placeTreasures(nav, reach, landmarks, caves);
  const spawnS = sample(spawnCell.x, spawnCell.z);
  const spawn = {
    x: spawnCell.x,
    y: spawnS.y,
    z: spawnCell.z,
    biome: spawnS.biome,
  };
  return {
    nav,
    reach,
    spawn,
    landmarks,
    caves,
    treasures,
    ms: Date.now() - t0,
  };
}

export function spreadReport(world) {
  const bins = new Map();
  let edge = 0;
  for (const t of world.treasures) {
    const x = t.kind === "relic" ? t.mapX : t.x;
    const z = t.kind === "relic" ? t.mapZ : t.z;
    if (borderOf(x, z) < 400) edge++;
    const key = `${Math.floor((x + HALF) / 500)}:${Math.floor((z + HALF) / 500)}`;
    bins.set(key, (bins.get(key) || 0) + 1);
  }
  let worst = 0;
  for (const n of bins.values()) worst = Math.max(worst, n);
  const edgePct = edge / Math.max(1, world.treasures.length);
  return {
    edge,
    edgePct,
    worst,
    ok: edgePct <= 0.05 && worst <= 8,
  };
}

function groundDelta(t) {
  if (t.kind === "relic") return 0;
  const y = sampleInto(t.x, t.z, { y: 0, biome: "", moisture: 0, temp: 0 }).y;
  return t.y - y;
}

/**
 * @param {ReturnType<typeof generateWorld>} world
 * @param {{ buryId?: number }} [opts]
 */
export function assessWorld(world, opts = {}) {
  const problems = [];
  const treasures = world.treasures.map((t) => ({ ...t }));
  if (opts.buryId != null && treasures[opts.buryId]) {
    treasures[opts.buryId] = { ...treasures[opts.buryId], y: -120 };
  }
  const kinds = { trinket: 0, chest: 0, relic: 0 };
  for (const t of treasures) kinds[t.kind] = (kinds[t.kind] || 0) + 1;
  if (treasures.length !== 150) problems.push(`count ${treasures.length} != 150`);
  if (kinds.trinket !== 120) problems.push(`trinkets ${kinds.trinket} != 120`);
  if (kinds.chest !== 20) problems.push(`chests ${kinds.chest} != 20`);
  if (kinds.relic !== 10) problems.push(`relics ${kinds.relic} != 10`);
  if (world.landmarks.length !== 24) problems.push(`landmarks ${world.landmarks.length}`);
  if (world.caves.length !== 10) problems.push(`caves ${world.caves.length}`);

  for (let i = 0; i < treasures.length; i++) {
    for (let j = i + 1; j < treasures.length; j++) {
      const a = treasures[i];
      const b = treasures[j];
      if (a.kind === "relic" || b.kind === "relic") continue;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < 39.5) problems.push(`spacing ${a.id}-${b.id} ${d.toFixed(1)}m`);
    }
  }

  for (const lm of world.landmarks) {
    const near = treasures.filter((t) => {
      if (t.kind === "relic") return false;
      return Math.hypot(t.x - lm.x, t.z - lm.z) < 210 && Math.hypot(t.x - lm.x, t.z - lm.z) > 20;
    });
    if (near.length < 1 || near.length > 3) {
      problems.push(`landmark ${lm.name} has ${near.length} nearby treasures`);
    }
  }

  const nav = world.nav;
  const reach = world.reach;
  for (const t of treasures) {
    if (t.kind === "relic") {
      const cave = world.caves[t.caveId];
      if (!cave) {
        problems.push(`relic ${t.id} missing cave`);
        continue;
      }
      const c = cellOf(nav, cave.x, cave.z);
      if (!inGrid(nav, c.i, c.j) || !reach[c.j * nav.cols + c.i]) {
        problems.push(`cave ${t.caveId} entrance unreachable`);
      }
      continue;
    }
    const delta = groundDelta(t);
    if (delta < -2 || delta > 4) problems.push(`treasure ${t.id} buried (dy ${delta.toFixed(1)})`);
    const c = cellOf(nav, t.x, t.z);
    if (!inGrid(nav, c.i, c.j) || !reach[c.j * nav.cols + c.i]) {
      problems.push(`treasure ${t.id} unreachable`);
    }
  }

  const seen = new Set(treasures.filter((t) => t.kind === "relic").map((t) => t.caveId));
  for (let i = 0; i < 10; i++) if (!seen.has(i)) problems.push(`cave ${i} has no relic`);

  return { ok: problems.length === 0, problems, kinds };
}
