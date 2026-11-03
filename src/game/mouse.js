// @ts-nocheck
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const FUR = [0.55, 0.33, 0.16];
const BELLY = [0.82, 0.64, 0.48];
const EAR = [0.93, 0.62, 0.64];
const NOSE = [0.95, 0.45, 0.52];
const EYE = [0.08, 0.06, 0.05];
const WHISK = [0.93, 0.9, 0.84];

function paint(geo, color, bone) {
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = color[0];
    colors[i * 3 + 1] = color[1];
    colors[i * 3 + 2] = color[2];
    skinIndex[i * 4] = bone;
    skinWeight[i * 4] = 1;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  geo.deleteAttribute("uv");
  return geo;
}

function sphere(r, x, y, z, color, bone) {
  const g = new THREE.SphereGeometry(r, 8, 6);
  g.translate(x, y, z);
  return paint(g, color, bone);
}

function cone(r, length, x, y, z, color, bone) {
  const g = new THREE.ConeGeometry(r, length, 7);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return paint(g, color, bone);
}

function box(sx, sy, sz, x, y, z, color, bone) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(x, y, z);
  return paint(g, color, bone);
}

function rodBetween(r0, r1, ax, ay, az, bx, by, bz, color, bone) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const g = new THREE.CylinderGeometry(r0, r1, len, 6, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(dx / len, dy / len, dz / len),
  );
  g.applyQuaternion(q);
  g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  return paint(g, color, bone);
}

function fitRig(mesh, rootBone, target) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const minY = geo.boundingBox.min.y;
  const h = geo.boundingBox.max.y - minY;
  const s = target / Math.max(0.001, h);
  geo.translate(0, -minY, 0);
  geo.scale(s, s, s);
  rootBone.position.y -= minY;
  const scaleBone = (b) => {
    b.position.multiplyScalar(s);
    for (const c of b.children) if (c.isBone) scaleBone(c);
  };
  scaleBone(rootBone);
}

function buildTemplate() {
  const bones = [];
  const root = new THREE.Bone();
  root.name = "root";
  bones.push(root);
  const bodyBone = new THREE.Bone();
  bodyBone.name = "body";
  bodyBone.position.set(0, 0.12, 0);
  root.add(bodyBone);
  bones.push(bodyBone);
  const headBone = new THREE.Bone();
  headBone.name = "head";
  headBone.position.set(0, 0.04, 0.14);
  bodyBone.add(headBone);
  bones.push(headBone);
  const earLBone = new THREE.Bone();
  earLBone.name = "earL";
  earLBone.position.set(-0.07, 0.06, -0.01);
  headBone.add(earLBone);
  bones.push(earLBone);
  const earRBone = new THREE.Bone();
  earRBone.name = "earR";
  earRBone.position.set(0.07, 0.06, -0.01);
  headBone.add(earRBone);
  bones.push(earRBone);
  // Tail points away from the camera (+Z is the snout, which faces the chase cam).
  const t0 = new THREE.Vector3(0, 0.11, -0.15);
  const t1 = new THREE.Vector3(0, 0.15, -0.3);
  const t2 = new THREE.Vector3(0, 0.24, -0.42);
  const t3 = new THREE.Vector3(0, 0.34, -0.48);
  const tail = new THREE.Bone();
  tail.name = "tail";
  tail.position.copy(t0).sub(bodyBone.position);
  bodyBone.add(tail);
  bones.push(tail);
  const tailMid = new THREE.Bone();
  tailMid.name = "tailMid";
  tailMid.position.copy(t1).sub(t0);
  tail.add(tailMid);
  bones.push(tailMid);
  const tailTip = new THREE.Bone();
  tailTip.name = "tailTip";
  tailTip.position.copy(t2).sub(t1);
  tailMid.add(tailTip);
  bones.push(tailTip);
  const hips = [
    ["legFL", -0.045, -0.05, 0.06],
    ["legFR", 0.045, -0.05, 0.06],
    ["legBL", -0.04, -0.045, -0.07],
    ["legBR", 0.04, -0.045, -0.07],
  ];
  for (const [name, x, y, z] of hips) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    bodyBone.add(b);
    bones.push(b);
  }

  const bodyGeo = new THREE.SphereGeometry(0.08, 10, 8);
  bodyGeo.scale(0.7, 0.62, 1.7);
  bodyGeo.translate(0, 0.11, -0.01);
  const belly = new THREE.SphereGeometry(0.05, 8, 6);
  belly.scale(0.65, 0.45, 1.15);
  belly.translate(0, 0.085, 0.02);
  const headGeo = new THREE.SphereGeometry(0.046, 10, 8);
  headGeo.scale(0.88, 0.8, 1.05);
  headGeo.translate(0, 0.16, 0.15);
  const earGeoL = new THREE.SphereGeometry(0.062, 8, 6);
  earGeoL.scale(0.22, 1.45, 0.28);
  earGeoL.translate(-0.078, 0.25, 0.13);
  const earGeoR = earGeoL.clone();
  earGeoR.translate(0.156, 0, 0);
  const whisk = (y, z, side, lift) =>
    rodBetween(0.0035, 0.0015, side * 0.02, y, z, side * 0.11, y + lift, z + 0.03, WHISK, 2);
  const parts = [
    paint(bodyGeo, FUR, 1),
    paint(belly, BELLY, 1),
    paint(headGeo, FUR, 2),
    cone(0.026, 0.11, 0, 0.155, 0.22, FUR, 2),
    sphere(0.014, 0, 0.155, 0.282, NOSE, 2),
    sphere(0.011, -0.032, 0.175, 0.175, EYE, 2),
    sphere(0.011, 0.032, 0.175, 0.175, EYE, 2),
    paint(earGeoL, EAR, 3),
    paint(earGeoR, EAR, 4),
    whisk(0.162, 0.24, -1, 0.012),
    whisk(0.152, 0.25, -1, 0),
    whisk(0.144, 0.238, -1, -0.012),
    whisk(0.162, 0.24, 1, 0.012),
    whisk(0.152, 0.25, 1, 0),
    whisk(0.144, 0.238, 1, -0.012),
    rodBetween(0.012, 0.008, t0.x, t0.y, t0.z, t1.x, t1.y, t1.z, FUR, 5),
    rodBetween(0.008, 0.005, t1.x, t1.y, t1.z, t2.x, t2.y, t2.z, FUR, 6),
    rodBetween(0.005, 0.0025, t2.x, t2.y, t2.z, t3.x, t3.y, t3.z, FUR, 7),
    box(0.018, 0.07, 0.018, -0.045, 0.04, 0.07, FUR, 8),
    box(0.018, 0.07, 0.018, 0.045, 0.04, 0.07, FUR, 9),
    box(0.018, 0.065, 0.018, -0.04, 0.038, -0.08, FUR, 10),
    box(0.018, 0.065, 0.018, 0.04, 0.038, -0.08, FUR, 11),
  ];
  const geo = mergeGeometries(parts, false);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = "mouse";
  mesh.frustumCulled = false;
  fitRig(mesh, root, 0.4);
  mesh.add(root);
  mesh.bind(new THREE.Skeleton(bones));
  const rig = new THREE.Group();
  rig.name = "mouseRig";
  rig.add(mesh);
  rig.animations = makeClips();
  return rig;
}

function rot(name, times, values) {
  return new THREE.NumberKeyframeTrack(`${name}.rotation[x]`, times, values);
}

function makeClips() {
  const idle = new THREE.AnimationClip("idle", 1.6, [
    new THREE.NumberKeyframeTrack("body.scale[y]", [0, 0.8, 1.6], [1, 1.06, 1]),
    new THREE.NumberKeyframeTrack("body.scale[x]", [0, 0.8, 1.6], [1, 0.97, 1]),
    new THREE.NumberKeyframeTrack("tail.rotation[y]", [0, 0.8, 1.6], [0.18, -0.18, 0.18]),
  ]);
  const walk = new THREE.AnimationClip("walk", 0.42, [
    rot("legFL", [0, 0.21, 0.42], [0.7, -0.7, 0.7]),
    rot("legBR", [0, 0.21, 0.42], [0.7, -0.7, 0.7]),
    rot("legFR", [0, 0.21, 0.42], [-0.7, 0.7, -0.7]),
    rot("legBL", [0, 0.21, 0.42], [-0.7, 0.7, -0.7]),
    new THREE.NumberKeyframeTrack("body.rotation[z]", [0, 0.21, 0.42], [0.08, -0.08, 0.08]),
    new THREE.NumberKeyframeTrack("head.rotation[x]", [0, 0.21, 0.42], [0.05, -0.04, 0.05]),
    new THREE.NumberKeyframeTrack("tail.rotation[y]", [0, 0.21, 0.42], [-0.55, 0.55, -0.55]),
  ]);
  const jump = new THREE.AnimationClip("jump", 0.45, [
    new THREE.NumberKeyframeTrack("body.scale[y]", [0, 0.12, 0.28, 0.45], [0.72, 1.28, 0.84, 1]),
    new THREE.NumberKeyframeTrack("body.scale[x]", [0, 0.12, 0.28, 0.45], [1.22, 0.82, 1.12, 1]),
    new THREE.NumberKeyframeTrack("body.scale[z]", [0, 0.12, 0.28, 0.45], [1.18, 0.86, 1.1, 1]),
    new THREE.NumberKeyframeTrack("root.position[y]", [0, 0.16, 0.32, 0.45], [0, 0.18, 0.05, 0]),
  ]);
  const climb = new THREE.AnimationClip("climb", 0.8, [
    new THREE.NumberKeyframeTrack("root.rotation[x]", [0, 0.4, 0.8], [0.45, 0.55, 0.45]),
    rot("legFL", [0, 0.4, 0.8], [0.4, 1.1, 0.4]),
    rot("legFR", [0, 0.4, 0.8], [1.1, 0.4, 1.1]),
    new THREE.NumberKeyframeTrack("head.rotation[x]", [0, 0.8], [-0.2, -0.2]),
  ]);
  return [idle, walk, jump, climb];
}

export function createMouse() {
  const template = buildTemplate();
  const rig = cloneSkeleton(template);
  rig.frustumCulled = false;
  rig.traverse((o) => {
    o.frustumCulled = false;
  });
  const mixer = new THREE.AnimationMixer(rig);
  const actions = {};
  for (const clip of template.animations) {
    const action = mixer.clipAction(clip, rig);
    action.enabled = true;
    actions[clip.name] = action;
  }
  let current = "idle";
  actions.idle.play();
  const body = rig.getObjectByName("body");
  const mesh = rig.getObjectByName("mouse");
  // SwiftShader drops the bone float-texture, so the skinning shader flings
  // the mouse off-screen. Bake the skeleton on the CPU into a plain mesh.
  // __stillmereBreak.freezeAnim skips the mixer, so the pose stays put.
  mesh.isSkinnedMesh = false;
  const skinIndex = mesh.geometry.attributes.skinIndex;
  const basePos = mesh.geometry.attributes.position.clone();
  const pos = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  const M = new THREE.Matrix4();

  function bake() {
    rig.updateMatrixWorld(true);
    const bones = mesh.skeleton.bones;
    const invs = mesh.skeleton.boneInverses;
    const bind = mesh.bindMatrix;
    const bindInv = mesh.bindMatrixInverse;
    for (let i = 0; i < pos.count; i++) {
      const bone = skinIndex.getX(i);
      M.multiplyMatrices(bones[bone].matrixWorld, invs[bone]);
      v.fromBufferAttribute(basePos, i).applyMatrix4(bind).applyMatrix4(M).applyMatrix4(bindInv);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }
  bake();

  function play(next) {
    if (next === current || !actions[next]) return;
    const incoming = actions[next];
    const outgoing = actions[current];
    incoming.reset().fadeIn(0.15).play();
    if (outgoing) outgoing.fadeOut(0.15);
    current = next;
  }

  return {
    rig,
    clip: () => current,
    sample: () => ({
      clip: current,
      bodyScale: body ? body.scale.y : 0,
      time: mixer.time,
      poseY: pos.getY(0),
    }),
    update(sim, dt) {
      const br = (typeof window !== "undefined" && window.__stillmereBreak) || {};
      rig.visible = !br.hideMouse;
      let next = "idle";
      if (br.pose === "idle" || br.pose === "walk" || br.pose === "jump" || br.pose === "climb") next = br.pose;
      else if (sim.cave >= 0) next = sim.speed > 0.2 ? "walk" : "idle";
      else if (sim.air) next = "jump";
      else if (sim.climbing) next = "climb";
      else if (sim.speed > 0.35) next = "walk";
      play(next);
      if (br.freezeAnim) return;
      if (current === "walk") actions.walk.timeScale = Math.max(0.45, (sim.speed || 1.2) / 1.7);
      else if (actions.walk) actions.walk.timeScale = 1;
      mixer.update(Math.max(0.001, dt));
      bake();
    },
  };
}
