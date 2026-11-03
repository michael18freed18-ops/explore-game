import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { getWorld } from "../../src/game/world/catalog.js";
import { BIOMES } from "../../src/game/world/sample.js";

mkdirSync("/workspace/screenshots", { recursive: true });
const world = getWorld();

function spotFor(biome) {
  const lm = world.landmarks.find((l) => l.biome === biome);
  if (lm) return { x: lm.x + 28, z: lm.z + 18, label: lm.name };
  const t = world.treasures.find((t) => t.biome === biome && t.kind !== "relic");
  return { x: t.x, z: t.z, label: biome };
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader", "--disable-dev-shm-usage"],
});

async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__wander?.ready, null, { timeout: 20000 });
  await page.click("#begin");
  await page.evaluate(() => window.__wander.setTime(0.36));
  await page.waitForTimeout(600);
  return errors;
}

function overlap() {
  const sel = [".sm-status", ".sm-map", ".sm-stick", ".sm-actions"];
  const rects = sel.map((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { s, x: r.x, y: r.y, r: r.right, b: r.bottom };
  });
  const hits = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.x < b.r - 1 && a.r > b.x + 1 && a.y < b.b - 1 && a.b > b.y + 1) hits.push(`${a.s} x ${b.s}`);
    }
  }
  const off = rects
    .filter((r) => r.x < -1 || r.y < -1 || r.r > innerWidth + 1 || r.b > innerHeight + 1)
    .map((r) => r.s);
  return { hits, off };
}

const layouts = [
  [904, 2316, "fold-cover-portrait"],
  [2316, 904, "fold-cover-landscape"],
  [1968, 2184, "fold-inner-portrait"],
  [2184, 1968, "fold-inner-landscape"],
];

const layoutReport = [];
for (const [w, h, name] of layouts) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = await boot(page);
  const box = await page.evaluate(overlap);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  layoutReport.push({ name, w, h, ...box, errors });
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await boot(page);
const biomeReport = [];
for (const biome of BIOMES) {
  const spot = spotFor(biome);
  await page.evaluate(({ x, z }) => window.__wander.teleport(x, z), spot);
  await page.waitForTimeout(1400);
  const st = await page.evaluate(() => window.__wander.stats());
  await page.screenshot({ path: `/workspace/screenshots/biome-${biome}.png` });
  biomeReport.push({ biome, spot, at: { x: st.x, z: st.z, place: st.biome }, draws: st.draws });
}

const caveReport = [];
for (const cave of world.caves) {
  await page.evaluate((id) => window.__wander.enterCave(id), cave.id);
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => window.__wander.stats());
  await page.screenshot({ path: `/workspace/screenshots/cave-${cave.id}.png` });
  caveReport.push({ id: cave.id, biome: cave.biome, cave: st.cave, draws: st.draws });
}

await page.evaluate(() => window.__wander.setHudSabotage(true));
const sabOverlap = await page.evaluate(overlap);
await page.screenshot({ path: "/workspace/screenshots/sabotage-overlap.png" });
await page.evaluate(() => window.__wander.setHudSabotage(false));
const restored = await page.evaluate(overlap);

await page.evaluate(() => window.__wander.teleport(830, 1130));
await page.waitForTimeout(800);
const baseDraws = (await page.evaluate(() => window.__wander.stats())).draws;
await page.evaluate(() => window.__wander.setSpike(true));
await page.waitForTimeout(300);
const spikeDraws = (await page.evaluate(() => window.__wander.stats())).draws;
await page.evaluate(() => window.__wander.setSpike(false));
await page.waitForTimeout(200);
const afterDraws = (await page.evaluate(() => window.__wander.stats())).draws;

console.log(
  JSON.stringify(
    {
      layoutReport,
      biomeReport,
      caveReport,
      sabotage: { sabOverlap, restored, baseDraws, spikeDraws, afterDraws },
    },
    null,
    2,
  ),
);
await browser.close();
