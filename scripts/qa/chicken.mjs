import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { getWorld } from "../../src/game/world/catalog.js";

mkdirSync("/workspace/screenshots", { recursive: true });
const world = getWorld();
const meadow = world.landmarks.find((l) => l.biome === "meadow") || world.landmarks[0];

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader", "--disable-dev-shm-usage"],
});

async function boot(page, flags) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 180));
  });
  if (flags) {
    await page.addInitScript((f) => {
      window.__stillmereBreak = f;
    }, flags);
  }
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__wander?.ready, null, { timeout: 25000 });
  await page.click("#begin");
  await page.evaluate(() => {
    window.__wander.setTime(0.42);
    window.__wander.setQuality("high");
  });
  await page.evaluate(({ x, z }) => window.__wander.teleport(x, z), { x: meadow.x + 80, z: meadow.z + 36 });
  await page.waitForTimeout(500);
  return errors;
}

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  return page.evaluate(() => window.__wander.anim());
}

const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const errors = await boot(page);

await page.evaluate(() => window.__wander.setPose("idle"));
await page.waitForTimeout(600);
const idle = await shot(page, "chicken-idle");

await page.evaluate(() => {
  window.__wander.setPose("walk");
  window.__wander.seek(1.1);
});
await page.waitForTimeout(280);
const walkA = await shot(page, "chicken-walk-1");

await page.evaluate(() => window.__wander.seek(1.1 + Math.PI));
await page.waitForTimeout(280);
const walkB = await shot(page, "chicken-walk-2");

await page.evaluate(() => window.__wander.setPose("jump"));
await page.waitForTimeout(450);
const jump = await shot(page, "chicken-jump");

const states = {};
for (const name of ["idle", "walk", "jump", "climb"]) {
  await page.evaluate((n) => window.__wander.setPose(n), name);
  await page.waitForTimeout(220);
  states[name] = (await page.evaluate(() => window.__wander.anim())).state;
}

const live = [];
await page.evaluate(() => window.__wander.setPose("idle"));
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(80);
  live.push((await page.evaluate(() => window.__wander.anim())).bob);
}
const liveSpan = Math.max(...live) - Math.min(...live);

await page.close();

async function spanOf(flags) {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
  const errs = await boot(p, flags);
  await p.evaluate(() => window.__wander.setPose("walk"));
  const bobs = [];
  const wings = [];
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(80);
    const a = await p.evaluate(() => window.__wander.anim());
    bobs.push(a.bob);
    wings.push(a.wingL);
  }
  const anim = await p.evaluate(() => window.__wander.anim());
  await p.close();
  return {
    errs,
    bobSpan: Math.max(...bobs) - Math.min(...bobs),
    wingSpan: Math.max(...wings) - Math.min(...wings),
    state: anim.state,
  };
}

const frozen = await spanOf({ freezeAnim: true });

const air = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
const airErr = await boot(air, { noAirPose: true });
await air.evaluate(() => window.__wander.setPose("jump"));
await air.waitForTimeout(450);
const airPose = await air.evaluate(() => window.__wander.anim());
await air.close();

const soft = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
const softErr = await boot(soft, { tinyTex: true });
await soft.evaluate(() => window.__wander.setPose("idle"));
await soft.waitForTimeout(300);
const softPose = await soft.evaluate(() => window.__wander.anim());
await soft.close();

for (const [w, h, name] of [
  [904, 2316, "chicken-fold"],
  [1968, 2184, "chicken-unfold"],
]) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await boot(p);
  await p.evaluate(() => window.__wander.setPose("jump"));
  await p.waitForTimeout(450);
  await p.screenshot({ path: `/workspace/screenshots/${name}.png` });
  await p.close();
}

const sharpPass = idle.tex >= idle.need;
const sharpFail = softPose.tex < softPose.need;

console.log(
  JSON.stringify(
    {
      errors,
      idle: { state: idle.state, tex: idle.tex, need: +idle.need.toFixed(1), dpr: idle.dpr },
      walkA: { state: walkA.state, legL: +walkA.legL.toFixed(2), legR: +walkA.legR.toFixed(2) },
      walkB: { state: walkB.state, legL: +walkB.legL.toFixed(2), legR: +walkB.legR.toFixed(2) },
      jump: { state: jump.state, wingsOpen: jump.wingsOpen, legsSpread: jump.legsSpread, wingL: +jump.wingL.toFixed(2), legL: +jump.legL.toFixed(2) },
      states,
      liveSpan,
      frozen,
      animFail: frozen.bobSpan < 0.0001 && frozen.wingSpan < 0.0001,
      animPass: liveSpan > 0.0001,
      airPose: { wingsOpen: airPose.wingsOpen, legsSpread: airPose.legsSpread, errs: airErr },
      jumpFail: airPose.wingsOpen === false || airPose.legsSpread === false,
      jumpPass: jump.wingsOpen && jump.legsSpread,
      softPose: { tex: softPose.tex, need: +softPose.need.toFixed(1), errs: softErr },
      sharpPass,
      sharpFail,
    },
    null,
    2,
  ),
);
await browser.close();
