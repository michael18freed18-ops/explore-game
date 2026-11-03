// @ts-nocheck
import { CHUNK, SEED, WATER, biomeColor, noise, sampleInto } from "./sample.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SRGB = {
  forest: [0.29, 0.48, 0.31],
  autumn: [0.78, 0.42, 0.18],
  pine: [0.2, 0.36, 0.28],
  cactus: [0.45, 0.55, 0.32],
  rock: [0.48, 0.45, 0.4],
  snowrock: [0.75, 0.78, 0.8],
  reed: [0.45, 0.52, 0.28],
  flower: [0.86, 0.55, 0.42],
  sandrock: [0.72, 0.6, 0.4],
};

function shade(hex, n) {
  const k = 0.86 + n * 0.22;
  return [hex[0] * k, hex[1] * k, hex[2] * k];
}

/** kind: 0 tree, 1 pine, 2 cactus, 3 rock, 4 reed, 5 flower */
export function buildChunkGeometry(cx, cz, seg) {
  const n = seg + 1;
  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  const indices = new Uint32Array(seg * seg * 6);
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const tmp = { y: 0, biome: "meadow", moisture: 0, temp: 0 };
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const x = x0 + (i / seg) * CHUNK;
      const z = z0 + (j / seg) * CHUNK;
      sampleInto(x, z, tmp);
      const k = j * n + i;
      positions[k * 3] = x;
      positions[k * 3 + 1] = tmp.y;
      positions[k * 3 + 2] = z;
      const col = biomeColor(tmp.biome, tmp.y);
      const s = 0.9 + noise(x * 0.04, z * 0.04) * 0.16;
      colors[k * 3] = col[0] * s;
      colors[k * 3 + 1] = col[1] * s;
      colors[k * 3 + 2] = col[2] * s;
    }
  }
  let t = 0;
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * n + i;
      indices[t++] = a;
      indices[t++] = a + n;
      indices[t++] = a + 1;
      indices[t++] = a + 1;
      indices[t++] = a + n;
      indices[t++] = a + n + 1;
    }
  }

  const rng = mulberry32((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ SEED) >>> 0);
  const props = [];
  const tries = 9;
  for (let i = 0; i < tries; i++) {
    const x = x0 + rng() * CHUNK;
    const z = z0 + rng() * CHUNK;
    sampleInto(x, z, tmp);
    if (tmp.y < WATER + 0.6 || tmp.y > 520) continue;
    const y2 = sampleInto(x + 2, z, { y: 0, biome: "", moisture: 0, temp: 0 }).y;
    if (Math.abs(y2 - tmp.y) > 2.2) continue;
    const roll = rng();
    let kind = 3;
    let tint = SRGB.rock;
    let scale = 0.7 + rng() * 0.8;
    if (tmp.biome === "forest" && roll > 0.25) {
      kind = 0;
      tint = SRGB.forest;
      scale = 1.3 + rng() * 1.4;
    } else if (tmp.biome === "autumn" && roll > 0.3) {
      kind = 0;
      tint = SRGB.autumn;
      scale = 1.2 + rng() * 1.3;
    } else if (tmp.biome === "snow" && roll > 0.55) {
      kind = 1;
      tint = SRGB.pine;
      scale = 1.1 + rng();
    } else if (tmp.biome === "desert" && roll > 0.45) {
      kind = 2;
      tint = SRGB.cactus;
      scale = 1 + rng() * 0.6;
    } else if (tmp.biome === "swamp" && roll > 0.35) {
      kind = 4;
      tint = SRGB.reed;
      scale = 1.2 + rng();
    } else if (tmp.biome === "meadow" && roll > 0.55) {
      kind = 5;
      tint = SRGB.flower;
      scale = 0.8 + rng() * 0.5;
    } else if (tmp.biome === "shore") {
      kind = 3;
      tint = SRGB.sandrock;
      scale = 0.5 + rng() * 0.5;
    } else if (tmp.biome === "snow") {
      tint = SRGB.snowrock;
    } else if (tmp.biome === "desert") {
      tint = SRGB.sandrock;
    }
    const col = shade(tint, rng());
    props.push(kind, x, tmp.y, z, rng() * Math.PI * 2, scale, col[0], col[1], col[2]);
  }
  return { positions, colors, indices, props: new Float32Array(props) };
}
