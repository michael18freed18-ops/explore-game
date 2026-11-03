// @ts-nocheck
import * as THREE from "three";

const INK = "rgba(90, 62, 46, 0.88)";
const WING_OPEN = 1.28;
const LEG_OPEN = 0.95;

function texSize(meters, tiny) {
  if (tiny) return 64;
  return Math.max(192, Math.round((meters / 0.5) * 2048));
}

function makeTex(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, w, h);
  g.lineJoin = "round";
  g.lineCap = "round";
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function ink(g, w) {
  g.lineWidth = Math.max(1.5, w * 0.018);
  g.strokeStyle = INK;
  g.stroke();
}

function drawBody(g, w, h) {
  const cx = w * 0.48;
  const cy = h * 0.52;
  const rx = w * 0.4;
  const ry = h * 0.38;
  const grd = g.createRadialGradient(cx - rx * 0.25, cy - ry * 0.35, rx * 0.05, cx, cy, rx * 1.05);
  grd.addColorStop(0, "#fffdf8");
  grd.addColorStop(0.45, "#fff4e4");
  grd.addColorStop(1, "#efd3ae");
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, -0.08, 0, Math.PI * 2);
  g.fill();
  ink(g, w);
}

function drawHead(g, w, h) {
  const cx = w * 0.46;
  const cy = h * 0.55;
  const r = Math.min(w, h) * 0.36;
  const grd = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.08, cx, cy, r);
  grd.addColorStop(0, "#fffefb");
  grd.addColorStop(0.7, "#fff1dc");
  grd.addColorStop(1, "#f0d4b0");
  g.fillStyle = grd;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  ink(g, w);
  g.fillStyle = "rgba(242, 176, 160, 0.45)";
  g.beginPath();
  g.ellipse(cx + r * 0.15, cy + r * 0.35, r * 0.28, r * 0.16, 0, 0, Math.PI * 2);
  g.fill();
}

function drawComb(g, w, h) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#ff6d6a");
  grd.addColorStop(1, "#d32632");
  g.fillStyle = grd;
  g.beginPath();
  const y = h * 0.72;
  g.moveTo(w * 0.12, y);
  g.bezierCurveTo(w * 0.18, h * 0.08, w * 0.34, h * 0.08, w * 0.36, h * 0.42);
  g.bezierCurveTo(w * 0.42, h * 0.02, w * 0.58, h * 0.02, w * 0.6, h * 0.4);
  g.bezierCurveTo(w * 0.7, h * 0.08, w * 0.9, h * 0.16, w * 0.84, y);
  g.closePath();
  g.fill();
  ink(g, w);
}

function drawBeak(g, w, h) {
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#ffc15a");
  grd.addColorStop(1, "#e8831c");
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(w * 0.08, h * 0.18);
  g.quadraticCurveTo(w * 0.92, h * 0.28, w * 0.96, h * 0.5);
  g.quadraticCurveTo(w * 0.7, h * 0.58, w * 0.08, h * 0.82);
  g.quadraticCurveTo(w * 0.28, h * 0.5, w * 0.08, h * 0.18);
  g.fill();
  ink(g, w);
}

function drawWattle(g, w, h) {
  const grd = g.createRadialGradient(w * 0.4, h * 0.3, 2, w * 0.5, h * 0.5, w * 0.5);
  grd.addColorStop(0, "#ff5c5c");
  grd.addColorStop(1, "#c61f32");
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(w * 0.48, h * 0.42, w * 0.28, h * 0.32, 0.2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(w * 0.62, h * 0.68, w * 0.2, h * 0.24, 0.4, 0, Math.PI * 2);
  g.fill();
  ink(g, Math.max(w, h));
}

function drawEye(g, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const r = Math.min(w, h) * 0.36;
  g.fillStyle = "#241c18";
  g.beginPath();
  g.ellipse(cx, cy, r, r * 1.05, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fffaf4";
  g.beginPath();
  g.arc(cx - r * 0.28, cy - r * 0.3, r * 0.28, 0, Math.PI * 2);
  g.fill();
}

function drawWing(g, w, h) {
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#fffaf3");
  grd.addColorStop(0.55, "#f6e0c4");
  grd.addColorStop(1, "#e7c49a");
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(w * 0.12, h * 0.18);
  g.quadraticCurveTo(w * 0.85, h * 0.05, w * 0.92, h * 0.48);
  g.quadraticCurveTo(w * 0.7, h * 0.92, w * 0.18, h * 0.78);
  g.quadraticCurveTo(w * 0.02, h * 0.48, w * 0.12, h * 0.18);
  g.fill();
  g.strokeStyle = "rgba(176, 132, 96, 0.55)";
  g.lineWidth = Math.max(1, w * 0.012);
  g.beginPath();
  g.moveTo(w * 0.28, h * 0.34);
  g.quadraticCurveTo(w * 0.55, h * 0.42, w * 0.72, h * 0.62);
  g.stroke();
  ink(g, w);
}

function drawTail(g, w, h) {
  const feathers = [
    [0.28, 0.62, -0.5],
    [0.5, 0.48, -0.15],
    [0.7, 0.66, 0.28],
  ];
  for (const [x, y, rot] of feathers) {
    g.save();
    g.translate(w * x, h * y);
    g.rotate(rot);
    const grd = g.createLinearGradient(-w * 0.2, 0, w * 0.2, 0);
    grd.addColorStop(0, "#fff7ec");
    grd.addColorStop(1, "#f0c48a");
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(0, 0, w * 0.22, h * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    ink(g, w * 0.7);
    g.restore();
  }
}

function drawLeg(g, w, h) {
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, "#ffb15a");
  grd.addColorStop(1, "#e07a1c");
  g.strokeStyle = grd;
  g.lineWidth = Math.max(3, w * 0.22);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.06);
  g.lineTo(w * 0.5, h * 0.72);
  g.stroke();
  g.lineWidth = Math.max(2, w * 0.14);
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.7);
  g.lineTo(w * 0.12, h * 0.92);
  g.moveTo(w * 0.5, h * 0.7);
  g.lineTo(w * 0.5, h * 0.96);
  g.moveTo(w * 0.5, h * 0.7);
  g.lineTo(w * 0.88, h * 0.9);
  g.stroke();
}

function part(name, draw, pw, ph, tiny, order) {
  const tw = texSize(pw, tiny);
  const th = texSize(ph, tiny);
  const map = makeTex(tw, th, draw);
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    toneMapped: true,
    side: THREE.DoubleSide,
    fog: true,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return { mesh, map, pw, ph };
}

function pivot(name, x, y, z) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return o;
}

function damp(cur, goal, dt, seconds) {
  const k = 1 - Math.exp(-dt / Math.max(0.04, seconds));
  return cur + (goal - cur) * k;
}

export function createChicken(renderer) {
  const tiny = typeof window !== "undefined" && !!window.__stillmereBreak?.tinyTex;
  const rig = new THREE.Group();
  rig.name = "chicken";
  const art = new THREE.Group();
  art.name = "chickenArt";
  const bob = new THREE.Group();
  bob.name = "bob";
  rig.add(art);
  art.add(bob);

  const body = part("body", drawBody, 0.38, 0.3, tiny, 3);
  body.mesh.position.set(0, 0.24, 0);
  bob.add(body.mesh);

  const tailP = pivot("tail", -0.14, 0.3, -0.01);
  const tail = part("tail", drawTail, 0.28, 0.22, tiny, 1);
  tail.mesh.position.set(-0.08, 0.04, 0);
  tailP.add(tail.mesh);
  bob.add(tailP);

  const wingFarP = pivot("wingFar", -0.02, 0.28, -0.012);
  const wingFar = part("wingFar", drawWing, 0.26, 0.16, tiny, 2);
  wingFar.mesh.position.set(0.06, -0.02, 0);
  wingFarP.add(wingFar.mesh);
  bob.add(wingFarP);

  const legL = pivot("legL", 0.04, 0.16, 0.01);
  const legR = pivot("legR", -0.03, 0.15, -0.008);
  const legMeshL = part("legL", drawLeg, 0.1, 0.2, tiny, 4);
  const legMeshR = part("legR", drawLeg, 0.1, 0.2, tiny, 4);
  legMeshL.mesh.position.set(0, -0.09, 0);
  legMeshR.mesh.position.set(0, -0.09, 0);
  legL.add(legMeshL.mesh);
  legR.add(legMeshR.mesh);
  bob.add(legL, legR);

  const wingNearP = pivot("wingNear", 0.0, 0.27, 0.012);
  const wingNear = part("wingNear", drawWing, 0.26, 0.16, tiny, 5);
  wingNear.mesh.position.set(0.06, -0.02, 0);
  wingNearP.add(wingNear.mesh);
  bob.add(wingNearP);

  const headP = pivot("head", 0.1, 0.34, 0.02);
  const head = part("head", drawHead, 0.2, 0.2, tiny, 6);
  head.mesh.position.set(0.02, 0.04, 0);
  const comb = part("comb", drawComb, 0.12, 0.1, tiny, 7);
  comb.mesh.position.set(0.0, 0.12, 0.001);
  const beak = part("beak", drawBeak, 0.1, 0.06, tiny, 7);
  beak.mesh.position.set(0.12, 0.03, 0.002);
  const wattle = part("wattle", drawWattle, 0.07, 0.08, tiny, 7);
  wattle.mesh.position.set(0.08, -0.02, 0.002);
  const eye = part("eye", drawEye, 0.045, 0.045, tiny, 8);
  eye.mesh.position.set(0.06, 0.06, 0.003);
  headP.add(head.mesh, comb.mesh, beak.mesh, wattle.mesh, eye.mesh);
  bob.add(headP);

  const pieces = [body, tail, wingFar, wingNear, legMeshL, legMeshR, head, comb, beak, wattle, eye];
  let texPx = Infinity;
  for (const p of pieces) {
    const ppm = Math.min(p.map.image.width / p.pw, p.map.image.height / p.ph);
    const across = ppm * 0.5;
    if (across < texPx) texPx = across;
  }
  if (tiny) texPx = 64;

  bob.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(bob);
  const fit = 0.5 / Math.max(0.001, box.max.y - box.min.y);
  art.scale.setScalar(fit);
  art.position.y = -box.min.y * fit;

  if (renderer) {
    const aniso = renderer.capabilities.getMaxAnisotropy();
    for (const p of pieces) p.map.anisotropy = aniso;
  }

  let state = "idle";
  let forced = null;
  let facing = 1;
  let phase = 0;
  let t = 0;
  let jumpT = 0;
  let land = 0;
  let wingN = 0.15;
  let wingF = -0.2;
  let legA = 0;
  let legB = 0;
  let headTilt = 0;
  let squash = 1;
  let sharp = { onScreen: 0, dpr: 1, need: 0, tex: texPx };
  const _aim = new THREE.Vector3();

  function desired(sim) {
    if (forced) return forced;
    if (sim.cave >= 0) return sim.speed > 0.2 ? "walk" : "idle";
    if (sim.air) return "jump";
    if (sim.climbing) return "climb";
    if (sim.speed > 0.35) return "walk";
    return "idle";
  }

  function face(sim, camera) {
    if (!camera) return;
    const px = rig.position.x;
    const py = rig.position.y + 0.25;
    const pz = rig.position.z;
    _aim.set(px * 2 - camera.position.x, py, pz * 2 - camera.position.z);
    rig.lookAt(_aim);
    const e = camera.matrixWorld.elements;
    const side = -Math.sin(sim.yaw) * e[0] + -Math.cos(sim.yaw) * e[2];
    if (sim.speed > 0.25 && Math.abs(side) > 0.08) facing = side > 0 ? 1 : -1;
    const s = art.scale.y || fit;
    art.scale.set(facing * s, s, s);
  }

  function measure(camera) {
    const dist = Math.max(0.35, camera.position.distanceTo(rig.position));
    const fov = (camera.fov * Math.PI) / 180;
    const frac = 0.5 / (2 * dist * Math.tan(fov / 2));
    const css = renderer?.domElement?.clientHeight || 800;
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const onScreen = frac * css;
    sharp = { onScreen, dpr, need: onScreen * dpr, tex: texPx };
  }

  return {
    rig,
    setPose(name) {
      forced = name || null;
    },
    seek(p) {
      phase = p;
    },
    sample: () => ({
      state,
      wingL: wingNearP.rotation.z,
      wingR: wingFarP.rotation.z,
      legL: legL.rotation.z,
      legR: legR.rotation.z,
      wingsOpen: Math.abs(wingNearP.rotation.z) >= 1.05 && Math.abs(wingFarP.rotation.z) >= 1.05,
      legsSpread: Math.abs(legL.rotation.z - legR.rotation.z) >= 1.2,
      bob: bob.position.y,
      facing,
      ...sharp,
    }),
    update(sim, dt, camera) {
      const step = Math.max(0.001, Math.min(0.05, dt || 0.016));
      face(sim, camera);
      if (camera) measure(camera);
      const br = (typeof window !== "undefined" && window.__stillmereBreak) || {};
      if (br.freezeAnim) return;

      const next = desired(sim);
      if (next !== state) {
        if (state === "jump" && next !== "jump") land = 0.16;
        if (next === "jump") jumpT = 0;
        state = next;
      }
      t += step;
      const rate = 7.2 * Math.max(0.45, (sim.speed || 1.4) / 1.7);
      if (state === "walk") phase += step * rate;

      const air = state === "jump" && !br.noAirPose;
      let wingGoalN = 0.18;
      let wingGoalF = -0.22;
      let legGoalA = 0;
      let legGoalB = 0;
      if (state === "walk") {
        legGoalA = Math.sin(phase) * 0.72;
        legGoalB = Math.sin(phase + Math.PI) * 0.72;
        wingGoalN = 0.18 + Math.sin(phase) * 0.22;
        wingGoalF = -0.22 + Math.sin(phase + Math.PI) * 0.18;
        headTilt = Math.sin(phase * 2) * 0.16;
        headP.position.x = 0.1 + Math.sin(phase * 2) * 0.02;
      } else if (air) {
        wingGoalN = -WING_OPEN;
        wingGoalF = WING_OPEN;
        legGoalA = -LEG_OPEN;
        legGoalB = LEG_OPEN;
        headTilt = -0.08;
        headP.position.x = 0.1;
      } else if (state === "climb") {
        const flap = Math.sin(t * 22) > 0 ? 1 : 0;
        const burst = Math.sin(t * 22);
        wingGoalN = -0.3 + burst * flap * 1.05;
        wingGoalF = 0.25 - burst * flap * 0.95;
        legGoalA = Math.sin(t * 8) * 0.45;
        legGoalB = Math.sin(t * 8 + 1) * 0.45;
        headTilt = 0.05;
        headP.position.x = 0.1;
      } else {
        const tiltWin = t % 4.8;
        headTilt = tiltWin > 3.7 && tiltWin < 4.35 ? 0.28 : 0.02;
        headP.position.x = 0.1;
        wingGoalN = 0.18 + Math.sin(t * 1.4) * 0.04;
        wingGoalF = -0.22;
      }

      const blend = state === "walk" ? 0.08 : 0.15;
      wingN = damp(wingN, wingGoalN, step, blend);
      wingF = damp(wingF, wingGoalF, step, blend);
      legA = damp(legA, legGoalA, step, blend);
      legB = damp(legB, legGoalB, step, blend);
      wingNearP.rotation.z = wingN;
      wingFarP.rotation.z = wingF;
      legL.rotation.z = legA;
      legR.rotation.z = legB;
      headP.rotation.z = damp(headP.rotation.z, headTilt, step, 0.15);

      const breath = Math.sin(t * 2.1);
      const breathe = state === "idle" || state === "walk" ? breath : 0;
      bob.position.y = breathe * 0.012;
      tailP.rotation.z = Math.sin(t * 1.6) * 0.08;

      const blink = t % 3.4;
      eye.mesh.scale.y = blink > 3.12 && blink < 3.28 ? 0.12 : 1;

      if (state === "jump") jumpT += step;
      let squashGoal = 1;
      if (state === "jump" && jumpT < 0.08) squashGoal = 0.82;
      else if (state === "jump" && jumpT < 0.18) squashGoal = 1.18;
      else if (land > 0) {
        land = Math.max(0, land - step);
        squashGoal = 0.88;
      }
      squash = damp(squash, squashGoal, step, 0.1);
      const sway = state === "walk" ? Math.sin(phase) * 0.07 : 0;
      bob.scale.set(1 + breathe * -0.02, squash * (1 + breathe * 0.035), 1);
      bob.rotation.z = sway;
    },
  };
}
