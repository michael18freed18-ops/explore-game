// @ts-nocheck
import { BIOME_LABEL, HALF, WATER, sampleInto } from "./world/sample.js";

const MAP = 180;

export function createHud(root) {
  root.classList.add("sm-root");
  root.innerHTML = `
    <canvas class="sm-canvas"></canvas>
    <div class="sm-hud">
      <div class="sm-status">
        <p class="sm-found" id="found">Found 0/150</p>
        <p class="sm-place" id="place">Reading the land</p>
        <div class="sm-stam" aria-hidden="true"><span id="stam"></span></div>
        <button type="button" class="sm-quality" id="quality">Auto</button>
      </div>
      <button type="button" class="sm-map" id="map" aria-label="Enlarge the map">
        <canvas class="sm-map-canvas" width="${MAP}" height="${MAP}"></canvas>
      </button>
      <div class="sm-stick" aria-hidden="true"><div class="sm-knob"></div></div>
      <div class="sm-actions">
        <button type="button" data-act="jump">Jump</button>
        <button type="button" data-act="climb">Climb</button>
        <button type="button" data-act="sense" id="sense">Sense</button>
      </div>
      <p class="sm-note" id="note"></p>
      <p class="sm-keys">WASD move · drag to look · Q and E turn · Space jump · Shift climb · F sense</p>
    </div>
    <div class="sm-start" id="start">
      <p class="sm-eyebrow">No enemies. Just weather.</p>
      <h1>Stillmere</h1>
      <p class="sm-lead">A fixed 8 km of meadow, wood, desert, snow, marsh and shore. One hundred and fifty things are still out there.</p>
      <button type="button" id="begin">Begin</button>
    </div>
    <p class="sm-fps" id="fps"></p>
    <div class="sm-modal" id="modal" hidden>
      <div class="sm-modal-card">
        <button type="button" id="map-close">Close map</button>
        <canvas id="map-big" width="480" height="480"></canvas>
        <p class="sm-found" id="found-big">Found 0/150</p>
        <ul id="map-counts"></ul>
      </div>
    </div>
  `;

  const mapCanvas = root.querySelector(".sm-map-canvas");
  const mapCtx = mapCanvas.getContext("2d");
  const big = root.querySelector("#map-big");
  const bigCtx = big.getContext("2d");
  const base = document.createElement("canvas");
  base.width = MAP;
  base.height = MAP;
  const zoom = document.createElement("canvas");
  zoom.width = 200;
  zoom.height = 200;
  let zoomKey = "";
  let baseReady = false;

  function paintZoom(world, originX, originZ) {
    const key = `${Math.round(world)}|${Math.round(originX / 24)}|${Math.round(originZ / 24)}`;
    if (key === zoomKey) return;
    zoomKey = key;
    const zctx = zoom.getContext("2d");
    const img = zctx.createImageData(200, 200);
    const sample = { y: 0, biome: "meadow", moisture: 0, temp: 0 };
    const rgb = {
      meadow: [158, 176, 104],
      forest: [62, 112, 74],
      desert: [214, 184, 112],
      snow: [226, 232, 236],
      shore: [214, 196, 156],
      swamp: [86, 104, 74],
      autumn: [186, 112, 58],
      lake: [58, 122, 146],
    };
    for (let y = 0; y < 200; y++) {
      const z = originZ - ((y + 0.5) / 200) * world;
      for (let x = 0; x < 200; x++) {
        const wx = originX + ((x + 0.5) / 200) * world;
        sampleInto(wx, z, sample);
        const ckey = sample.biome === "shore" && sample.y < WATER ? "lake" : sample.biome;
        const c = rgb[ckey] || rgb.meadow;
        const i = (y * 200 + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    zctx.putImageData(img, 0, 0);
  }
  let noteTimer = 0;

  function paintBase() {
    const ctx = base.getContext("2d");
    const img = ctx.createImageData(MAP, MAP);
    const tmp = { y: 0, biome: "meadow", moisture: 0, temp: 0 };
    const rgb = {
      meadow: [158, 176, 104],
      forest: [62, 112, 74],
      desert: [214, 184, 112],
      snow: [226, 232, 236],
      shore: [214, 196, 156],
      swamp: [86, 104, 74],
      autumn: [186, 112, 58],
      lake: [58, 122, 146],
    };
    for (let y = 0; y < MAP; y++) {
      const z = HALF - ((y + 0.5) / MAP) * HALF * 2;
      for (let x = 0; x < MAP; x++) {
        const wx = -HALF + ((x + 0.5) / MAP) * HALF * 2;
        sampleInto(wx, z, tmp);
        const key = tmp.biome === "shore" && tmp.y < WATER ? "lake" : tmp.biome;
        const c = rgb[key] || rgb.meadow;
        const i = (y * MAP + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    baseReady = true;
  }

  function blit(ctx, canvas, sim, hazes, span) {
    if (!baseReady) return;
    const world = span || HALF * 2;
    const originX = span ? sim.x - world / 2 : -HALF;
    const originZ = span ? sim.z + world / 2 : HALF;
    if (!span) {
      ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    } else {
      paintZoom(world, originX, originZ);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(zoom, 0, 0, canvas.width, canvas.height);
    }
    if (hazes) {
      for (let i = 0; i < hazes.length; i++) {
        const h = hazes[i];
        const px = ((h.x - originX) / world) * canvas.width;
        const py = ((originZ - h.z) / world) * canvas.height;
        const rad = 75 * (canvas.width / world);
        if (px < -rad || py < -rad || px > canvas.width + rad || py > canvas.height + rad) continue;
        const g = ctx.createRadialGradient(px, py, rad * 0.05, px, py, Math.max(2, rad));
        g.addColorStop(0, "rgba(224,161,90,0.35)");
        g.addColorStop(0.45, "rgba(224,161,90,0.18)");
        g.addColorStop(1, "rgba(224,161,90,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(2, rad), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const px = ((sim.x - originX) / world) * canvas.width;
    const py = ((originZ - sim.z) / world) * canvas.height;
    ctx.fillStyle = "#1a2330";
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e7eef2";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const modal = root.querySelector("#modal");
  root.querySelector("#map").addEventListener("click", () => {
    modal.hidden = false;
  });
  root.querySelector("#map-close").addEventListener("click", () => {
    modal.hidden = true;
  });

  return {
    root,
    canvas: root.querySelector(".sm-canvas"),
    begin: root.querySelector("#begin"),
    qualityBtn: root.querySelector("#quality"),
    senseBtn: root.querySelector("#sense"),
    paintBase,
    update(sim, opts) {
      root.querySelector("#found").textContent = `Found ${opts.found}/${opts.total}`;
      root.querySelector("#found-big").textContent = `Found ${opts.found}/${opts.total}`;
      root.querySelector("#place").textContent = opts.place;
      root.querySelector("#stam").style.transform = `scaleX(${Math.max(0, Math.min(1, opts.stamina / 100))})`;
      root.querySelector("#quality").textContent = opts.qualityLabel;
      root.querySelector("#fps").textContent = opts.fpsLabel;
      const sense = root.querySelector("#sense");
      if (opts.senseCd > 0.05) {
        sense.textContent = `${Math.ceil(opts.senseCd)}s`;
        sense.disabled = true;
      } else {
        sense.textContent = "Sense";
        sense.disabled = false;
      }
      blit(mapCtx, mapCanvas, sim, opts.hazes);
      if (!modal.hidden) blit(bigCtx, big, sim, opts.hazes, 1600);
      if (noteTimer > 0) {
        noteTimer -= opts.dt || 0;
        if (noteTimer <= 0) root.querySelector("#note").textContent = "";
      }
    },
    setCounts(html) {
      root.querySelector("#map-counts").innerHTML = html;
    },
    flash(text) {
      root.querySelector("#note").textContent = text;
      noteTimer = 2.4;
    },
    setPlaying(on) {
      root.querySelector("#start").classList.toggle("is-gone", on);
      root.classList.toggle("is-playing", on);
    },
    setBoot(text) {
      root.querySelector("#place").textContent = text;
    },
  };
}

export function biomeLabel(biome) {
  return BIOME_LABEL[biome] || biome;
}
