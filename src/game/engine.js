// @ts-nocheck
import * as THREE from "three";
import { createAudio } from "./audio.js";
import { loadPropLibrary } from "./assets.js";
import { biomeLabel, createHud } from "./hud.js";
import { createInput } from "./input.js";
import { createMouse } from "./mouse.js";
import { createHints, hintOffset } from "./nudge.js";
import { loadSave, writeSave } from "./save.js";
import { createSim, stepSim } from "./sim.js";
import { caveOrigin, getWorld } from "./world/catalog.js";
import { buildChunkGeometry } from "./world/chunkData.js";
import {
  LOOM,
  buildCaveInterior,
  buildCaveMouth,
  buildLandmark,
  cactusGeometry,
  chestGeometry,
  finalize,
  makeBuf,
  mountainGeometry,
  relicGeometry,
  rockGeometry,
  treeGeometry,
  trinketGeometry,
  tuftGeometry,
  cone,
} from "./world/geo.js";
import { findPath } from "./world/nav.js";
import { CHUNK, HALF, WATER, sampleInto } from "./world/sample.js";

const PRESETS = {
  low: { radius: 2, seg: 7, fog: 110, near: 36, pixel: 0.34 },
  medium: { radius: 3, seg: 10, fog: 220, near: 85, pixel: 0.92 },
  high: { radius: 3, seg: 10, fog: 240, near: 80, pixel: 0.85 },
};

const tmp = { y: 0, biome: "meadow", moisture: 0, temp: 0 };
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

function geoOf(data) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  g.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
  g.computeVertexNormals();
  return g;
}

function makeInstances(geometry, cap) {
  const mat = new THREE.MeshLambertMaterial({ flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, mat, cap);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  return mesh;
}

function putInstance(mesh, i, x, y, z, rot, scale, r, g, b) {
  _v.set(x, y, z);
  _q.setFromAxisAngle(_up, rot);
  _s.set(scale, scale, scale);
  _m.compose(_v, _q, _s);
  mesh.setMatrixAt(i, _m);
  _c.setRGB(r, g, b, THREE.SRGBColorSpace);
  mesh.setColorAt(i, _c);
}

export function startGame(root) {
  const hud = createHud(root);
  const input = createInput(root);
  const audio = createAudio();
  const bag = { dead: false };
  let cleanup = () => {};

  const boot = () => {
    if (bag.dead) return;
    let world;
    try {
      world = getWorld();
    } catch (err) {
      hud.setBoot("The land failed to settle");
      console.error(err);
      return;
    }
    if (bag.dead) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let mode = "auto";
    let tier = "medium";
    let resScale = 1;
    let playing = false;
    let token = 1;
    let senseId = null;
    let senseCd = 0;
    let chimeT = 0;
    let buzzed = false;
    let timeOfDay = 0.34;
    let timeFreeze = null;
    let path = null;
    let pathI = 0;
    let acc = 0;
    let fpsEma = 60;
    let minFps = 60;
    let fpsSum = 0;
    let fpsN = 0;
    let lastCalls = 0;
    let qualityLock = 0;
    let bad = 0;
    let good = 0;
    let spike = [];
    const found = new Set(loadSave());

    const canvas = hud.canvas;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xc5d5de, 1);
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.08, 900);
    const outdoor = new THREE.Group();
    const interior = new THREE.Group();
    scene.add(outdoor, interior);

    const hemi = new THREE.HemisphereLight(0xd5e6ef, 0x6d7a58, 0.95);
    const dir = new THREE.DirectionalLight(0xfff0d8, 0.85);
    dir.position.set(60, 90, 30);
    scene.add(hemi, dir);
    const caveLight = new THREE.PointLight(0xe0a15a, 0, 14);
    interior.add(caveLight);

    const lambert = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const skyGeo = new THREE.SphereGeometry(420, 16, 12);
    const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    paintSky(skyGeo, 0.34);
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    scene.fog = new THREE.Fog(0xc5d5de, 80, 220);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(HALF, 48),
      new THREE.MeshBasicMaterial({ color: 0x2f7590, transparent: true, opacity: 0.72, depthWrite: false }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER + 0.08;
    outdoor.add(water);

    const sim = createSim(world.spawn);
    sim.yaw = Math.atan2(world.spawn.x, world.spawn.z);

    const mouse = createMouse();
    const player = mouse.rig;
    scene.add(player);
    const blobTex = blobTexture();
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: 0x000000 }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.scale.setScalar(0.55);
    scene.add(blob);

    const trees = makeInstances(geoOf(treeGeometry()), 700);
    const cacti = makeInstances(geoOf(cactusGeometry()), 220);
    const rocks = makeInstances(geoOf(rockGeometry()), 420);
    const tufts = makeInstances(geoOf(tuftGeometry()), 320);
    outdoor.add(trees, cacti, rocks, tufts);

    const trinketInst = [0, 1, 2].map((v) => {
      const mesh = new THREE.InstancedMesh(geoOf(trinketGeometry(v)), lambert, 48);
      mesh.count = 0;
      mesh.frustumCulled = false;
      outdoor.add(mesh);
      return mesh;
    });
    const chestInst = new THREE.InstancedMesh(geoOf(chestGeometry()), lambert, 24);
    chestInst.count = 0;
    chestInst.frustumCulled = false;
    outdoor.add(chestInst);

    const landmarkMeshes = world.landmarks.map((lm) => {
      const data = lm.type === "peak" ? mountainGeometry() : buildLandmark(lm.type);
      const mesh = new THREE.Mesh(geoOf(data), lambert);
      mesh.position.set(lm.x, lm.y, lm.z);
      mesh.rotation.y = lm.yaw;
      if (lm.type === "peak") mesh.scale.setScalar(48);
      mesh.visible = false;
      outdoor.add(mesh);
      return mesh;
    });
    const peakFar = new THREE.Mesh(geoOf(mountainGeometry()), lambert);
    peakFar.frustumCulled = false;
    peakFar.visible = false;
    scene.add(peakFar);

    const impostor = new THREE.InstancedMesh(
      geoOf(impostorGeo()),
      new THREE.MeshBasicMaterial({ vertexColors: false, color: 0x8ea0ae, fog: false, transparent: true, opacity: 0.88, depthWrite: false }),
      24,
    );
    impostor.frustumCulled = false;
    scene.add(impostor);

    const mouths = world.caves.map((cave) => {
      const mesh = new THREE.Mesh(geoOf(buildCaveMouth()), lambert);
      mesh.position.set(cave.x, cave.y, cave.z);
      mesh.rotation.y = cave.yaw + Math.PI;
      mesh.visible = false;
      outdoor.add(mesh);
      return mesh;
    });

    const caveMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const caveMesh = new THREE.Mesh(geoOf(buildCaveInterior()), caveMat);
    caveMesh.frustumCulled = false;
    interior.add(caveMesh);
    const relic = new THREE.Mesh(geoOf(relicGeometry()), lambert);
    relic.position.set(16.5, 1.15, 0.2);
    relic.frustumCulled = false;
    interior.add(relic);

    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({
        map: softDisc(),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);

    const hints = createHints(scene);
    let approachT = 0;
    let library = null;
    let lastTris = 0;
    const built = new Map();
    const wanted = new Set();
    let queue = [];
    let inflight = 0;
    let worker = null;
    try {
      worker = new Worker(new URL("./world/terrain.worker.js", import.meta.url), { type: "module" });
      worker.onmessage = (e) => {
        inflight = Math.max(0, inflight - 1);
        const msg = e.data;
        if (msg.token !== token || !wanted.has(keyOf(msg.cx, msg.cz))) {
          pump();
          return;
        }
        commitChunk(msg);
        pump();
      };
      worker.onerror = () => {
        worker = null;
      };
    } catch {
      worker = null;
    }

    function keyOf(cx, cz) {
      return `${cx}:${cz}`;
    }

    function preset() {
      return PRESETS[tier];
    }

    function commitChunk(msg) {
      const key = keyOf(msg.cx, msg.cz);
      const old = built.get(key);
      if (old) {
        outdoor.remove(old.mesh);
        old.mesh.geometry.dispose();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(msg.positions, 3));
      g.setAttribute("color", new THREE.BufferAttribute(msg.colors, 3));
      g.setIndex(new THREE.BufferAttribute(msg.indices, 1));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, lambert);
      outdoor.add(mesh);
      built.set(key, { mesh, props: msg.props, cx: msg.cx, cz: msg.cz });
      refreshProps();
    }

    function refreshProps() {
      const treeList = [];
      const tuftList = [];
      const cactusList = [];
      const rockList = [];
      for (const rec of built.values()) {
        const p = rec.props;
        for (let i = 0; i < p.length; i += 9) {
          const row = [p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5], p[i + 6], p[i + 7], p[i + 8]];
          const kind = p[i];
          if (kind === 0 || kind === 1) treeList.push(row);
          else if (kind === 2) cactusList.push(row);
          else if (kind === 3) rockList.push(row);
          else tuftList.push(row);
        }
      }
      writeList(trees, treeList);
      writeList(cacti, cactusList);
      writeList(rocks, rockList);
      writeList(tufts, tuftList);
      const trinkets = [[], [], []];
      const chests = [];
      for (const t of world.treasures) {
        if (found.has(t.id) || t.kind === "relic") continue;
        const cx = Math.floor(t.x / CHUNK);
        const cz = Math.floor(t.z / CHUNK);
        if (!built.has(`${cx}:${cz}`)) continue;
        const row = [t.x, t.y, t.z, t.id, 1];
        if (t.kind === "chest") chests.push(row);
        else trinkets[t.variant % 3].push(row);
      }
      writePlain(chestInst, chests);
      for (let v = 0; v < 3; v++) writePlain(trinketInst[v], trinkets[v]);
      if (library) {
        trees.visible = false;
        cacti.visible = false;
        rocks.visible = false;
        tufts.visible = false;
        library.sync(built, sim, preset().fog, !!(window.__stillmereBreak && window.__stillmereBreak.noInstance));
      }
    }

    function writePlain(mesh, list) {
      const cap = mesh.instanceMatrix.count;
      const n = Math.min(list.length, cap);
      for (let i = 0; i < n; i++) {
        const r = list[i];
        _v.set(r[0], r[1], r[2]);
        _q.setFromAxisAngle(_up, r[3] || 0);
        _s.set(r[4] || 1, r[4] || 1, r[4] || 1);
        _m.compose(_v, _q, _s);
        mesh.setMatrixAt(i, _m);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }

    function writeList(mesh, list) {
      const cap = mesh.instanceColor.count;
      const n = Math.min(list.length, cap);
      for (let i = 0; i < n; i++) {
        const r = list[i];
        putInstance(mesh, i, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    function pump() {
      if (bag.dead) return;
      while (inflight < 1 && queue.length) {
        const job = queue.shift();
        if (!wanted.has(job.key) || built.has(job.key)) continue;
        if (!worker) {
          const g = buildChunkGeometry(job.cx, job.cz, job.seg);
          commitChunk({ ...g, cx: job.cx, cz: job.cz, token });
          continue;
        }
        inflight++;
        worker.postMessage({ id: job.key, cx: job.cx, cz: job.cz, seg: job.seg, token });
        return;
      }
    }

    function reconcile() {
      const p = preset();
      const cx = Math.floor(sim.x / CHUNK);
      const cz = Math.floor(sim.z / CHUNK);
      const minC = Math.floor(-HALF / CHUNK);
      const maxC = Math.floor((HALF - 1) / CHUNK);
      const next = new Set();
      const jobs = [];
      for (let dz = -p.radius; dz <= p.radius; dz++) {
        for (let dx = -p.radius; dx <= p.radius; dx++) {
          const x = cx + dx;
          const z = cz + dz;
          if (x < minC || z < minC || x > maxC || z > maxC) continue;
          const key = keyOf(x, z);
          next.add(key);
          if (!built.has(key)) jobs.push({ key, cx: x, cz: z, seg: p.seg, d: dx * dx + dz * dz });
        }
      }
      for (const [key, rec] of built) {
        if (!next.has(key)) {
          outdoor.remove(rec.mesh);
          rec.mesh.geometry.dispose();
          built.delete(key);
        }
      }
      wanted.clear();
      for (const k of next) wanted.add(k);
      jobs.sort((a, b) => a.d - b.d);
      queue = jobs;
      refreshProps();
      pump();
    }

    function applyQuality(nextTier) {
      tier = nextTier;
      token++;
      inflight = 0;
      queue = [];
      for (const rec of built.values()) {
        outdoor.remove(rec.mesh);
        rec.mesh.geometry.dispose();
      }
      built.clear();
      wanted.clear();
      resize();
      reconcile();
    }

    function resize() {
      const w = root.clientWidth || window.innerWidth;
      const h = root.clientHeight || window.innerHeight;
      if (w < 2 || h < 2) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const longSide = Math.max(w, h);
      const cap = coarse ? 1280 : 1920;
      const fit = Math.min(1, cap / longSide);
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * preset().pixel * resScale * fit;
      renderer.setPixelRatio(Math.max(0.4, dpr));
      renderer.setSize(w, h, false);
      const p = preset();
      scene.fog.near = sim.cave >= 0 ? 4 : p.near;
      scene.fog.far = sim.cave >= 0 ? 26 : p.fog;
      camera.far = sim.cave >= 0 ? 80 : 900;
      camera.updateProjectionMatrix();
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(root);

    function skyColor(u) {
      const day = Math.sin(u * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
      const k = 0.42 + day * 0.58;
      return {
        top: new THREE.Color().setRGB(0.45 * k, 0.58 * k, 0.72 * k),
        horizon: new THREE.Color().setRGB(0.78 * k + 0.12, 0.8 * k, 0.74 * k + day * 0.05),
        light: 0.55 + day * 0.5,
      };
    }

    let skyStamp = -1;
    function updateSky(u) {
      const bucket = Math.round(u * 48);
      if (bucket === skyStamp) return;
      skyStamp = bucket;
      paintSky(skyGeo, u);
      const c = skyColor(u);
      scene.fog.color.copy(c.horizon);
      renderer.setClearColor(c.horizon, 1);
      hemi.intensity = 0.45 + c.light * 0.45;
      dir.intensity = 0.25 + c.light * 0.55;
      hemi.color.copy(c.top);
    }

    function updateCamera(dt) {
      if (!playing) sim.yaw += dt * 0.12;
      const inCave = sim.cave >= 0;
      const dist = inCave ? 1.7 : 1.95;
      const lx = -Math.sin(sim.yaw) * Math.cos(sim.pitch);
      const ly = Math.sin(sim.pitch);
      const lz = -Math.cos(sim.yaw) * Math.cos(sim.pitch);
      const ty = sim.y + (inCave ? 0.32 : 0.26);
      camera.position.set(sim.x - lx * dist, ty - ly * dist + 0.42, sim.z - lz * dist);
      if (!inCave) {
        const gy = sampleInto(camera.position.x, camera.position.z, tmp).y + 0.2;
        if (camera.position.y < gy) camera.position.y = gy;
      } else {
        const o = caveOrigin(sim.cave);
        const lxCam = camera.position.x - o.x;
        const lzCam = camera.position.z - o.z;
        camera.position.x = o.x + Math.min(18.2, Math.max(1.2, lxCam));
        camera.position.z = o.z + Math.min(2.15, Math.max(-2.15, lzCam));
        camera.position.y = Math.min(2.3, Math.max(0.35, camera.position.y));
      }
      sky.position.copy(camera.position);
      camera.lookAt(sim.x, ty, sim.z);
      camera.far = inCave ? 40 : 900;
      camera.updateProjectionMatrix();
    }

    function updatePlayer(dt) {
      mouse.update(sim, dt);
      blob.position.set(sim.x, sim.y + 0.03, sim.z);
      blob.visible = sim.cave < 0 && player.visible;
      if (sim.cave >= 0) {
        player.rotation.set(0, Math.PI / 2, 0);
        player.position.set(sim.x, sim.y, sim.z);
      } else {
        player.position.set(sim.x, sim.y, sim.z);
        _v.set(sim.x - Math.sin(sim.yaw), sim.y + 0.2, sim.z - Math.cos(sim.yaw));
        player.lookAt(_v);
      }
    }

    function pointOf(t) {
      if (t.kind === "relic" && sim.cave !== t.caveId) {
        sampleInto(t.mapX, t.mapZ, tmp);
        return { x: t.mapX, y: tmp.y + 0.4, z: t.mapZ };
      }
      return { x: t.x, y: t.y, z: t.z };
    }

    function nearest() {
      let best = null;
      let bestD = Infinity;
      let pt = null;
      for (let i = 0; i < world.treasures.length; i++) {
        const t = world.treasures[i];
        if (found.has(t.id)) continue;
        const p = pointOf(t);
        const d = Math.hypot(sim.x - p.x, sim.z - p.z);
        if (d < bestD) {
          bestD = d;
          best = t;
          pt = p;
        }
      }
      return { t: best, d: bestD, pt };
    }

    function updateSense(dt, now) {
      if (senseCd > 0) senseCd = Math.max(0, senseCd - dt);
      const active = senseId != null && !found.has(senseId) ? world.treasures[senseId] : null;
      if (!active) {
        ring.visible = false;
        return;
      }
      const pt = pointOf(active);
      const off = hintOffset(active.id);
      const dist = Math.hypot(sim.x - pt.x, sim.z - pt.z);
      const radius = Math.max(15, dist * 0.86);
      ring.visible = sim.cave < 0 || active.caveId === sim.cave;
      ring.position.set(pt.x + off.x, pt.y + 0.35, pt.z + off.z);
      ring.scale.setScalar(radius);
      const interval = Math.max(0.16, Math.min(1.35, dist / 170));
      if (playing && now > chimeT) {
        chimeT = now + interval;
        audio.sense(dist);
        if (dist < 28 && navigator.vibrate) navigator.vibrate(10);
      }
      if (dist < 16 && !buzzed && navigator.vibrate) {
        navigator.vibrate(24);
        buzzed = true;
      }
      if (dist > 24) buzzed = false;
    }

    function tryCollect() {
      for (let i = 0; i < world.treasures.length; i++) {
        const t = world.treasures[i];
        if (found.has(t.id)) continue;
        if (t.kind === "relic") {
          if (sim.cave !== t.caveId) continue;
          if (Math.hypot(sim.x - t.x, sim.z - t.z) > 1.7) continue;
        } else if (sim.cave >= 0) continue;
        else if (Math.hypot(sim.x - t.x, sim.z - t.z) > 2.15) continue;
        found.add(t.id);
        writeSave(found);
        audio.found(t.kind);
        if (navigator.vibrate) navigator.vibrate(18);
        const label = t.kind === "relic" ? "Relic" : t.kind === "chest" ? "Chest" : "Trinket";
        hud.flash(`${label}  ·  ${found.size}/150`);
        if (senseId === t.id) senseId = null;
        refreshProps();
        updateCounts();
        break;
      }
    }

    function updateCounts() {
      const totals = {};
      const got = {};
      for (const t of world.treasures) {
        totals[t.biome] = (totals[t.biome] || 0) + 1;
        if (found.has(t.id)) got[t.biome] = (got[t.biome] || 0) + 1;
      }
      const keys = ["meadow", "forest", "desert", "snow", "shore", "swamp", "autumn"];
      hud.setCounts(
        keys
          .map(
            (b) =>
              `<li><span>${biomeLabel(b)}</span><span>${got[b] || 0}/${totals[b] || 0}</span></li>`,
          )
          .join(""),
      );
    }

    function updateDressing() {
      const fog = sim.cave >= 0 ? 30 : preset().fog;
      for (let i = 0; i < world.landmarks.length; i++) {
        const lm = world.landmarks[i];
        const dx = lm.x - sim.x;
        const dz = lm.z - sim.z;
        const dist = Math.hypot(dx, dz) || 1;
        const near = dist < fog * 0.82;
        landmarkMeshes[i].visible = near && sim.cave < 0;
        const shell = fog * 0.93;
        if (sim.cave >= 0 || dist < fog * 0.72 || lm.type === "peak") {
          _s.set(0, 0, 0);
          _v.set(0, -999, 0);
        } else {
          const k = shell / dist;
          const h = LOOM[lm.type] || 10;
          _v.set(sim.x + dx * k, Math.max(6, h * k * 0.55), sim.z + dz * k);
          const s = Math.max(0.6, h * k);
          _s.set(s, s, s);
        }
        _q.identity();
        _m.compose(_v, _q, _s);
        impostor.setMatrixAt(i, _m);
      }
      impostor.instanceMatrix.needsUpdate = true;
      impostor.visible = sim.cave < 0;
      const peak = world.landmarks.findIndex((lm) => lm.type === "peak");
      if (peak >= 0 && sim.cave < 0) {
        const lm = world.landmarks[peak];
        const dx = lm.x - sim.x;
        const dz = lm.z - sim.z;
        const dist = Math.hypot(dx, dz) || 1;
        const near = dist < fog * 0.82;
        landmarkMeshes[peak].visible = near;
        if (!near) {
          const k = (fog * 0.93) / dist;
          peakFar.visible = true;
          peakFar.position.set(sim.x + dx * k, Math.max(lm.y * k, 8), sim.z + dz * k);
          const s = Math.max(6, 48 * k);
          peakFar.scale.setScalar(s);
        } else peakFar.visible = false;
      } else peakFar.visible = false;
      for (let i = 0; i < mouths.length; i++) {
        const c = world.caves[i];
        mouths[i].visible = sim.cave < 0 && Math.hypot(c.x - sim.x, c.z - sim.z) < fog;
      }
      outdoor.visible = sim.cave < 0;
      if (sim.cave >= 0) {
        const o = caveOrigin(sim.cave);
        interior.position.set(o.x, 0, o.z);
        interior.visible = true;
        caveLight.intensity = 8;
        caveLight.distance = 22;
        caveLight.color.setHex(0xffc48a);
        caveLight.position.set(16.5, 2.1, 0.2);
        const relicT = world.treasures.find((t) => t.kind === "relic" && t.caveId === sim.cave);
        relic.visible = !!relicT && !found.has(relicT.id);
        water.visible = false;
        sky.visible = false;
      } else {
        interior.visible = false;
        caveLight.intensity = 0;
        water.visible = true;
        sky.visible = true;
      }
    }

    function autopilot(actions) {
      if (!path || pathI >= path.length) return actions;
      const target = path[pathI];
      const dx = target.x - sim.x;
      const dz = target.z - sim.z;
      if (Math.hypot(dx, dz) < 12) {
        pathI++;
        if (pathI >= path.length) {
          path = null;
          return actions;
        }
      }
      sim.yaw = Math.atan2(-(target.x - sim.x), -(target.z - sim.z));
      return { ...actions, moveX: 0, moveY: 1, climb: true, lookX: 0, lookY: 0, jump: false };
    }

    function track(dt) {
      const fps = dt > 0 ? 1 / dt : 60;
      fpsEma = fpsEma * 0.9 + fps * 0.1;
      fpsN++;
      fpsSum += fps;
      if (fpsN > 40) minFps = Math.min(minFps, fps);
      if (qualityLock > 0) {
        qualityLock = Math.max(0, qualityLock - dt);
        return;
      }
      if (mode !== "auto" || !playing || fpsN < 30) return;
      if (fpsEma < 48) bad += dt;
      else bad = Math.max(0, bad - dt);
      if (fpsEma > 58) good += dt;
      else good = 0;
      if (bad > 0.45 && resScale > 0.55) {
        resScale = Math.max(0.55, resScale * 0.8);
        bad = 0;
        resize();
      } else if (bad > 0.45 && tier !== "low") {
        const order = ["low", "medium", "high"];
        applyQuality(order[Math.max(0, order.indexOf(tier) - 1)]);
        qualityLock = 1.5;
        bad = 0;
      }
      if (good > 4 && resScale < 1) {
        resScale = Math.min(1, resScale * 1.08);
        good = 0;
        resize();
      } else if (good > 4 && !coarse && tier !== "high") {
        const order = ["low", "medium", "high"];
        applyQuality(order[Math.min(2, order.indexOf(tier) + 1)]);
        qualityLock = 2;
        good = 0;
      }
    }

    const timer = new THREE.Timer();
    timer.connect(document);

    function frame() {
      if (bag.dead) return;
      timer.update();
      const dt = Math.min(0.1, timer.getDelta());
      const u = timeFreeze != null ? timeFreeze : (timer.getElapsed() % 480) / 480;
      timeOfDay = u;
      updateSky(u);
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 4) {
        let actions = playing
          ? input.read(1 / 60)
          : { moveX: 0, moveY: 0, jump: false, climb: false, sense: false, lookX: 0, lookY: 0 };
        if (playing && actions.sense && senseCd <= 0) {
          const n = nearest();
          if (n.t) {
            senseId = n.t.id;
            senseCd = 10;
            chimeT = 0;
            buzzed = false;
            audio.unlock();
            if (navigator.vibrate) navigator.vibrate(30);
          }
        }
        if (playing) actions = autopilot(actions);
        if (playing) stepSim(sim, actions, 1 / 60, world);
        if (playing) tryCollect();
        updateSense(1 / 60, performance.now() / 1000);
        acc -= 1 / 60;
        steps++;
      }
      updateCamera(dt);
      updatePlayer(dt);
      hints.update(sim, world.treasures, found, performance.now() / 1000);
      if (sim.cave < 0 && playing) {
        let nearD = Infinity;
        for (let i = 0; i < world.treasures.length; i++) {
          const t = world.treasures[i];
          if (found.has(t.id) || t.kind === "relic") continue;
          const d = Math.hypot(sim.x - t.x, sim.z - t.z);
          if (d < nearD) nearD = d;
        }
        if (nearD <= 60 && senseId == null && performance.now() / 1000 > approachT) {
          approachT = performance.now() / 1000 + 0.55 + nearD / 90;
          audio.approach(nearD);
        }
      }
      if (sim.cave < 0) {
        const cx = Math.floor(sim.x / CHUNK);
        const cz = Math.floor(sim.z / CHUNK);
        if (cx !== frame.cx || cz !== frame.cz || built.size === 0) {
          frame.cx = cx;
          frame.cz = cz;
          reconcile();
        } else pump();
      }
      updateDressing();
      const pset = preset();
      const caveWash = !!(window.__stillmereBreak && window.__stillmereBreak.caveFog);
      if (sim.cave >= 0) {
        scene.fog.color.setHex(caveWash ? 0xb7c4ce : 0x3a2c24);
        scene.fog.near = caveWash ? 0.05 : 10;
        scene.fog.far = caveWash ? 0.4 : 46;
        renderer.setClearColor(caveWash ? 0xb7c4ce : 0x241910, 1);
      } else {
        scene.fog.near = pset.near;
        scene.fog.far = pset.fog;
      }
      sampleInto(sim.x, sim.z, tmp);
      const place =
        sim.cave >= 0 ? `Cave ${sim.cave + 1} · ${biomeLabel(world.caves[sim.cave].biome)}` : biomeLabel(tmp.biome);
      hud.update(sim, {
        found: found.size,
        total: 150,
        place,
        stamina: sim.stamina,
        qualityLabel: mode === "auto" ? `Auto · ${tier}` : tier[0].toUpperCase() + tier.slice(1),
        fpsLabel: `${Math.round(fpsEma)} fps`,
        senseCd,
        dt,
        hazes: hints.hazes(),
      });
      renderer.render(scene, camera);
      lastCalls = renderer.info.render.calls;
      lastTris = renderer.info.render.triangles;
      track(dt);
    }

    renderer.setAnimationLoop(frame);
    resize();
    updateCounts();
    hud.paintBase();
    reconcile();
    loadPropLibrary()
      .then((lib) => {
        if (bag.dead || !lib) return;
        library = lib;
        lib.attach(outdoor);
        refreshProps();
        if (window.__wander) window.__wander.assets = true;
      })
      .catch((err) => console.error(err));

    function onVis() {
      if (document.hidden) renderer.setAnimationLoop(null);
      else renderer.setAnimationLoop(frame);
    }
    document.addEventListener("visibilitychange", onVis);

    function beginPlay() {
      if (playing) return;
      playing = true;
      input.setEnabled(true);
      audio.unlock();
      hud.setPlaying(true);
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    }
    hud.begin.addEventListener("click", beginPlay);
    if (window.__stillmereArm) beginPlay();
    hud.qualityBtn.addEventListener("click", () => {
      const order = ["auto", "low", "medium", "high"];
      const i = order.indexOf(mode);
      mode = order[(i + 1) % order.length];
      if (mode === "auto") tier = coarse ? "medium" : "high";
      else tier = mode;
      resScale = 1;
      applyQuality(tier);
    });

    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    window.__controlsTest = {
      getYaw: () => sim.yaw,
      getSpeed: () => sim.speed,
      setKeys: (codes) => input.setKeys(codes),
      setYaw: (y) => {
        sim.yaw = y;
      },
      getPos: () => ({ x: sim.x, y: sim.y, z: sim.z }),
    };
    window.__wander = {
      ready: true,
      world,
      found,
      teleport(x, z) {
        sim.cave = -1;
        sim.x = x;
        sim.z = z;
        sim.y = sampleInto(x, z, tmp).y;
        sim.air = false;
        sim.vy = 0;
        frame.cx = 99999;
      },
      enterCave(id) {
        sim.cave = id;
        const o = caveOrigin(id);
        sim.x = o.x + 8;
        sim.z = o.z;
        sim.y = 0;
        sim.yaw = -Math.PI / 2;
        sim.pitch = 0.08;
      },
      setPath(points) {
        path = points;
        pathI = 0;
      },
      setPathTo(x, z) {
        path = findPath(world.nav, world.reach, sim.x, sim.z, x, z);
        pathI = 0;
        return path.length;
      },
      clearPath() {
        path = null;
      },
      setTime(u) {
        timeFreeze = u;
        skyStamp = -1;
      },
      setQuality(name) {
        mode = name === "auto" ? "auto" : name;
        tier = name === "auto" ? (coarse ? "medium" : "high") : name;
        applyQuality(tier);
      },
      setSpike(on) {
        for (const m of spike) scene.remove(m);
        spike = [];
        if (!on) return;
        const g = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff00aa });
        for (let i = 0; i < 260; i++) {
          const m = new THREE.Mesh(g, mat);
          m.frustumCulled = false;
          m.position.set(sim.x + (i % 16) * 0.35, sim.y + 1.2, sim.z + Math.floor(i / 16) * 0.35);
          scene.add(m);
          spike.push(m);
        }
      },
      setHudSabotage(on) {
        root.classList.toggle("is-sabotage", !!on);
      },
      setPose(name) {
        window.__stillmereBreak = { ...(window.__stillmereBreak || {}), pose: name || null };
      },
      nudge() {
        return { ...hints.state };
      },
      pingSense() {
        const n = nearest();
        if (!n.t) return null;
        senseId = n.t.id;
        senseCd = 10;
        const off = hintOffset(n.t.id);
        const dist = Math.hypot(sim.x - n.pt.x, sim.z - n.pt.z);
        return {
          id: n.t.id,
          dist,
          offset: Math.hypot(off.x, off.z),
          radius: Math.max(15, dist * 0.86),
        };
      },
      anim() {
        return mouse.sample();
      },
      stats() {
        return {
          x: sim.x,
          y: sim.y,
          z: sim.z,
          yaw: sim.yaw,
          speed: sim.speed,
          biome: sampleInto(sim.x, sim.z, tmp).biome,
          cave: sim.cave,
          fps: fpsEma,
          minFps: fpsN > 90 ? minFps : fpsEma,
          avgFps: fpsN ? fpsSum / fpsN : fpsEma,
          draws: lastCalls,
          tris: lastTris,
          heap: performance.memory?.usedJSHeapSize || 0,
          found: found.size,
          tier,
          resScale,
          stamina: sim.stamina,
          playing,
        };
      },
    };

    cleanup = () => {
      renderer.setAnimationLoop(null);
      timer.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      input.dispose();
      worker?.terminate();
      for (const rec of built.values()) rec.mesh.geometry.dispose();
      renderer.dispose();
      delete window.__wander;
      delete window.__controlsTest;
    };
  };

  setTimeout(boot, 30);
  return () => {
    bag.dead = true;
    cleanup();
  };
}

function paintSky(geo, u) {
  const day = Math.sin(u * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
  const k = 0.42 + day * 0.58;
  const pos = geo.attributes.position;
  let colors = geo.getAttribute("color");
  if (!colors || colors.count !== pos.count) {
    colors = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    geo.setAttribute("color", colors);
  }
  const arr = colors.array;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.smoothstep(y / 420, -0.05, 0.72);
    arr[i * 3] = (0.78 * k + 0.1) * (1 - t) + 0.45 * k * t;
    arr[i * 3 + 1] = 0.8 * k * (1 - t) + 0.58 * k * t;
    arr[i * 3 + 2] = (0.74 * k + day * 0.05) * (1 - t) + 0.72 * k * t;
  }
  colors.needsUpdate = true;
}

function softDisc() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 18, 64, 64, 64);
  grd.addColorStop(0, "rgba(224,161,90,0)");
  grd.addColorStop(0.62, "rgba(224,161,90,0.08)");
  grd.addColorStop(0.82, "rgba(224,161,90,0.55)");
  grd.addColorStop(1, "rgba(224,161,90,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function blobTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, "rgba(0,0,0,0.4)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function impostorGeo() {
  const b = makeBuf();
  cone(b, 0, 0, 0, 0.45, 1, 6, [0.55, 0.62, 0.68]);
  return finalize(b);
}
