// @ts-nocheck
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { sampleInto } from "./world/sample.js";

const ROLE = { 0: "tree", 1: "tree", 2: "cactus", 3: "rock", 4: "bush", 5: "flower" };
const tmp = { y: 0, biome: "meadow", moisture: 0, temp: 0 };
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _ctr = new THREE.Vector3();

function lambertFrom(src, geo) {
  const color = src && src.color ? src.color.clone() : new THREE.Color(0xffffff);
  const map = src && src.map ? src.map : null;
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({
    color,
    map,
    vertexColors: !!(geo && geo.getAttribute("color")),
  });
}

function partsOf(gltf) {
  const parts = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const srcMat = Array.isArray(o.material) ? o.material[0] : o.material;
    const geos = [];
    const push = (geo, mat) => {
      const g = geo.clone();
      g.applyMatrix4(o.matrixWorld);
      geos.push(g);
      parts.push({ geo: g, mat });
    };
    if (Array.isArray(o.material) && o.geometry.groups && o.geometry.groups.length) {
      o.material.forEach((mat, idx) => {
        const g = o.geometry.clone();
        const group = o.geometry.groups[idx];
        if (!group) return;
        g.clearGroups();
        const index = g.getIndex();
        if (!index || !group) return;
        const sliced = g.clone();
        // Keep whole geometry if groups are awkward; one material is enough for instancing.
        push(o.geometry, mat || srcMat);
      });
    } else {
      push(o.geometry, srcMat);
    }
    geos.forEach(() => {});
  });
  // Dedup identical clones from the group branch above by keeping the last unique pass.
  const kept = [];
  const seen = new Set();
  for (const part of parts) {
    const id = part.geo.uuid;
    if (seen.has(id)) continue;
    seen.add(id);
    kept.push(part);
  }
  return kept.length ? kept : parts;
}

function standUp(parts) {
  const box = new THREE.Box3();
  for (const part of parts) {
    part.geo.computeBoundingBox();
    box.union(part.geo.boundingBox);
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  // Only tip meshes that are clearly lying along one axis. A wide canopy is
  // taller than it is "flat", so it must stay upright or it becomes a green wall.
  const rot = new THREE.Matrix4();
  if (size.z > size.y * 1.6 && size.z > size.x * 1.3) rot.makeRotationX(-Math.PI / 2);
  else if (size.x > size.y * 1.6 && size.x > size.z * 1.3) rot.makeRotationZ(Math.PI / 2);
  else return;
  for (const part of parts) part.geo.applyMatrix4(rot);
}

async function loadParts(loader, url, height) {
  const gltf = await loader.loadAsync(url);
  const raw = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    raw.push({ geo: g, mat });
  });
  if (!raw.length) throw new Error("empty " + url);
  standUp(raw);
  const union = new THREE.Box3();
  for (const part of raw) {
    part.geo.computeBoundingBox();
    union.union(part.geo.boundingBox);
  }
  const size = new THREE.Vector3();
  union.getSize(size);
  const s = height / Math.max(0.001, size.y);
  const cx = (union.min.x + union.max.x) / 2;
  const cz = (union.min.z + union.max.z) / 2;
  for (const part of raw) {
    part.geo.translate(-cx, -union.min.y, -cz);
    part.geo.scale(s, s, s);
    if (!part.geo.getAttribute("normal")) part.geo.computeVertexNormals();
    part.lambert = lambertFrom(part.mat, part.geo);
  }
  return raw;
}

export async function loadPropLibrary() {
  const res = await fetch("/models/manifest.json");
  if (!res.ok) return null;
  const manifest = await res.json();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const models = [];
  for (const item of manifest.models) {
    const near = await loadParts(loader, "/models/" + item.file, item.height || 1);
    const far = await loadParts(loader, "/models/" + item.lod, item.height || 1);
    models.push({ ...item, near, far, cap: item.cap || 240 });
  }
  return {
    bytes: manifest.bytes,
    models,
    attach(outdoor) {
      this.group = new THREE.Group();
      this.group.name = "props";
      this.loose = new THREE.Group();
      this.loose.name = "props-loose";
      outdoor.add(this.group, this.loose);
      this.meshes = [];
      for (const model of models) {
        for (const lod of ["near", "far"]) {
          model[lod].forEach((part, pi) => {
            const mesh = new THREE.InstancedMesh(part.geo, part.lambert, model.cap);
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.userData.model = model.id;
            mesh.userData.lod = lod;
            mesh.userData.part = pi;
            this.group.add(mesh);
            this.meshes.push(mesh);
          });
        }
      }
    },
    sync(built, sim, fog, noInstance) {
      if (!this.meshes) return;
      const buckets = new Map();
      const keyOf = (id, lod, part) => `${id}|${lod}|${part}`;
      for (const mesh of this.meshes) {
        buckets.set(keyOf(mesh.userData.model, mesh.userData.lod, mesh.userData.part), []);
      }
      let n = 0;
      for (const rec of built.values()) {
        const p = rec.props;
        for (let i = 0; i < p.length; i += 9) {
          const kind = p[i];
          const x = p[i + 1];
          const y = p[i + 2];
          const z = p[i + 3];
          const dist = Math.hypot(x - sim.x, z - sim.z);
          if (dist > fog) continue;
          sampleInto(x, z, tmp);
          const role = ROLE[kind] || "rock";
          const pool = models.filter((m) => m.role === role && m.biomes.includes(tmp.biome));
          if (!pool.length) continue;
          const preferPine = kind === 1;
          const pines = preferPine ? pool.filter((m) => m.id.includes("pine")) : pool;
          const choice = (pines.length ? pines : pool)[Math.abs((Math.imul(Math.floor(x * 10), 73856093) ^ Math.imul(Math.floor(z * 10), 19349663)) >>> 0) % (pines.length ? pines.length : pool.length)];
          const used = choice._n || 0;
          if (used >= (choice.cap || 240)) continue;
          choice._n = used + 1;
          const lod = dist > 46 ? "far" : "near";
          const parts = choice[lod];
          let sc = p[i + 5] || 1;
          if (role === "tree") {
            const wobble = 0.9 + ((Math.abs(Math.imul(Math.floor(x), 17) ^ Math.imul(Math.floor(z), 31)) >>> 0) % 20) / 100;
            const boost = (typeof window !== "undefined" && window.__stillmereBreak?.treeScale) || 1;
            sc = wobble * boost;
          }
          for (let pi = 0; pi < parts.length; pi++) {
            const list = buckets.get(keyOf(choice.id, lod, pi));
            if (list) list.push([x, y, z, p[i + 4], sc]);
          }
          n++;
        }
      }
      for (const model of models) model._n = 0;
      if (noInstance) {
        for (const mesh of this.meshes) mesh.count = 0;
        while (this.loose.children.length) {
          const c = this.loose.children.pop();
          c.geometry = null;
        }
        let made = 0;
        for (const [key, list] of buckets) {
          if (!list.length || made > 160) continue;
          const mesh = this.meshes.find((m) => keyOf(m.userData.model, m.userData.lod, m.userData.part) === key);
          if (!mesh) continue;
          for (let i = 0; i < list.length && made < 160; i++) {
            const r = list[i];
            const one = new THREE.Mesh(mesh.geometry, mesh.material);
            one.position.set(r[0], r[1], r[2]);
            one.rotation.y = r[3];
            one.scale.setScalar(r[4]);
            one.frustumCulled = false;
            this.loose.add(one);
            made++;
          }
        }
        this.draws = made;
        return;
      }
      while (this.loose.children.length) this.loose.remove(this.loose.children[0]);
      let draws = 0;
      let tris = 0;
      for (const mesh of this.meshes) {
        const list = buckets.get(keyOf(mesh.userData.model, mesh.userData.lod, mesh.userData.part)) || [];
        const count = Math.min(list.length, mesh.instanceMatrix.count);
        for (let i = 0; i < count; i++) {
          const r = list[i];
          _v.set(r[0], r[1], r[2]);
          _q.setFromAxisAngle(_up, r[3] || 0);
          const sc = r[4] || 1;
          _s.set(sc, sc, sc);
          _m.compose(_v, _q, _s);
          mesh.setMatrixAt(i, _m);
        }
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        if (count > 0) {
          draws++;
          const t = mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3;
          tris += t * count;
        }
      }
      this.draws = draws;
      this.tris = tris;
      this.placed = n;
    },
    maxCover(camera, viewW, viewH) {
      if (!this.meshes || !camera) return 0;
      let max = 0;
      const fov = (camera.fov * Math.PI) / 180;
      const focal = (viewH * 0.5) / Math.max(0.2, Math.tan(fov * 0.5));
      const screen = Math.max(1, viewW * viewH);
      camera.getWorldDirection(_dir);
      for (const mesh of this.meshes) {
        if (!mesh.count) continue;
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        const sphere = mesh.geometry.boundingSphere;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, _m);
          _ctr.copy(sphere.center).applyMatrix4(_m);
          _v.copy(_ctr).sub(camera.position);
          const dist = _v.length();
          if (dist < 0.3 || _v.dot(_dir) <= 0) continue;
          _m.decompose(_ctr, _q, _s);
          const sc = Math.max(_s.x, _s.y, _s.z);
          const px = (sphere.radius * sc * focal) / dist;
          const frac = Math.min(1, (Math.PI * px * px) / screen);
          if (frac > max) max = frac;
        }
      }
      return max;
    },
  };
}

void partsOf;
