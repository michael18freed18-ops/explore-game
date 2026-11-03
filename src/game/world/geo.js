// @ts-nocheck
import { palette } from "./sample.js";

export function makeBuf() {
  return { p: [], c: [] };
}

export function tri(buf, ax, ay, az, bx, by, bz, cx, cy, cz, col) {
  buf.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  const r = col[0];
  const g = col[1];
  const b = col[2];
  buf.c.push(r, g, b, r, g, b, r, g, b);
}

export function box(buf, x, y, z, sx, sy, sz, col) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const v = [
    [x - hx, y - hy, z - hz],
    [x + hx, y - hy, z - hz],
    [x + hx, y + hy, z - hz],
    [x - hx, y + hy, z - hz],
    [x - hx, y - hy, z + hz],
    [x + hx, y - hy, z + hz],
    [x + hx, y + hy, z + hz],
    [x - hx, y + hy, z + hz],
  ];
  const f = [
    [0, 2, 1, 0, 3, 2],
    [4, 5, 6, 4, 6, 7],
    [0, 1, 5, 0, 5, 4],
    [3, 7, 6, 3, 6, 2],
    [1, 2, 6, 1, 6, 5],
    [0, 4, 7, 0, 7, 3],
  ];
  for (let i = 0; i < f.length; i++) {
    const q = f[i];
    tri(buf, ...v[q[0]], ...v[q[1]], ...v[q[2]], col);
    tri(buf, ...v[q[3]], ...v[q[4]], ...v[q[5]], col);
  }
}

export function cyl(buf, x, y, z, r, h, sides, col) {
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const x0 = Math.cos(a0) * r;
    const z0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r;
    const z1 = Math.sin(a1) * r;
    tri(buf, x + x0, y, z + z0, x + x1, y, z + z1, x + x1, y + h, z + z1, col);
    tri(buf, x + x0, y, z + z0, x + x1, y + h, z + z1, x + x0, y + h, z + z0, col);
    tri(buf, x, y + h, z, x + x0, y + h, z + z0, x + x1, y + h, z + z1, col);
    tri(buf, x, y, z, x + x1, y, z + z1, x + x0, y, z + z0, col);
  }
}

export function cone(buf, x, y, z, r, h, sides, col) {
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    tri(
      buf,
      x + Math.cos(a0) * r,
      y,
      z + Math.sin(a0) * r,
      x + Math.cos(a1) * r,
      y,
      z + Math.sin(a1) * r,
      x,
      y + h,
      z,
      col,
    );
  }
}

export function finalize(buf) {
  return { positions: new Float32Array(buf.p), colors: new Float32Array(buf.c) };
}

const WHITE = [1, 1, 1];

export function treeGeometry() {
  const b = makeBuf();
  cyl(b, 0, 0, 0, 0.16, 1.1, 5, WHITE);
  cone(b, 0, 0.9, 0, 0.85, 1.8, 6, WHITE);
  return finalize(b);
}

export function cactusGeometry() {
  const b = makeBuf();
  box(b, 0, 0.7, 0, 0.28, 1.4, 0.28, WHITE);
  box(b, 0.34, 0.85, 0, 0.55, 0.18, 0.18, WHITE);
  box(b, 0.52, 1.05, 0, 0.18, 0.45, 0.18, WHITE);
  return finalize(b);
}

export function rockGeometry() {
  const b = makeBuf();
  cone(b, 0, 0, 0, 0.7, 0.55, 5, WHITE);
  return finalize(b);
}

export function tuftGeometry() {
  const b = makeBuf();
  cone(b, 0, 0, 0, 0.22, 0.55, 4, WHITE);
  return finalize(b);
}

export function trinketGeometry(variant) {
  const b = makeBuf();
  const gold = palette("gold");
  const rock = palette("rock");
  const leaf = palette("autumn");
  if (variant === 1) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      cone(b, Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55, 0.16, 0.35, 4, leaf);
    }
    cone(b, 0, 0.15, 0, 0.12, 0.38, 4, gold);
  } else if (variant === 2) {
    cyl(b, 0, 0, 0, 0.38, 0.45, 6, palette("trunk"));
    box(b, 0.1, 0.55, 0, 0.16, 0.16, 0.16, gold);
  } else {
    cone(b, 0.35, 0, 0.1, 0.45, 0.4, 5, rock);
    box(b, -0.05, 0.35, 0, 0.16, 0.22, 0.16, gold);
  }
  return finalize(b);
}

export function chestGeometry() {
  const b = makeBuf();
  const wood = palette("trunk");
  const gold = palette("gold");
  box(b, 0, 0.28, 0, 0.7, 0.42, 0.46, wood);
  box(b, 0, 0.52, 0, 0.74, 0.16, 0.5, wood);
  box(b, 0, 0.34, 0.24, 0.1, 0.1, 0.06, gold);
  return finalize(b);
}

export function relicGeometry() {
  const b = makeBuf();
  const gold = palette("gold");
  cone(b, 0, 0.15, 0, 0.28, 0.55, 4, gold);
  cone(b, 0, 0.7, 0, 0.28, -0.55, 4, gold);
  return finalize(b);
}

export function playerGeometry() {
  const b = makeBuf();
  const cloth = [0.22, 0.28, 0.34];
  const skin = [0.62, 0.45, 0.32];
  cyl(b, 0, 0, 0, 0.26, 0.85, 6, cloth);
  cyl(b, 0, 0.9, 0, 0.16, 0.26, 6, skin);
  box(b, 0, 0.62, 0.2, 0.22, 0.16, 0.1, palette("gold"));
  return finalize(b);
}

export function blobRing() {
  const b = makeBuf();
  const col = [1, 1, 1];
  cone(b, 0, 0, 0, 0.5, 1, 7, col);
  return finalize(b);
}

export const LOOM = {
  peak: 36,
  "great-tree": 24,
  "desert-arch": 12,
  "frozen-tower": 28,
  waterfall: 16,
  "ruined-bridge": 7,
  "stone-circle": 5,
  "autumn-spire": 22,
  "swamp-lanterns": 9,
  wreck: 6,
  mesa: 14,
  glacier: 12,
  "hollow-oak": 9,
  menhirs: 7,
  aqueduct: 9,
  windmill: 13,
  needle: 30,
  lilies: 3,
  "canyon-gate": 14,
  "pine-ring": 12,
  cairn: 5,
  colonnade: 9,
  tide: 3,
  watchtower: 16,
};

export function mountainGeometry() {
  const b = makeBuf();
  const rock = [0.45, 0.42, 0.38];
  const snow = [0.9, 0.93, 0.95];
  const shade = [0.3, 0.32, 0.34];
  const peaks = [
    [0, 0, 0, 0.85, 1],
    [-0.5, 0, 0.28, 0.55, 0.68],
    [0.48, 0, -0.22, 0.5, 0.6],
    [0.12, 0, 0.55, 0.38, 0.42],
    [-0.18, 0, -0.5, 0.42, 0.46],
  ];
  for (let p = 0; p < peaks.length; p++) {
    const x = peaks[p][0];
    const z = peaks[p][2];
    const r = peaks[p][3];
    const h = peaks[p][4];
    cone(b, x, 0, z, r * 1.45, h * 0.42, 9, shade);
    cone(b, x, 0, z, r, h, 11, p === 0 ? snow : rock);
    cone(b, x, h * 0.55, z, r * 0.45, h * 0.5, 8, snow);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(b, Math.cos(a) * 0.72, 0.08, Math.sin(a) * 0.72, 0.28, 0.22 + (i % 3) * 0.08, 0.26, i % 2 ? shade : rock);
  }
  return finalize(b);
}

export function buildLandmark(type) {
  const b = makeBuf();
  const trunk = palette("trunk");
  const leaf = palette("forest");
  const snow = palette("snow");
  const sand = palette("desert");
  const gold = palette("gold");
  const rock = palette("rock");
  const autumn = palette("autumn");
  const water = palette("lake");
  const moss = palette("swamp");
  switch (type) {
    case "peak":
      return mountainGeometry();
    case "great-tree":
      cyl(b, 0, 0, 0, 1.5, 7, 7, trunk);
      cone(b, 0, 5.5, 0, 6.5, 9, 8, leaf);
      cone(b, 0, 9.5, 0, 4.2, 6, 8, leaf);
      break;
    case "desert-arch":
      box(b, -2.2, 2.2, 0, 1.1, 4.4, 1.1, sand);
      box(b, 2.2, 2.2, 0, 1.1, 4.4, 1.1, sand);
      box(b, 0, 4.6, 0, 5.6, 1.1, 1.1, sand);
      break;
    case "frozen-tower":
      cyl(b, 0, 0, 0, 1.6, 6, 6, snow);
      cyl(b, 0, 6, 0, 1.15, 5, 6, snow);
      cone(b, 0, 11, 0, 1.4, 3.2, 6, [0.75, 0.86, 0.95]);
      break;
    case "waterfall":
      box(b, 0, 2, -1.2, 3.2, 5, 1.4, rock);
      box(b, 0, 2.2, 0.2, 1.2, 4.2, 0.35, water);
      break;
    case "ruined-bridge":
      box(b, -2.4, 1.1, 0, 2.6, 0.35, 1.3, rock);
      box(b, 2.6, 1.1, 0, 2.2, 0.35, 1.3, rock);
      box(b, -3.6, 0.8, 0, 0.45, 1.6, 1.3, rock);
      box(b, 3.6, 0.8, 0, 0.45, 1.6, 1.3, rock);
      break;
    case "stone-circle":
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        box(b, Math.cos(a) * 3.2, 1.1, Math.sin(a) * 3.2, 0.45, 2.2, 0.7, rock);
      }
      break;
    case "autumn-spire":
      cyl(b, 0, 0, 0, 0.7, 8, 6, trunk);
      cone(b, 0, 6, 0, 2.4, 6, 6, autumn);
      break;
    case "swamp-lanterns":
      for (let i = 0; i < 4; i++) {
        box(b, (i - 1.5) * 1.4, 1.1, (i % 2) * 0.8, 0.12, 2.2, 0.12, trunk);
        cone(b, (i - 1.5) * 1.4, 2.2, (i % 2) * 0.8, 0.28, 0.4, 5, gold);
      }
      break;
    case "wreck":
      box(b, 0, 0.6, 0, 3.4, 0.8, 1.1, trunk);
      box(b, 0.4, 1.6, 0, 0.12, 2.2, 0.12, trunk);
      break;
    case "mesa":
      cyl(b, 0, 0, 0, 3.2, 5, 6, sand);
      cyl(b, 0, 5, 0, 4.2, 0.6, 6, sand);
      break;
    case "glacier":
      cone(b, -1, 0, 0, 1.6, 3.5, 4, snow);
      cone(b, 1.2, 0, 0.4, 1.3, 2.6, 4, snow);
      break;
    case "hollow-oak":
      cyl(b, 0, 0.6, 0, 0.7, 1.2, 6, trunk);
      box(b, 0.2, 0.7, 0.4, 0.35, 0.45, 0.2, [0.02, 0.02, 0.02]);
      break;
    case "menhirs":
      box(b, -1, 1.6, 0, 0.7, 3.2, 0.45, rock);
      box(b, 1.1, 1.2, 0.2, 0.55, 2.4, 0.4, rock);
      break;
    case "aqueduct":
      for (let i = 0; i < 4; i++) {
        box(b, i * 1.6 - 2.4, 1.4, 0, 0.35, 2.8, 0.35, rock);
      }
      box(b, -0.4, 2.9, 0, 5.2, 0.35, 0.7, rock);
      break;
    case "windmill":
      cyl(b, 0, 0, 0, 1.1, 4.5, 7, rock);
      cone(b, 0, 4.5, 0, 1.5, 1.4, 6, autumn);
      box(b, 0, 3.6, 0.2, 4.2, 0.18, 0.18, trunk);
      box(b, 0, 3.6, 0.2, 0.18, 4.2, 0.18, trunk);
      break;
    case "needle":
      cone(b, 0, 0, 0, 1.3, 14, 5, [0.12, 0.14, 0.18]);
      break;
    case "lilies":
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        cyl(b, Math.cos(a) * 1.4, 0.05, Math.sin(a) * 1.4, 0.45, 0.12, 6, moss);
      }
      break;
    case "canyon-gate":
      box(b, -2, 2.4, 0, 1.2, 4.8, 1.2, sand);
      box(b, 2, 2.4, 0, 1.2, 4.8, 1.2, sand);
      box(b, 0, 5, 0, 5.2, 0.8, 1.2, sand);
      break;
    case "pine-ring":
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        cone(b, Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4, 0.8, 3.4, 5, leaf);
      }
      break;
    case "cairn":
      box(b, 0, 0.35, 0, 1.4, 0.5, 1.1, rock);
      box(b, 0.1, 0.85, 0, 0.9, 0.45, 0.7, rock);
      box(b, 0, 1.25, 0, 0.45, 0.35, 0.4, rock);
      break;
    case "colonnade":
      for (let i = 0; i < 5; i++) cyl(b, i * 1.1 - 2.2, 0, 0, 0.22, 3.2, 6, autumn);
      box(b, 0, 3.3, 0, 5.2, 0.28, 0.8, trunk);
      break;
    case "tide":
      cyl(b, -0.8, 0.05, 0, 0.7, 0.15, 7, water);
      cyl(b, 0.7, 0.05, 0.3, 0.5, 0.12, 6, water);
      break;
    case "watchtower":
      cyl(b, 0, 0, 0, 1.3, 6.5, 7, rock);
      cone(b, 0, 6.5, 0, 2, 1.8, 7, autumn);
      break;
    default:
      box(b, 0, 1, 0, 1,2, 2,4, 1.2, rock);
  }
  return finalize(b);
}

export function buildCaveMouth() {
  const b = makeBuf();
  const rock = palette("rock");
  box(b, -1.35, 1.25, 0, 0.7, 2.5, 0.9, rock);
  box(b, 1.35, 1.25, 0, 0.7, 2.5, 0.9, rock);
  box(b, 0, 2.7, 0, 3.4, 0.55, 0.9, rock);
  return finalize(b);
}

export function buildCaveInterior() {
  const b = makeBuf();
  const rock = [0.62, 0.48, 0.36];
  const dark = [0.42, 0.32, 0.24];
  const warm = [0.78, 0.58, 0.36];
  const floor = [0.5, 0.4, 0.3];
  box(b, 10, -0.2, 0, 22, 0.4, 6.2, floor);
  box(b, 10, 1.7, 2.9, 22, 3.6, 0.45, rock);
  box(b, 10, 1.7, -2.9, 22, 3.6, 0.45, dark);
  box(b, 20.2, 1.7, 0, 0.45, 3.6, 6.2, rock);
  box(b, 10, 3.5, 0, 22, 0.35, 6.2, dark);
  cyl(b, 16.5, 0, 0.2, 0.72, 0.85, 6, warm);
  box(b, 16.5, 1.05, 0.2, 0.35, 0.12, 0.35, warm);
  return finalize(b);
}
