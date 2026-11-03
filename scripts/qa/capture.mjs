import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { getWorld } from "../../src/game/world/catalog.js";
import { BIOMES } from "../../src/game/world/sample.js";

mkdirSync("/workspace/screenshots", { recursive: true });
const world = getWorld();

function spotFor(biome) {
  const lm = world.landmarks.find((l) => l.biome === biome);
  if (lm) return { x: lm.x + 28, z: lm.z + 18 };
  const t = world.treasures.find((t) => t.biome === biome && t.kind !== "relic");
  return { x: t.x, z: t.z };
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader", "--disable-dev-shm-usage"],
});

async function boot(page, { breakFlags } = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  if (breakFlags) {
    await page.addInitScript((flags) => {
      window.__stillmereBreak = flags;
    }, breakFlags);
  }
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__wander?.ready, null, { timeout: 25000 });
  await page.click("#begin");
  await page.evaluate(() => {
    window.__wander.setTime(0.38);
    window.__wander.setQuality("high");
  });
  await page.waitForFunction(() => window.__wander.assets === true, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(700);
  return errors;
}

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = await boot(page);

const biomeReport = [];
for (const biome of BIOMES) {
  const spot = spotFor(biome);
  await page.evaluate(({ x, z }) => window.__wander.teleport(x, z), spot);
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => window.__wander.stats());
  await page.screenshot({ path: `/workspace/screenshots/biome-${biome}.png` });
  biomeReport.push({ biome, draws: st.draws, tris: st.tris, at: st.biome });
}

await page.evaluate(() => window.__wander.teleport(830, 1130));
await page.waitForTimeout(600);
const poses = {};
for (const pose of ["idle", "walk", "jump"]) {
  await page.evaluate((name) => window.__wander.setPose(name), pose);
  await page.waitForTimeout(450);
  const anim = await page.evaluate(() => window.__wander.anim());
  await page.screenshot({ path: `/workspace/screenshots/mouse-${pose}.png` });
  poses[pose] = { state: anim.state, wingsOpen: anim.wingsOpen, legsSpread: anim.legsSpread };
}
const poseYs = [];
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(120);
  poseYs.push((await page.evaluate(() => window.__wander.anim())).bob);
}

const trinket = world.treasures.find((t) => t.kind === "trinket");
await page.evaluate(({ x, z }) => {
  window.__wander.setPose(null);
  window.__wander.teleport(x + 48, z + 12);
}, trinket);
await page.waitForTimeout(400);
const farNudge = await page.evaluate(() => window.__wander.nudge());
await page.evaluate(({ x, z }) => {
  const dx = x - (x + 8);
  const dz = z - (z + 6);
  window.__controlsTest.setYaw(Math.atan2(-dx, -dz));
  window.__wander.teleport(x + 8, z + 6);
}, trinket);
await page.waitForTimeout(500);
const nearNudge = await page.evaluate(() => window.__wander.nudge());
const sense = await page.evaluate(() => window.__wander.pingSense());
await page.screenshot({ path: "/workspace/screenshots/firefly-tell.png" });

const caveReport = [];
for (const cave of world.caves) {
  await page.evaluate((id) => window.__wander.enterCave(id), cave.id);
  await page.waitForTimeout(350);
  const st = await page.evaluate(() => window.__wander.stats());
  await page.screenshot({ path: `/workspace/screenshots/cave-${cave.id}.png` });
  caveReport.push({ id: cave.id, draws: st.draws, tris: st.tris });
}

await page.close();

const layouts = [
  [904, 2316, "fold-cover-portrait"],
  [2316, 904, "fold-cover-landscape"],
  [1968, 2184, "fold-inner-portrait"],
  [2184, 1968, "fold-inner-landscape"],
];
const layoutReport = [];
for (const [w, h, name] of layouts) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = await boot(p);
  await p.screenshot({ path: `/workspace/screenshots/${name}.png` });
  layoutReport.push({ name, errors: errs });
  await p.close();
}

async function poseSpan(flags) {
  const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await boot(p, { breakFlags: flags });
  await p.evaluate(() => window.__wander.setPose("idle"));
  const ys = [];
  const clips = [];
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(100);
    const a = await p.evaluate(() => window.__wander.anim());
    ys.push(a.bob);
    clips.push(a.state);
  }
  await p.close();
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  return { clips: [...new Set(clips)], span: max - min };
}

const animGood = await poseSpan(null);
const animFrozen = await poseSpan({ freezeAnim: true });

const hidden = await browser.newPage({ viewport: { width: 800, height: 600 } });
await boot(hidden, { breakFlags: { hideMouse: true, caveFog: true } });
await hidden.screenshot({ path: "/workspace/screenshots/break-hidden-mouse.png" });
await hidden.evaluate(() => window.__wander.enterCave(0));
await hidden.waitForTimeout(300);
await hidden.screenshot({ path: "/workspace/screenshots/break-cave-fog.png" });
await hidden.close();

const zero = await browser.newPage({ viewport: { width: 800, height: 600 } });
await boot(zero, { breakFlags: { zeroOffset: true } });
await zero.evaluate(({ x, z }) => window.__wander.teleport(x + 8, z + 6), trinket);
await zero.waitForTimeout(300);
const zeroNudge = await zero.evaluate(() => window.__wander.nudge());
const zeroSense = await zero.evaluate(() => window.__wander.pingSense());
await zero.close();

const loose = await browser.newPage({ viewport: { width: 800, height: 600 } });
await boot(loose, { breakFlags: { noInstance: true } });
await loose.evaluate(() => window.__wander.teleport(830, 1130));
await loose.waitForTimeout(800);
const looseStats = await loose.evaluate(() => window.__wander.stats());
await loose.close();

console.log(
  JSON.stringify(
    {
      errors,
      biomeReport,
      poses,
      poseYs,
      farNudge,
      nearNudge,
      sense,
      caveReport,
      layoutReport,
      animGood,
      animFrozen,
      zeroNudge,
      zeroSense,
      looseStats: { draws: looseStats.draws, tris: looseStats.tris },
    },
    null,
    2,
  ),
);
await browser.close();
