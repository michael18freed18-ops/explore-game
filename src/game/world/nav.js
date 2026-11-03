// @ts-nocheck
import { BIOMES, CELL, HALF, MAX_CLIMB, WATER, sampleInto } from "./sample.js";

const BIOME_INDEX = Object.fromEntries(BIOMES.map((b, i) => [b, i]));

export function buildNav() {
  const cols = Math.round((HALF * 2) / CELL);
  const rows = cols;
  const origin = -HALF;
  const h = new Float32Array(cols * rows);
  const biome = new Uint8Array(cols * rows);
  const tmp = { y: 0, biome: "meadow", moisture: 0, temp: 0 };
  for (let j = 0; j < rows; j++) {
    const z = origin + (j + 0.5) * CELL;
    for (let i = 0; i < cols; i++) {
      const x = origin + (i + 0.5) * CELL;
      sampleInto(x, z, tmp);
      const k = j * cols + i;
      h[k] = tmp.y;
      biome[k] = BIOME_INDEX[tmp.biome];
    }
  }
  return { cols, rows, origin, cell: CELL, h, biome };
}

export function cellOf(nav, x, z) {
  const i = Math.floor((x - nav.origin) / nav.cell);
  const j = Math.floor((z - nav.origin) / nav.cell);
  return { i, j };
}

export function cellCenter(nav, i, j) {
  return [nav.origin + (i + 0.5) * nav.cell, nav.origin + (j + 0.5) * nav.cell];
}

export function inGrid(nav, i, j) {
  return i >= 0 && j >= 0 && i < nav.cols && j < nav.rows;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Cells you can walk to with a full stamina bar: slope ≤ climb max, not deep water. */
export function flood(nav, si, sj) {
  const { cols, rows, h, cell } = nav;
  const reach = new Uint8Array(cols * rows);
  const qx = new Int32Array(cols * rows);
  const qz = new Int32Array(cols * rows);
  let qs = 0;
  let qe = 0;
  const start = sj * cols + si;
  if (!inGrid(nav, si, sj) || h[start] < WATER - 0.25) return reach;
  reach[start] = 1;
  qx[0] = si;
  qz[0] = sj;
  qe = 1;
  while (qs < qe) {
    const i = qx[qs];
    const j = qz[qs];
    qs++;
    const h0 = h[j * cols + i];
    for (let d = 0; d < 8; d++) {
      const ni = i + DIRS[d][0];
      const nj = j + DIRS[d][1];
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const k = nj * cols + ni;
      if (reach[k]) continue;
      const h1 = h[k];
      if (h1 < WATER - 0.25) continue;
      const dist = Math.hypot(DIRS[d][0], DIRS[d][1]) * cell;
      if (Math.abs(h1 - h0) / dist > MAX_CLIMB) continue;
      reach[k] = 1;
      qx[qe] = ni;
      qz[qe] = nj;
      qe++;
    }
  }
  return reach;
}

export function nearestReachable(nav, reach, i, j) {
  if (inGrid(nav, i, j) && reach[j * nav.cols + i]) return { i, j };
  const max = 12;
  for (let r = 1; r <= max; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ni = i + di;
        const nj = j + dj;
        if (!inGrid(nav, ni, nj)) continue;
        if (reach[nj * nav.cols + ni]) return { i: ni, j: nj };
      }
    }
  }
  return null;
}

export function findPath(nav, reach, x0, z0, x1, z1) {
  const a = cellOf(nav, x0, z0);
  const b0 = cellOf(nav, x1, z1);
  const b = nearestReachable(nav, reach, b0.i, b0.j);
  if (!b) return [];
  const start = nearestReachable(nav, reach, a.i, a.j);
  if (!start) return [];
  const { cols, rows } = nav;
  const parent = new Int32Array(cols * rows);
  parent.fill(-1);
  const qx = new Int32Array(cols * rows);
  const qz = new Int32Array(cols * rows);
  const sk = start.j * cols + start.i;
  const gk = b.j * cols + b.i;
  parent[sk] = sk;
  let qs = 0;
  let qe = 1;
  qx[0] = start.i;
  qz[0] = start.j;
  while (qs < qe) {
    const i = qx[qs];
    const j = qz[qs];
    qs++;
    if (i === b.i && j === b.j) break;
    for (let d = 0; d < 8; d++) {
      const ni = i + DIRS[d][0];
      const nj = j + DIRS[d][1];
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const k = nj * cols + ni;
      if (!reach[k] || parent[k] !== -1) continue;
      parent[k] = j * cols + i;
      qx[qe] = ni;
      qz[qe] = nj;
      qe++;
    }
  }
  if (parent[gk] === -1) return [];
  const cells = [];
  let k = gk;
  for (let guard = 0; guard < cols * rows; guard++) {
    const i = k % cols;
    const j = (k - i) / cols;
    cells.push(cellCenter(nav, i, j));
    if (k === sk) break;
    k = parent[k];
  }
  cells.reverse();
  const simplified = [];
  for (let i = 0; i < cells.length; i += 3) simplified.push({ x: cells[i][0], z: cells[i][1] });
  const last = cells[cells.length - 1];
  simplified.push({ x: last[0], z: last[1] });
  return simplified;
}

export function biomeAtCell(nav, i, j) {
  return BIOMES[nav.biome[j * nav.cols + i]] || "meadow";
}
