// @ts-nocheck
/** Deterministic terrain. Shared by the main thread, the chunk worker, and Node QA. */

export const SEED = 0x571ead;
export const HALF = 4000;
export const CHUNK = 64;
export const WATER = 20;
export const CELL = 20;
export const MAX_WALK = Math.tan((32 * Math.PI) / 180);
export const MAX_CLIMB = Math.tan((58 * Math.PI) / 180);

export const BIOMES = ["meadow", "forest", "desert", "snow", "shore", "swamp", "autumn"];

export const BIOME_LABEL = {
  meadow: "Meadow",
  forest: "Forest",
  desert: "Desert",
  snow: "Snowy mountains",
  shore: "Lakes & beach",
  swamp: "Swamp",
  autumn: "Autumn woods",
};

const SRGB = {
  meadow: [0.72, 0.78, 0.46],
  forest: [0.24, 0.42, 0.27],
  desert: [0.85, 0.71, 0.4],
  snow: [0.91, 0.93, 0.95],
  shore: [0.89, 0.82, 0.64],
  swamp: [0.32, 0.4, 0.28],
  autumn: [0.77, 0.46, 0.2],
  lake: [0.2, 0.46, 0.56],
  rock: [0.45, 0.42, 0.38],
  trunk: [0.32, 0.22, 0.14],
  gold: [0.86, 0.62, 0.28],
};

function toLin(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const LINEAR = {};
for (const k of Object.keys(SRGB)) {
  LINEAR[k] = SRGB[k].map(toLin);
}

export function biomeColor(biome, y) {
  const key = biome === "shore" && y < WATER ? "lake" : biome;
  return LINEAR[key] || LINEAR.meadow;
}

export function palette(name) {
  return LINEAR[name] || LINEAR.rock;
}

function hash2(ix, iz) {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ SEED;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

export function noise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const tz = fade(z - z0);
  const v00 = hash2(x0, z0);
  const v10 = hash2(x0 + 1, z0);
  const v01 = hash2(x0, z0 + 1);
  const v11 = hash2(x0 + 1, z0 + 1);
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * tz;
}

export function fbm(x, z) {
  let a = 0;
  let amp = 0.5;
  let f = 1;
  let nrm = 0;
  for (let i = 0; i < 4; i++) {
    a += noise(x * f + i * 3.1, z * f - i * 1.7) * amp;
    nrm += amp;
    amp *= 0.5;
    f *= 2.05;
  }
  return a / nrm;
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

const _out = { y: 0, biome: "meadow", moisture: 0, temp: 0 };

/** Fill `out` (or a fresh object) with height and climate. No per-call alloc if `out` is passed. */
export function sampleInto(x, z, out) {
  const o = out || _out;
  const wx = x * 0.00018;
  const wz = z * 0.00018;
  const cont = fbm(wx, wz);
  const hill = fbm(wx * 3.7 + 4.2, wz * 3.7 + 1.7);
  const ridgeN = fbm(wx * 2.0 + 9, wz * 2.0);
  const ridge = 1 - Math.abs(ridgeN * 2 - 1);

  let y = 9 + cont * 24 + hill * 13 + ridge * ridge * 14;

  const d = Math.hypot(x, z);
  const R = 1700;
  if (d < R) {
    const t = 1 - d / R;
    const peak = t ** 1.45 * 760;
    const blend = t * t * (3 - 2 * t);
    y = y * (1 - blend) + (22 + peak) * blend;
  }
  if (d < 56) {
    const rimT = 1 - 56 / R;
    const cap = 22 + rimT ** 1.45 * 760;
    const u = 1 - d / 56;
    y = y * (1 - u) + cap * u;
  }

  // Outlying massifs so snow is not only the central peak.
  const ranges = [
    [2300, -2500, 820, 240],
    [-2500, 2100, 760, 230],
    [-1600, -2300, 560, 190],
  ];
  for (let i = 0; i < ranges.length; i++) {
    const rx = ranges[i][0];
    const rz = ranges[i][1];
    const rr = ranges[i][2];
    const rh = ranges[i][3];
    const dd = Math.hypot(x - rx, z - rz);
    if (dd < rr) {
      const t = 1 - dd / rr;
      y += t * t * rh;
    }
  }

  if (d > 1500) {
    const es = noise(x * 0.00215 + 12, z * 0.00215 - 4);
    const cliff = clamp((es - 0.52) * 34, -1, 1);
    y += cliff * 12;
  }

  if (cont < 0.4 && d > R * 0.92) {
    const k = (0.4 - cont) / 0.4;
    y -= k * k * 24;
  }

  const moisture = fbm(x * 0.00027 + 40, z * 0.00027 + 6);
  const tempN = fbm(x * 0.00015 + 90, z * 0.00015);
  const climate = fbm(x * 0.0001 + 5, z * 0.0001 - 8);
  let temp = tempN * 0.62 + 0.2 + (climate - 0.5) * 0.48;
  temp -= Math.max(0, y - 32) / 360;

  let biome;
  if (y < WATER + 2.6) biome = "shore";
  else if (y > 230 || temp < 0.2) biome = "snow";
  else if (temp > 0.6 && moisture < 0.46 && y < 120) biome = "desert";
  else if (moisture > 0.58 && y < 52 && temp > 0.28 && temp < 0.64) biome = "swamp";
  else if (temp > 0.28 && temp < 0.55 && moisture > 0.38 && moisture < 0.74 && hill > 0.4 && y < 170)
    biome = "autumn";
  else if (moisture > 0.4 && temp < 0.68 && y < 240) biome = "forest";
  else biome = "meadow";

  o.y = y;
  o.biome = biome;
  o.moisture = moisture;
  o.temp = temp;
  return o;
}

export function sample(x, z) {
  const o = sampleInto(x, z, { y: 0, biome: "meadow", moisture: 0, temp: 0 });
  return o;
}

export function slopeAt(x, z, step = 2) {
  const y0 = sampleInto(x, z, _out).y;
  const yx = sampleInto(x + step, z, _out).y;
  const yz = sampleInto(x, z + step, _out).y;
  return Math.hypot(yx - y0, yz - y0) / step;
}
