// @ts-nocheck
import * as THREE from "three";

const RANGE = 60;
let breakZero = false;

export function setNudgeBreak(on) {
  breakZero = !!on;
}

function zeroed() {
  if (breakZero) return true;
  return typeof window !== "undefined" && !!window.__stillmereBreak?.zeroOffset;
}

function hash(n) {
  let x = Math.imul(n ^ 0x571ead, 0x27bb2ee6);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

/** Seeded offset so a hint is never centred on the treasure. */
export function hintOffset(id) {
  if (zeroed()) return { x: 0, z: 0 };
  const a = hash(id * 17 + 3) * Math.PI * 2;
  const r = 9 + hash(id * 29 + 5) * 14;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

export function tellKind(id) {
  return ["flowers", "cairn", "bush", "bird"][Math.abs(id) % 4];
}

export function fireflyCount(id) {
  return 3 + (Math.abs(id) % 4);
}

export function shouldShowFireflies(dist) {
  return dist <= RANGE;
}

export function createHints(scene) {
  const flyGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const flyMat = new THREE.MeshBasicMaterial({ color: 0xffe7a0, fog: false });
  const flies = new THREE.InstancedMesh(flyGeo, flyMat, 6);
  flies.count = 0;
  flies.frustumCulled = false;
  scene.add(flies);

  const flowerGeo = new THREE.ConeGeometry(0.12, 0.32, 5);
  flowerGeo.translate(0, 0.16, 0);
  const flowerMat = new THREE.MeshLambertMaterial({ color: 0xe07a62 });
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 40);
  flowers.count = 0;
  flowers.frustumCulled = false;
  scene.add(flowers);

  const rockGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8074 });
  const cairn = new THREE.InstancedMesh(rockGeo, rockMat, 24);
  cairn.count = 0;
  cairn.frustumCulled = false;
  scene.add(cairn);

  const bushGeo = new THREE.SphereGeometry(0.28, 7, 5);
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x3e7a4a });
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, 12);
  bushes.count = 0;
  bushes.frustumCulled = false;
  scene.add(bushes);

  const bird = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 7, 5),
    new THREE.MeshLambertMaterial({ color: 0x6a5344 }),
  );
  body.scale.set(1.3, 0.8, 1);
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.03, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x4e4036 }),
  );
  wing.position.y = 0.04;
  bird.add(body, wing);
  bird.visible = false;
  scene.add(bird);

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _v = new THREE.Vector3();
  const haze = [];
  const state = { dist: Infinity, flies: 0, offset: 0, id: -1 };

  function put(mesh, i, x, y, z, rot, sx, sy, sz) {
    _v.set(x, y, z);
    _q.setFromAxisAngle(_v.set(0, 1, 0), rot);
    _v.set(x, y, z);
    _s.set(sx, sy, sz);
    _m.compose(_v, _q, _s);
    mesh.setMatrixAt(i, _m);
  }

  return {
    hazes: () => haze,
    state,
    update(sim, treasures, found, now) {
      haze.length = 0;
      let flyN = 0;
      let flowerN = 0;
      let cairnN = 0;
      let bushN = 0;
      let birdTarget = null;
      let birdDist = Infinity;
      const nearFly = { d: Infinity, t: null };

      for (let i = 0; i < treasures.length; i++) {
        const t = treasures[i];
        if (found.has(t.id) || t.kind === "relic") continue;
        const off = hintOffset(t.id);
        const d = Math.hypot(sim.x - t.x, sim.z - t.z);
        if (d < 800) haze.push({ x: t.x + off.x, z: t.z + off.z, id: t.id });
        if (shouldShowFireflies(d) && d < nearFly.d) nearFly.d = d, nearFly.t = t;
        if (d > 80 || sim.cave >= 0) continue;
        const kind = tellKind(t.id);
        if (kind === "flowers" && flowerN < 35) {
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + t.id;
            put(flowers, flowerN++, t.x + Math.cos(a) * 0.85, t.y, t.z + Math.sin(a) * 0.85, a, 1, 1, 1);
          }
        } else if (kind === "cairn" && cairnN < 21) {
          put(cairn, cairnN++, t.x + 0.7, t.y + 0.12, t.z + 0.2, 0.4, 1.1, 0.8, 1);
          put(cairn, cairnN++, t.x + 0.85, t.y + 0.32, t.z + 0.15, 1.2, 0.75, 0.7, 0.75);
          put(cairn, cairnN++, t.x + 0.78, t.y + 0.48, t.z + 0.22, 0.2, 0.5, 0.45, 0.5);
        } else if (kind === "bush" && bushN < 12) {
          const sway = 1 + Math.sin(now * 3 + t.id) * 0.08;
          put(bushes, bushN++, t.x + 0.6, t.y + 0.22, t.z - 0.3, t.id, sway, 1, sway);
        } else if (kind === "bird" && d < birdDist) {
          birdDist = d;
          birdTarget = t;
        }
      }

      if (nearFly.t && sim.cave < 0) {
        const t = nearFly.t;
        const n = fireflyCount(t.id);
        for (let k = 0; k < n; k++) {
          const a = now * (0.6 + k * 0.15) + k * 1.7;
          const rad = 1.6 + (k % 3) * 0.7;
          const y = t.y + 0.8 + Math.sin(now * 2 + k) * 0.35;
          put(flies, flyN++, t.x + Math.cos(a) * rad, y, t.z + Math.sin(a) * rad, 0, 1, 1, 1);
        }
      }
      flies.count = flyN;
      flies.instanceMatrix.needsUpdate = true;
      flowers.count = flowerN;
      flowers.instanceMatrix.needsUpdate = true;
      cairn.count = cairnN;
      cairn.instanceMatrix.needsUpdate = true;
      bushes.count = bushN;
      bushes.instanceMatrix.needsUpdate = true;
      state.dist = nearFly.d;
      state.flies = flyN;
      state.id = nearFly.t ? nearFly.t.id : -1;
      state.offset = nearFly.t ? Math.hypot(hintOffset(nearFly.t.id).x, hintOffset(nearFly.t.id).z) : 0;

      if (birdTarget && sim.cave < 0) {
        const land = now % 6 < 4;
        const y = land ? birdTarget.y + 0.35 : birdTarget.y + 1.6 + Math.sin(now * 4) * 0.2;
        const x = birdTarget.x + 1.4 + (land ? 0 : Math.sin(now) * 0.8);
        const z = birdTarget.z + 0.4;
        bird.visible = true;
        bird.position.set(x, y, z);
        wing.rotation.z = Math.sin(now * (land ? 2 : 14)) * (land ? 0.15 : 0.7);
      } else {
        bird.visible = false;
      }
    },
  };
}
