// @ts-nocheck
import { caveOrigin } from "./world/catalog.js";
import { HALF, MAX_CLIMB, MAX_WALK, WATER, sampleInto } from "./world/sample.js";

const WALK = 4.2;
const CLIMB_SPEED = 1.6;
const JUMP = 6.3;
const GRAV = 16;
const DRAIN = 18;
const REGEN = 12;

const tmp = { y: 0, biome: "meadow", moisture: 0, temp: 0 };

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function createSim(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    vy: 0,
    air: false,
    stamina: 100,
    climbing: false,
    yaw: Math.PI,
    pitch: 0.32,
    cave: -1,
    speed: 0,
    coyote: 0.12,
  };
}

export function stepSim(p, a, dt, world) {
  p.yaw += a.lookX || 0;
  p.pitch = clamp(p.pitch + (a.lookY || 0), -0.5, 0.9);

  const yaw = p.yaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let mx = a.moveX || 0;
  let my = a.moveY || 0;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  const wishX = fx * my + rx * mx;
  const wishZ = fz * my + rz * mx;
  const moving = mag > 0.08;

  if (p.cave >= 0) {
    stepCave(p, a, dt, world, wishX, wishZ, moving);
    return;
  }

  const h0 = sampleInto(p.x, p.z, tmp).y;
  let step = WALK * dt;
  let climbing = false;
  let blocked = false;
  if (moving && !p.air) {
    const nx = p.x + wishX * step;
    const nz = p.z + wishZ * step;
    const h1 = sampleInto(nx, nz, tmp).y;
    const horiz = Math.max(0.0001, Math.hypot(wishX * step, wishZ * step));
    const slope = (h1 - h0) / horiz;
    if (h1 < WATER - 0.3) blocked = true;
    else if (slope > MAX_CLIMB) blocked = true;
    else if (slope > MAX_WALK) {
      if (a.climb && p.stamina > 1) {
        climbing = true;
        step = CLIMB_SPEED * dt;
      } else blocked = true;
    }
  }

  let dx = 0;
  let dz = 0;
  if (moving && !blocked) {
    dx = wishX * (climbing ? CLIMB_SPEED * dt : step);
    dz = wishZ * (climbing ? CLIMB_SPEED * dt : step);
    const bx = p.x + dx;
    const bz = p.z + dz;
    if (Math.abs(bx) < HALF - 12 && Math.abs(bz) < HALF - 12) {
      const hy = sampleInto(bx, bz, tmp).y;
      if (hy >= WATER - 0.3) {
        p.x = bx;
        p.z = bz;
      }
    }
  }

  if (climbing) {
    p.stamina = Math.max(0, p.stamina - DRAIN * dt);
    p.climbing = true;
  } else {
    p.climbing = false;
    if (!p.air) p.stamina = Math.min(100, p.stamina + REGEN * dt);
  }

  if (!p.air) {
    p.y = sampleInto(p.x, p.z, tmp).y;
    p.vy = 0;
    p.coyote = 0.12;
    if (a.jump && p.stamina > 8 && !climbing) {
      p.vy = JUMP;
      p.air = true;
      p.stamina = Math.max(0, p.stamina - 10);
      p.coyote = 0;
    }
  } else {
    p.coyote = Math.max(0, p.coyote - dt);
    if (a.jump && p.coyote > 0 && p.vy <= 0 && p.stamina > 8) {
      p.vy = JUMP;
      p.stamina = Math.max(0, p.stamina - 10);
      p.coyote = 0;
    }
    p.vy -= GRAV * dt;
    p.y += p.vy * dt;
    const g = sampleInto(p.x, p.z, tmp).y;
    if (p.y <= g) {
      p.y = g;
      p.air = false;
      p.vy = 0;
    }
  }

  p.speed = Math.hypot(dx, dz) / Math.max(dt, 0.0001);

  if (!p.air && moving) {
    for (let i = 0; i < world.caves.length; i++) {
      const c = world.caves[i];
      const ddx = p.x - c.x;
      const ddz = p.z - c.z;
      if (ddx * ddx + ddz * ddz > 6.2) continue;
      const ux = Math.sin(c.yaw);
      const uz = Math.cos(c.yaw);
      if (fx * ux + fz * uz > 0.35) {
        const o = caveOrigin(c.id);
        p.cave = c.id;
        p.x = o.x + 2.2;
        p.z = o.z;
        p.y = 0;
        p.air = false;
        p.vy = 0;
        p.speed = 0;
        break;
      }
    }
  }
}

function stepCave(p, a, dt, world, wishX, wishZ, moving) {
  const cave = world.caves[p.cave];
  const o = caveOrigin(p.cave);
  let lx = p.x - o.x;
  let lz = p.z - o.z;
  if (moving) {
    lx += wishX * WALK * dt;
    lz += wishZ * WALK * dt;
  }
  if (lx < 0.7) {
    p.cave = -1;
    p.x = cave.x - Math.sin(cave.yaw) * 3.2;
    p.z = cave.z - Math.cos(cave.yaw) * 3.2;
    p.y = sampleInto(p.x, p.z, tmp).y;
    p.air = false;
    p.vy = 0;
    p.speed = 0;
    p.climbing = false;
    p.stamina = Math.min(100, p.stamina + REGEN * dt);
    return;
  }
  if (lx > 18.6) lx = 18.6;
  if (lz > 2.45) lz = 2.45;
  if (lz < -2.45) lz = -2.45;
  p.x = o.x + lx;
  p.z = o.z + lz;
  p.y = 0;
  p.air = false;
  p.vy = 0;
  p.climbing = false;
  p.speed = moving ? WALK : 0;
  p.stamina = Math.min(100, p.stamina + REGEN * dt);
  if (a.jump && p.stamina > 8) {
    p.stamina = Math.max(0, p.stamina - 4);
  }
}
