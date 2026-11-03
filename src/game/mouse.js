// @ts-nocheck
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

const FUR = [0.55, 0.33, 0.16];
const BELLY = [0.78, 0.58, 0.4];
const EAR = [0.9, 0.62, 0.58];
const NOSE = [0.32, 0.18, 0.14];
const EYE = [0.08, 0.06, 0.05];

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

function box(sx, sy, sz, x, y, z, color, bone) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(x, y, z);
  return paint(g, color, bone);
}

function buildTemplate() {
  const bones = [];
  const root = new THREE.Bone();
  root.name = "root";
  bones.push(root);
  const body = new THREE.Bone();
  body.name = "body";
  body.position.set(0, 0.16, 0);
  root.add(body);
  bones.push(body);
  const head = new THREE.Bone();
  head.name = "head";
  head.position.set(0, 0.12, 0.05);
  body.add(head);
  bones.push(head);
  const earL = new THREE.Bone();
  earL.name = "earL";
  earL.position.set(-0.06, 0.08, 0);
  head.add(earL);
  bones.push(earL);
  const earR = new THREE.Bone();
  earR.name = "earR";
  earR.position.set(0.06, 0.08, 0);
  head.add(earR);
  bones.push(earR);
  const tail = new THREE.Bone();
  tail.name = "tail";
  tail.position.set(0, -0.02, -0.08);
  body.add(tail);
  bones.push(tail);
  const hips = [
    ["legFL", -0.05, -0.06, 0.05],
    ["legFR", 0.05, -0.06, 0.05],
    ["legBL", -0.05, -0.06, -0.05],
    ["legBR", 0.05, -0.06, -0.05],
  ];
  for (const [name, x, y, z] of hips) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    body.add(b);
    bones.push(b);
  }

  const parts = [
    sphere(0.09, 0, 0.16, 0, FUR, 1),
    sphere(0.055, 0, 0.13, 0.02, BELLY, 1),
    sphere(0.095, 0, 0.28, 0.05, FUR, 2),
    sphere(0.028, 0, 0.25, 0.13, NOSE, 2),
    sphere(0.016, -0.04, 0.3, 0.12, EYE, 2),
    sphere(0.016, 0.04, 0.3, 0.12, EYE, 2),
    sphere(0.042, -0.06, 0.36, 0.03, EAR, 3),
    sphere(0.042, 0.06, 0.36, 0.03, EAR, 4),
    box(0.035, 0.04, 0.09, 0, 0.15, -0.14, FUR, 5),
    box(0.032, 0.08, 0.032, -0.05, 0.04, 0.05, FUR, 6),
    box(0.032, 0.08, 0.032, 0.05, 0.04, 0.05, FUR, 7),
    box(0.032, 0.08, 0.032, -0.05, 0.04, -0.05, FUR, 8),
    box(0.032, 0.08, 0.032, 0.05, 0.04, -0.05, FUR, 9),
  ];
  const geo = mergeGeometries(parts, false);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = "mouse";
  mesh.frustumCulled = false;
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
  ]);
  const walk = new THREE.AnimationClip("walk", 0.42, [
    rot("legFL", [0, 0.21, 0.42], [0.7, -0.7, 0.7]),
    rot("legBR", [0, 0.21, 0.42], [0.7, -0.7, 0.7]),
    rot("legFR", [0, 0.21, 0.42], [-0.7, 0.7, -0.7]),
    rot("legBL", [0, 0.21, 0.42], [-0.7, 0.7, -0.7]),
    new THREE.NumberKeyframeTrack("body.rotation[z]", [0, 0.21, 0.42], [0.08, -0.08, 0.08]),
    new THREE.NumberKeyframeTrack("head.rotation[x]", [0, 0.21, 0.42], [0.05, -0.04, 0.05]),
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
  const plain = typeof window !== "undefined" && !!window.__stillmereBreak?.plainClone;
  const template = buildTemplate();
  const rig = plain ? template.clone(true) : cloneSkeleton(template);
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
  // A plain Object3D.clone() keeps the source skeleton, so this stays frozen.
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
      if (current === "walk") actions.walk.timeScale = Math.max(0.45, (sim.speed || 1.2) / 1.7);
      else if (actions.walk) actions.walk.timeScale = 1;
      mixer.update(Math.max(0.001, dt));
      bake();
    },
  };
}
