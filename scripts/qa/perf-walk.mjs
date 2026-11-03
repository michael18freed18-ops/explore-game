import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { getWorld } from "../../src/game/world/catalog.js";
import { sample } from "../../src/game/world/sample.js";
import { createSim, stepSim } from "../../src/game/sim.js";

const world = getWorld();

/** Straight steering on the real walker. Nav-cell paths can stop on a lip the 20 m grid calls climbable. */
function driveTo(goals) {
  const sim = createSim(world.spawn);
  const crumbs = [{ x: sim.x, z: sim.z }];
  let gi = 0;
  let stuck = 0;
  let lx = sim.x;
  let lz = sim.z;
  for (let s = 0; s < 400 * 30 && gi < goals.length; s++) {
    const g = goals[gi];
    if (Math.hypot(g.x - sim.x, g.z - sim.z) < 14) {
      gi++;
      crumbs.push({ x: g.x, z: g.z });
      stuck = 0;
      continue;
    }
    sim.yaw = Math.atan2(-(g.x - sim.x), -(g.z - sim.z));
    stepSim(sim, { moveX: 0, moveY: 1, jump: false, climb: true, sense: false, lookX: 0, lookY: 0 }, 1 / 30, world);
    const moved = Math.hypot(sim.x - lx, sim.z - lz);
    if (moved < 0.02) stuck++;
    else stuck = 0;
    lx = sim.x;
    lz = sim.z;
    if (stuck > 50) {
      console.error("drive stuck", goals[gi], Math.round(sim.x), Math.round(sim.z), sample(sim.x, sim.z).biome);
      process.exit(1);
    }
    const c = crumbs[crumbs.length - 1];
    if (Math.hypot(c.x - sim.x, c.z - sim.z) > 8) crumbs.push({ x: sim.x, z: sim.z });
  }
  if (gi < goals.length) {
    console.error("drive timed out", gi);
    process.exit(1);
  }
  return crumbs;
}

const targets = [
  { biome: "forest", x: 880, z: 1040 },
  { biome: "snow", x: 560, z: 560 },
];
const out = driveTo(targets);
const back = [...out].reverse();
const path = out.concat(back, out, back);
console.log(
  "anchors",
  targets.map((t) => `${t.biome}@${t.x},${t.z}`).join(" "),
  "points",
  path.length,
);

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  userAgent:
    "Mozilla/5.0 (Linux; Android 16; SM-F966B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
});
const page = await context.newPage();
const client = await context.newCDPSession(page);
await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForFunction(() => window.__wander?.ready, null, { timeout: 30000 });
await page.click("#begin");
await page.evaluate((pts) => {
  window.__wander.setQuality("low");
  window.__wander.setPath(pts);
}, path);

const samples = [];
const t0 = Date.now();
const DURATION = 10 * 60 * 1000;
while (Date.now() - t0 < DURATION) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => window.__wander.stats());
  const row = {
    t: Math.round((Date.now() - t0) / 1000),
    fps: Math.round(s.fps * 10) / 10,
    draws: s.draws,
    tris: s.tris,
    heap: s.heap,
    x: Math.round(s.x),
    z: Math.round(s.z),
    biome: s.biome,
    tier: s.tier,
    resScale: Math.round(s.resScale * 100) / 100,
  };
  samples.push(row);
  const nearSpawn = Math.hypot(row.x - world.spawn.x, row.z - world.spawn.z) < 25;
  const stuckHome =
    samples.length > 8 &&
    nearSpawn &&
    samples.slice(-4).every((r) => Math.hypot(r.x - world.spawn.x, r.z - world.spawn.z) < 25);
  if (stuckHome) {
    console.log("reapply path, stuck at spawn", row.t);
    await page.waitForFunction(() => window.__wander?.ready, null, { timeout: 20000 });
    const begin = page.locator("#begin");
    if (await begin.isVisible().catch(() => false)) await begin.click();
    await page.evaluate((pts) => {
      window.__wander.setQuality("low");
      window.__wander.setPath(pts);
    }, path);
  }
  if (samples.length % 6 === 0) {
    console.log(JSON.stringify(row));
    writeFileSync("/tmp/perf-walk-partial.json", JSON.stringify({ partial: true, samples, errors }, null, 2));
  }
}

const fps = samples.map((s) => s.fps);
const draws = samples.map((s) => s.draws);
const heaps = samples.map((s) => s.heap);
const warm = samples.filter((s) => s.t >= 20);
const warmFps = warm.map((s) => s.fps);
const biomes = [...new Set(samples.map((s) => s.biome))];
const summary = {
  throttled: "4x",
  viewport: "412x915 mobile dpr2",
  seconds: 600,
  samples: samples.length,
  minFps: Math.min(...fps),
  avgFps: Math.round((fps.reduce((a, b) => a + b, 0) / fps.length) * 10) / 10,
  warmMinFps: warmFps.length ? Math.min(...warmFps) : null,
  warmAvgFps: warmFps.length
    ? Math.round((warmFps.reduce((a, b) => a + b, 0) / warmFps.length) * 10) / 10
    : null,
  minDraws: Math.min(...draws),
  maxDraws: Math.max(...draws),
  avgDraws: Math.round(draws.reduce((a, b) => a + b, 0) / draws.length),
  maxTris: Math.max(...samples.map((s) => s.tris || 0)),
  heapStart: heaps[0],
  heapEnd: heaps[heaps.length - 1],
  heapMax: Math.max(...heaps),
  biomes,
  errors,
  targets: targets.map((t) => ({ biome: t.biome, x: Math.round(t.x), z: Math.round(t.z) })),
};
writeFileSync("/workspace/screenshots/perf-walk.json", JSON.stringify({ summary, samples }, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
