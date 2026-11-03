import { C as RingGeometry, D as Timer, E as SphereGeometry, O as Vector3, S as Quaternion, T as Scene, _ as MeshBasicMaterial, a as CanvasTexture, b as PlaneGeometry, c as DirectionalLight, d as HemisphereLight, f as InstancedBufferAttribute, g as Mesh, h as Matrix4, i as BufferGeometry, l as Fog, m as MathUtils, n as BoxGeometry, o as CircleGeometry, p as InstancedMesh, r as BufferAttribute, s as Color, t as WebGLRenderer, u as Group, v as MeshLambertMaterial, w as SRGBColorSpace, x as PointLight, y as PerspectiveCamera } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/engine-tfORBya0.js
function createAudio() {
	let ctx = null;
	function unlock() {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return;
		if (!ctx) ctx = new AC();
		if (ctx.state === "suspended") ctx.resume();
	}
	function tone(freq, dur, gainValue, type) {
		if (!ctx) return;
		const t0 = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type || "sine";
		osc.frequency.setValueAtTime(freq, t0);
		gain.gain.setValueAtTime(gainValue, t0);
		gain.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(t0);
		osc.stop(t0 + dur + .02);
	}
	return {
		unlock,
		sense(dist) {
			tone(520 + Math.max(0, Math.min(1, 1 - dist / 280)) * 280, .07, .035, "sine");
		},
		found(kind) {
			tone(kind === "relic" ? 392 : 523, .09, .05, "triangle");
			setTimeout(() => tone(kind === "relic" ? 784 : 784, .14, .04, "sine"), 80);
		}
	};
}
/** Deterministic terrain. Shared by the main thread, the chunk worker, and Node QA. */
var SEED = 5709485;
var HALF = 4e3;
var MAX_WALK = Math.tan(32 * Math.PI / 180);
var MAX_CLIMB = Math.tan(58 * Math.PI / 180);
var BIOMES = [
	"meadow",
	"forest",
	"desert",
	"snow",
	"shore",
	"swamp",
	"autumn"
];
var BIOME_LABEL = {
	meadow: "Meadow",
	forest: "Forest",
	desert: "Desert",
	snow: "Snowy mountains",
	shore: "Lakes & beach",
	swamp: "Swamp",
	autumn: "Autumn woods"
};
var SRGB$1 = {
	meadow: [
		.72,
		.78,
		.46
	],
	forest: [
		.24,
		.42,
		.27
	],
	desert: [
		.85,
		.71,
		.4
	],
	snow: [
		.91,
		.93,
		.95
	],
	shore: [
		.89,
		.82,
		.64
	],
	swamp: [
		.32,
		.4,
		.28
	],
	autumn: [
		.77,
		.46,
		.2
	],
	lake: [
		.2,
		.46,
		.56
	],
	rock: [
		.45,
		.42,
		.38
	],
	trunk: [
		.32,
		.22,
		.14
	],
	gold: [
		.86,
		.62,
		.28
	]
};
function toLin(c) {
	return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
}
var LINEAR = {};
for (const k of Object.keys(SRGB$1)) LINEAR[k] = SRGB$1[k].map(toLin);
function biomeColor(biome, y) {
	return LINEAR[biome === "shore" && y < 20 ? "lake" : biome] || LINEAR.meadow;
}
function palette(name) {
	return LINEAR[name] || LINEAR.rock;
}
function hash2(ix, iz) {
	let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ SEED;
	n = Math.imul(n ^ n >>> 13, 1274126177);
	return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
function fade(t) {
	return t * t * (3 - 2 * t);
}
function noise(x, z) {
	const x0 = Math.floor(x);
	const z0 = Math.floor(z);
	const tx = fade(x - x0);
	const tz = fade(z - z0);
	const v00 = hash2(x0, z0);
	const v10 = hash2(x0 + 1, z0);
	const v01 = hash2(x0, z0 + 1);
	const v11 = hash2(x0 + 1, z0 + 1);
	const a = v00 + (v10 - v00) * tx;
	return a + (v01 + (v11 - v01) * tx - a) * tz;
}
function fbm(x, z) {
	let a = 0;
	let amp = .5;
	let f = 1;
	let nrm = 0;
	for (let i = 0; i < 4; i++) {
		a += noise(x * f + i * 3.1, z * f - i * 1.7) * amp;
		nrm += amp;
		amp *= .5;
		f *= 2.05;
	}
	return a / nrm;
}
function clamp$1(v, a, b) {
	return v < a ? a : v > b ? b : v;
}
var _out = {
	y: 0,
	biome: "meadow",
	moisture: 0,
	temp: 0
};
/** Fill `out` (or a fresh object) with height and climate. No per-call alloc if `out` is passed. */
function sampleInto(x, z, out) {
	const o = out || _out;
	const wx = x * 18e-5;
	const wz = z * 18e-5;
	const cont = fbm(wx, wz);
	const hill = fbm(wx * 3.7 + 4.2, wz * 3.7 + 1.7);
	const ridgeN = fbm(wx * 2 + 9, wz * 2);
	const ridge = 1 - Math.abs(ridgeN * 2 - 1);
	let y = 9 + cont * 24 + hill * 13 + ridge * ridge * 14;
	const d = Math.hypot(x, z);
	const R = 1700;
	if (d < R) {
		const t = 1 - d / R;
		const peak = t ** 1.45 * 760;
		const blend = t * t * (3 - 2 * t);
		y = y * (1 - blend) + (22 + peak) * blend;
	}
	if (d < 56) {
		const cap = 22 + (1 - 56 / R) ** 1.45 * 760;
		const u = 1 - d / 56;
		y = y * (1 - u) + cap * u;
	}
	const ranges = [
		[
			2300,
			-2500,
			820,
			240
		],
		[
			-2500,
			2100,
			760,
			230
		],
		[
			-1600,
			-2300,
			560,
			190
		]
	];
	for (let i = 0; i < ranges.length; i++) {
		const rx = ranges[i][0];
		const rz = ranges[i][1];
		const rr = ranges[i][2];
		const rh = ranges[i][3];
		const dd = Math.hypot(x - rx, z - rz);
		if (dd < rr) {
			const t = 1 - dd / rr;
			y += t * t * rh;
		}
	}
	if (d > 1500) {
		const cliff = clamp$1((noise(x * .00215 + 12, z * .00215 - 4) - .52) * 34, -1, 1);
		y += cliff * 12;
	}
	if (cont < .4 && d > R * .92) {
		const k = (.4 - cont) / .4;
		y -= k * k * 24;
	}
	const moisture = fbm(x * 27e-5 + 40, z * 27e-5 + 6);
	const tempN = fbm(x * 15e-5 + 90, z * 15e-5);
	const climate = fbm(x * 1e-4 + 5, z * 1e-4 - 8);
	let temp = tempN * .62 + .2 + (climate - .5) * .48;
	temp -= Math.max(0, y - 32) / 360;
	let biome;
	if (y < 22.6) biome = "shore";
	else if (y > 230 || temp < .2) biome = "snow";
	else if (temp > .6 && moisture < .46 && y < 120) biome = "desert";
	else if (moisture > .58 && y < 52 && temp > .28 && temp < .64) biome = "swamp";
	else if (temp > .28 && temp < .55 && moisture > .38 && moisture < .74 && hill > .4 && y < 170) biome = "autumn";
	else if (moisture > .4 && temp < .68 && y < 240) biome = "forest";
	else biome = "meadow";
	o.y = y;
	o.biome = biome;
	o.moisture = moisture;
	o.temp = temp;
	return o;
}
function sample(x, z) {
	return sampleInto(x, z, {
		y: 0,
		biome: "meadow",
		moisture: 0,
		temp: 0
	});
}
var MAP = 180;
function createHud(root) {
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
        <canvas id="map-big" width="${MAP}" height="${MAP}"></canvas>
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
	let baseReady = false;
	let noteTimer = 0;
	function paintBase() {
		const ctx = base.getContext("2d");
		const img = ctx.createImageData(MAP, MAP);
		const tmp = {
			y: 0,
			biome: "meadow",
			moisture: 0,
			temp: 0
		};
		const rgb = {
			meadow: [
				158,
				176,
				104
			],
			forest: [
				62,
				112,
				74
			],
			desert: [
				214,
				184,
				112
			],
			snow: [
				226,
				232,
				236
			],
			shore: [
				214,
				196,
				156
			],
			swamp: [
				86,
				104,
				74
			],
			autumn: [
				186,
				112,
				58
			],
			lake: [
				58,
				122,
				146
			]
		};
		for (let y = 0; y < MAP; y++) {
			const z = HALF - (y + .5) / MAP * HALF * 2;
			for (let x = 0; x < MAP; x++) {
				sampleInto(-HALF + (x + .5) / MAP * HALF * 2, z, tmp);
				const c = rgb[tmp.biome === "shore" && tmp.y < 20 ? "lake" : tmp.biome] || rgb.meadow;
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
	function blit(ctx, canvas, sim) {
		if (!baseReady) return;
		ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
		const px = (sim.x + HALF) / (HALF * 2) * canvas.width;
		const py = (HALF - sim.z) / (HALF * 2) * canvas.height;
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
			if (opts.senseCd > .05) {
				sense.textContent = `${Math.ceil(opts.senseCd)}s`;
				sense.disabled = true;
			} else {
				sense.textContent = "Sense";
				sense.disabled = false;
			}
			blit(mapCtx, mapCanvas, sim);
			if (!modal.hidden) blit(bigCtx, big, sim);
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
		}
	};
}
function biomeLabel(biome) {
	return BIOME_LABEL[biome] || biome;
}
var GAME_KEYS = /* @__PURE__ */ new Set([
	"KeyW",
	"KeyA",
	"KeyS",
	"KeyD",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Space",
	"ShiftLeft",
	"ShiftRight",
	"KeyC",
	"KeyQ",
	"KeyE",
	"KeyF"
]);
function createInput(root) {
	const keys = /* @__PURE__ */ new Set();
	const ptr = /* @__PURE__ */ new Map();
	let stickX = 0;
	let stickY = 0;
	let touchJump = false;
	let touchClimb = false;
	let touchSense = false;
	let lookDX = 0;
	let lookDY = 0;
	let prevJump = false;
	let prevSense = false;
	let enabled = false;
	const stick = root.querySelector(".sm-stick");
	const knob = root.querySelector(".sm-knob");
	function setKnob(x, y) {
		if (!knob) return;
		knob.style.transform = `translate(${x}px, ${y}px)`;
	}
	function onKeyDown(e) {
		if (!GAME_KEYS.has(e.code)) return;
		if (enabled) e.preventDefault();
		keys.add(e.code);
	}
	function onKeyUp(e) {
		keys.delete(e.code);
	}
	function clearStick() {
		stickX = 0;
		stickY = 0;
		setKnob(0, 0);
	}
	function onDown(e) {
		if (!enabled) return;
		const act = e.target?.closest?.("[data-act]");
		const onStick = e.target?.closest?.(".sm-stick");
		if (onStick) {
			ptr.set(e.pointerId, { kind: "stick" });
			onStick.setPointerCapture?.(e.pointerId);
			moveStick(e);
			e.preventDefault();
			return;
		}
		if (act) {
			const name = act.dataset.act;
			ptr.set(e.pointerId, { kind: name });
			if (name === "jump") touchJump = true;
			if (name === "climb") touchClimb = true;
			if (name === "sense") touchSense = true;
			e.preventDefault();
			return;
		}
		const rect = root.getBoundingClientRect();
		if (e.clientX > rect.left + rect.width * .4) {
			ptr.set(e.pointerId, {
				kind: "look",
				x: e.clientX,
				y: e.clientY
			});
			e.preventDefault();
		}
	}
	function moveStick(e) {
		const rect = stick.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		let dx = e.clientX - cx;
		let dy = e.clientY - cy;
		const max = rect.width * .36;
		const m = Math.hypot(dx, dy);
		if (m > max) {
			dx = dx / m * max;
			dy = dy / m * max;
		}
		stickX = dx / max;
		stickY = -dy / max;
		setKnob(dx, dy);
	}
	function onMove(e) {
		const p = ptr.get(e.pointerId);
		if (!p) return;
		if (p.kind === "stick") {
			moveStick(e);
			e.preventDefault();
			return;
		}
		if (p.kind === "look") {
			lookDX += e.clientX - p.x;
			lookDY += e.clientY - p.y;
			p.x = e.clientX;
			p.y = e.clientY;
			e.preventDefault();
		}
	}
	function onUp(e) {
		const p = ptr.get(e.pointerId);
		if (!p) return;
		ptr.delete(e.pointerId);
		if (p.kind === "stick") clearStick();
		if (p.kind === "jump") touchJump = false;
		if (p.kind === "climb") touchClimb = false;
		if (p.kind === "sense") touchSense = false;
	}
	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("blur", () => keys.clear());
	root.addEventListener("pointerdown", onDown);
	root.addEventListener("pointermove", onMove);
	root.addEventListener("pointerup", onUp);
	root.addEventListener("pointercancel", onUp);
	root.addEventListener("contextmenu", (e) => e.preventDefault());
	function read(dt) {
		let mx = stickX;
		let my = stickY;
		if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
		if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
		if (keys.has("KeyW") || keys.has("ArrowUp")) my += 1;
		if (keys.has("KeyS") || keys.has("ArrowDown")) my -= 1;
		const pads = navigator.getGamepads?.() || [];
		let padJump = false;
		let padClimb = false;
		let padSense = false;
		let lookX = -lookDX * .0032;
		let lookY = -lookDY * .0026;
		lookDX = 0;
		lookDY = 0;
		for (const gp of pads) {
			if (!gp || gp.mapping !== "standard") continue;
			const dz = .18;
			const lx = Math.abs(gp.axes[0]) < dz ? 0 : gp.axes[0];
			const ly = Math.abs(gp.axes[1]) < dz ? 0 : gp.axes[1];
			mx += lx;
			my += -ly;
			const rx = Math.abs(gp.axes[2] || 0) < dz ? 0 : gp.axes[2];
			const ry = Math.abs(gp.axes[3] || 0) < dz ? 0 : gp.axes[3];
			lookX += -rx * 1.8 * dt;
			lookY += -ry * 1.4 * dt;
			if (gp.buttons[0]?.pressed) padJump = true;
			if (gp.buttons[1]?.pressed || gp.buttons[5]?.pressed) padClimb = true;
			if (gp.buttons[2]?.pressed) padSense = true;
		}
		if (keys.has("KeyQ")) lookX += 1.7 * dt;
		if (keys.has("KeyE")) lookX -= 1.7 * dt;
		const jumpNow = keys.has("Space") || touchJump || padJump;
		const senseNow = keys.has("KeyF") || touchSense || padSense;
		const jump = jumpNow && !prevJump;
		const sense = senseNow && !prevSense;
		prevJump = jumpNow;
		prevSense = senseNow;
		const mag = Math.hypot(mx, my);
		if (mag > 1) {
			mx /= mag;
			my /= mag;
		}
		return {
			moveX: mx,
			moveY: my,
			jump,
			climb: keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyC") || touchClimb || padClimb,
			sense,
			lookX,
			lookY
		};
	}
	return {
		read,
		setEnabled(v) {
			enabled = v;
			if (!v) {
				keys.clear();
				clearStick();
				touchJump = false;
				touchClimb = false;
				touchSense = false;
			}
		},
		setKeys(codes) {
			keys.clear();
			for (const c of codes) keys.add(c);
		},
		dispose() {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			root.removeEventListener("pointerdown", onDown);
			root.removeEventListener("pointermove", onMove);
			root.removeEventListener("pointerup", onUp);
			root.removeEventListener("pointercancel", onUp);
		}
	};
}
var KEY = "stillmere-save-v1";
function loadSave() {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.found)) return [];
		return parsed.found.filter((n) => Number.isInteger(n));
	} catch {
		return [];
	}
}
function writeSave(found) {
	try {
		localStorage.setItem(KEY, JSON.stringify({
			v: 1,
			found: [...found]
		}));
	} catch {}
}
var BIOME_INDEX = Object.fromEntries(BIOMES.map((b, i) => [b, i]));
function buildNav() {
	const cols = Math.round(HALF * 2 / 20);
	const rows = cols;
	const origin = -HALF;
	const h = new Float32Array(cols * rows);
	const biome = new Uint8Array(cols * rows);
	const tmp = {
		y: 0,
		biome: "meadow",
		moisture: 0,
		temp: 0
	};
	for (let j = 0; j < rows; j++) {
		const z = origin + (j + .5) * 20;
		for (let i = 0; i < cols; i++) {
			sampleInto(origin + (i + .5) * 20, z, tmp);
			const k = j * cols + i;
			h[k] = tmp.y;
			biome[k] = BIOME_INDEX[tmp.biome];
		}
	}
	return {
		cols,
		rows,
		origin,
		cell: 20,
		h,
		biome
	};
}
function cellOf(nav, x, z) {
	return {
		i: Math.floor((x - nav.origin) / nav.cell),
		j: Math.floor((z - nav.origin) / nav.cell)
	};
}
function cellCenter(nav, i, j) {
	return [nav.origin + (i + .5) * nav.cell, nav.origin + (j + .5) * nav.cell];
}
function inGrid(nav, i, j) {
	return i >= 0 && j >= 0 && i < nav.cols && j < nav.rows;
}
var DIRS = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1]
];
/** Cells you can walk to with a full stamina bar: slope ≤ climb max, not deep water. */
function flood(nav, si, sj) {
	const { cols, rows, h, cell } = nav;
	const reach = new Uint8Array(cols * rows);
	const qx = new Int32Array(cols * rows);
	const qz = new Int32Array(cols * rows);
	let qs = 0;
	let qe = 0;
	const start = sj * cols + si;
	if (!inGrid(nav, si, sj) || h[start] < 19.75) return reach;
	reach[start] = 1;
	qx[0] = si;
	qz[0] = sj;
	qe = 1;
	while (qs < qe) {
		const i = qx[qs];
		const j = qz[qs];
		qs++;
		const h0 = h[j * cols + i];
		for (let d = 0; d < 8; d++) {
			const ni = i + DIRS[d][0];
			const nj = j + DIRS[d][1];
			if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
			const k = nj * cols + ni;
			if (reach[k]) continue;
			const h1 = h[k];
			if (h1 < 19.75) continue;
			const dist = Math.hypot(DIRS[d][0], DIRS[d][1]) * cell;
			if (Math.abs(h1 - h0) / dist > MAX_CLIMB) continue;
			reach[k] = 1;
			qx[qe] = ni;
			qz[qe] = nj;
			qe++;
		}
	}
	return reach;
}
function nearestReachable(nav, reach, i, j) {
	if (inGrid(nav, i, j) && reach[j * nav.cols + i]) return {
		i,
		j
	};
	const max = 12;
	for (let r = 1; r <= max; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
		if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
		const ni = i + di;
		const nj = j + dj;
		if (!inGrid(nav, ni, nj)) continue;
		if (reach[nj * nav.cols + ni]) return {
			i: ni,
			j: nj
		};
	}
	return null;
}
function findPath(nav, reach, x0, z0, x1, z1) {
	const a = cellOf(nav, x0, z0);
	const b0 = cellOf(nav, x1, z1);
	const b = nearestReachable(nav, reach, b0.i, b0.j);
	if (!b) return [];
	const start = nearestReachable(nav, reach, a.i, a.j);
	if (!start) return [];
	const { cols, rows } = nav;
	const parent = new Int32Array(cols * rows);
	parent.fill(-1);
	const qx = new Int32Array(cols * rows);
	const qz = new Int32Array(cols * rows);
	const sk = start.j * cols + start.i;
	const gk = b.j * cols + b.i;
	parent[sk] = sk;
	let qs = 0;
	let qe = 1;
	qx[0] = start.i;
	qz[0] = start.j;
	while (qs < qe) {
		const i = qx[qs];
		const j = qz[qs];
		qs++;
		if (i === b.i && j === b.j) break;
		for (let d = 0; d < 8; d++) {
			const ni = i + DIRS[d][0];
			const nj = j + DIRS[d][1];
			if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
			const k = nj * cols + ni;
			if (!reach[k] || parent[k] !== -1) continue;
			parent[k] = j * cols + i;
			qx[qe] = ni;
			qz[qe] = nj;
			qe++;
		}
	}
	if (parent[gk] === -1) return [];
	const cells = [];
	let k = gk;
	for (let guard = 0; guard < cols * rows; guard++) {
		const i = k % cols;
		const j = (k - i) / cols;
		cells.push(cellCenter(nav, i, j));
		if (k === sk) break;
		k = parent[k];
	}
	cells.reverse();
	const simplified = [];
	for (let i = 0; i < cells.length; i += 3) simplified.push({
		x: cells[i][0],
		z: cells[i][1]
	});
	const last = cells[cells.length - 1];
	simplified.push({
		x: last[0],
		z: last[1]
	});
	return simplified;
}
function biomeAtCell(nav, i, j) {
	return BIOMES[nav.biome[j * nav.cols + i]] || "meadow";
}
/**
* Landmarks, caves, and the 150 treasures. Pure data — no Three.js.
* Same output in the browser and in the Node checks.
*/
var LANDMARK_TYPES = [
	{
		type: "peak",
		name: "Central Peak",
		biome: "snow",
		fixed: true
	},
	{
		type: "great-tree",
		name: "The Great Tree",
		biome: "forest"
	},
	{
		type: "desert-arch",
		name: "Sun Arch",
		biome: "desert"
	},
	{
		type: "frozen-tower",
		name: "Frozen Tower",
		biome: "snow"
	},
	{
		type: "waterfall",
		name: "Veil Falls",
		biome: "forest"
	},
	{
		type: "ruined-bridge",
		name: "Ruined Bridge",
		biome: "meadow"
	},
	{
		type: "stone-circle",
		name: "Stone Circle",
		biome: "meadow"
	},
	{
		type: "autumn-spire",
		name: "Amber Spire",
		biome: "autumn"
	},
	{
		type: "swamp-lanterns",
		name: "Lantern Marsh",
		biome: "swamp"
	},
	{
		type: "wreck",
		name: "The Beached Hull",
		biome: "shore"
	},
	{
		type: "mesa",
		name: "Red Mesa",
		biome: "desert"
	},
	{
		type: "glacier",
		name: "Glass Shelf",
		biome: "snow"
	},
	{
		type: "hollow-oak",
		name: "Hollow Oak",
		biome: "forest"
	},
	{
		type: "menhirs",
		name: "Twin Menhirs",
		biome: "meadow"
	},
	{
		type: "aqueduct",
		name: "Fallen Aqueduct",
		biome: "meadow"
	},
	{
		type: "windmill",
		name: "Windmill Ruin",
		biome: "meadow"
	},
	{
		type: "needle",
		name: "Obsidian Needle",
		biome: "snow"
	},
	{
		type: "lilies",
		name: "Lily Stones",
		biome: "swamp"
	},
	{
		type: "canyon-gate",
		name: "Canyon Gate",
		biome: "desert"
	},
	{
		type: "pine-ring",
		name: "Pine Cathedral",
		biome: "forest"
	},
	{
		type: "cairn",
		name: "Shepherd's Cairn",
		biome: "meadow"
	},
	{
		type: "colonnade",
		name: "Amber Colonnade",
		biome: "autumn"
	},
	{
		type: "tide",
		name: "Tide Pools",
		biome: "shore"
	},
	{
		type: "watchtower",
		name: "Watchfire",
		biome: "forest"
	}
];
var cached = null;
function getWorld() {
	if (!cached) cached = generateWorld();
	return cached;
}
function rand(n) {
	let x = Math.imul(n ^ SEED, 666578662);
	x = Math.imul(x ^ x >>> 15, 2246822507);
	x ^= x >>> 13;
	return (x >>> 0) / 4294967296;
}
function tooClose(list, x, z, min = 40) {
	const m2 = min * min;
	for (let i = 0; i < list.length; i++) {
		const dx = list[i].x - x;
		const dz = list[i].z - z;
		if (dx * dx + dz * dz < m2) return true;
	}
	return false;
}
function pickSpawn(nav) {
	let best = null;
	let bestScore = Infinity;
	for (let j = 0; j < nav.rows; j++) for (let i = 0; i < nav.cols; i++) {
		const k = j * nav.cols + i;
		if (biomeAtCell(nav, i, j) !== "meadow") continue;
		const [x, z] = cellCenter(nav, i, j);
		const d = Math.hypot(x, z);
		if (d < 1050 || d > 1750) continue;
		const y = nav.h[k];
		if (y < 26 || y > 70) continue;
		let steep = 0;
		let ok = true;
		for (const [di, dj] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		]) {
			const ni = i + di;
			const nj = j + dj;
			if (!inGrid(nav, ni, nj)) {
				ok = false;
				break;
			}
			const slope = Math.abs(nav.h[nj * nav.cols + ni] - y) / nav.cell;
			steep = Math.max(steep, slope);
		}
		if (!ok || steep > .25) continue;
		const score = Math.abs(d - 1400) + Math.abs(Math.atan2(z, x) - .7) * 400 + steep * 80;
		if (score < bestScore) {
			bestScore = score;
			best = {
				i,
				j,
				x,
				z,
				y
			};
		}
	}
	if (!best) best = {
		i: 200,
		j: 230,
		x: 10,
		z: 610,
		y: sample(10, 610).y
	};
	return best;
}
function placeLandmarks(nav, reach) {
	const placed = [];
	for (let n = 0; n < LANDMARK_TYPES.length; n++) {
		const spec = LANDMARK_TYPES[n];
		if (spec.fixed) {
			const s = sample(0, 0);
			placed.push({
				id: n,
				type: spec.type,
				name: spec.name,
				x: 0,
				z: 0,
				y: s.y,
				biome: s.biome,
				yaw: 0
			});
			continue;
		}
		let best = null;
		let bestScore = -Infinity;
		for (let j = 2; j < nav.rows - 2; j += 2) for (let i = 2; i < nav.cols - 2; i += 2) {
			const k = j * nav.cols + i;
			if (!reach[k]) continue;
			if (biomeAtCell(nav, i, j) !== spec.biome) continue;
			const [x, z] = cellCenter(nav, i, j);
			const y = nav.h[k];
			if (y < 20.4) continue;
			if (Math.min(4e3 - Math.abs(x), 4e3 - Math.abs(z)) < 420) continue;
			const ring = Math.hypot(x, z);
			if (spec.biome !== "snow" && ring < 800) continue;
			let minD = 1e9;
			for (let p = 0; p < placed.length; p++) minD = Math.min(minD, Math.hypot(placed[p].x - x, placed[p].z - z));
			if (minD < 760) continue;
			let flat = 0;
			for (const [di, dj] of [
				[2, 0],
				[-2, 0],
				[0, 2],
				[0, -2]
			]) flat += Math.abs(nav.h[(j + dj) * nav.cols + (i + di)] - y);
			const cliff = spec.type === "waterfall" || spec.type === "frozen-tower" || spec.type === "canyon-gate" ? flat : -flat * .15;
			const ringScore = ring > 900 && ring < 3400 ? 240 : 0;
			const score = minD * .2 + ringScore + cliff + rand(n * 917 + i * 13 + j) * 40;
			if (score > bestScore) {
				bestScore = score;
				best = {
					x,
					z,
					y
				};
			}
		}
		if (!best) for (let j = 2; j < nav.rows - 2 && !best; j += 2) for (let i = 2; i < nav.cols - 2; i += 2) {
			const k = j * nav.cols + i;
			if (!reach[k]) continue;
			if (biomeAtCell(nav, i, j) !== spec.biome) continue;
			const [x, z] = cellCenter(nav, i, j);
			let minD = 1e9;
			for (let p = 0; p < placed.length; p++) minD = Math.min(minD, Math.hypot(placed[p].x - x, placed[p].z - z));
			if (minD < 480) continue;
			best = {
				x,
				z,
				y: nav.h[k]
			};
			break;
		}
		if (!best) best = {
			x: Math.cos(n) * 2e3,
			z: Math.sin(n * 1.7) * 2e3,
			y: 30
		};
		const s = sample(best.x, best.z);
		placed.push({
			id: n,
			type: spec.type,
			name: spec.name,
			x: best.x,
			z: best.z,
			y: s.y,
			biome: s.biome,
			yaw: rand(n * 77) * Math.PI * 2
		});
	}
	return placed;
}
function placeCaves(nav, reach) {
	const caves = [];
	for (let sector = 0; sector < 10; sector++) {
		let best = null;
		let bestScore = -Infinity;
		for (let j = 1; j < nav.rows - 1; j += 2) for (let i = 1; i < nav.cols - 1; i += 2) {
			const k = j * nav.cols + i;
			if (!reach[k]) continue;
			const y = nav.h[k];
			if (y < 21) continue;
			const [x, z] = cellCenter(nav, i, j);
			if (Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI * 2) * 10 % 10) !== sector) continue;
			if (Math.hypot(x, z) < 900) continue;
			let upI = 0;
			let upJ = 0;
			let rise = 0;
			for (const [di, dj] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nk = (j + dj) * nav.cols + (i + di);
				if (!reach[nk]) continue;
				const slope = (nav.h[nk] - y) / nav.cell;
				if (slope > rise) {
					rise = slope;
					upI = di;
					upJ = dj;
				}
			}
			if (rise < Math.tan(34 * Math.PI / 180) || rise > MAX_CLIMB) continue;
			let crowded = false;
			for (const c of caves) {
				const dx = c.x - x;
				const dz = c.z - z;
				if (dx * dx + dz * dz < 49e4) crowded = true;
			}
			if (crowded) continue;
			const score = rise * 40 + rand(sector * 333 + i + j * 17) * 5 + Math.min(y, 80) * .01;
			if (score > bestScore) {
				bestScore = score;
				best = {
					x,
					z,
					y,
					upI,
					upJ,
					rise
				};
			}
		}
		if (!best) {
			const ang = -Math.PI + (sector + .5) / 10 * Math.PI * 2;
			const x = Math.cos(ang) * 2200;
			const z = Math.sin(ang) * 2200;
			const cell = cellOf(nav, x, z);
			best = {
				x,
				z,
				y: sample(x, z).y,
				upI: 0,
				upJ: 1,
				rise: .8,
				fallback: true,
				cell
			};
		}
		const s = sample(best.x, best.z);
		const yaw = Math.atan2(best.upI, best.upJ);
		caves.push({
			id: sector,
			x: best.x,
			z: best.z,
			y: s.y,
			biome: s.biome,
			yaw,
			intoX: best.upI,
			intoZ: best.upJ
		});
	}
	return caves;
}
function caveOrigin(id) {
	return {
		x: 14e3 + id * 500,
		z: 0
	};
}
function candidatesNear(nav, reach, x, z, minR, maxR) {
	const c0 = cellOf(nav, x, z);
	const rad = Math.ceil(maxR / nav.cell) + 1;
	const out = [];
	for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
		const i = c0.i + di;
		const j = c0.j + dj;
		if (!inGrid(nav, i, j)) continue;
		const k = j * nav.cols + i;
		if (!reach[k]) continue;
		const y = nav.h[k];
		if (y < 20.3) continue;
		const [cx, cz] = cellCenter(nav, i, j);
		const dist = Math.hypot(cx - x, cz - z);
		if (dist < minR || dist > maxR) continue;
		let hide = 0;
		for (const [a, b] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		]) {
			const nk = (j + b) * nav.cols + (i + a);
			if (nk >= 0 && nk < nav.h.length) hide = Math.max(hide, nav.h[nk] - y);
		}
		out.push({
			x: cx,
			z: cz,
			y,
			hide,
			dist,
			i,
			j
		});
	}
	return out;
}
function placeTreasures(nav, reach, landmarks, caves) {
	const outdoor = [];
	for (let li = 0; li < landmarks.length; li++) {
		const lm = landmarks[li];
		const n = 1 + Math.floor(rand(li * 19 + 4) * 3);
		let pool = candidatesNear(nav, reach, lm.x, lm.z, 42, 180);
		if (pool.length < n) pool = candidatesNear(nav, reach, lm.x, lm.z, 36, 280);
		pool.sort((a, b) => b.hide - a.hide || a.i - b.i || a.j - b.j);
		let got = 0;
		for (let c = 0; c < pool.length && got < n; c++) {
			const spot = pool[c];
			if (tooClose(outdoor, spot.x, spot.z, 40)) continue;
			const kind = outdoor.filter((t) => t.kind === "chest").length < 20 && got === 0 ? "chest" : "trinket";
			const trinkets = outdoor.filter((t) => t.kind === "trinket").length;
			if (kind === "trinket" && trinkets >= 120) continue;
			const s = sample(spot.x, spot.z);
			outdoor.push({
				kind,
				variant: (li + got) % 3,
				x: spot.x,
				z: spot.z,
				y: s.y + (kind === "chest" ? .55 : .7),
				biome: s.biome,
				landmarkId: lm.id,
				caveId: null,
				mapX: spot.x,
				mapZ: spot.z
			});
			got++;
		}
		lm.nearby = got;
	}
	const order = [];
	const total = nav.cols * nav.rows;
	for (let n = 0; n < total; n += 7) order.push(n % total);
	const needBiome = Object.fromEntries(BIOMES.map((b) => [b, 6]));
	function countBiome(b) {
		let c = 0;
		for (const t of outdoor) if (t.biome === b && t.kind !== "relic") c++;
		return c;
	}
	function tryFill(kind, biomeLimit) {
		for (let n = 0; n < order.length; n++) {
			if (outdoor.filter((t) => t.kind === kind).length >= (kind === "chest" ? 20 : 120)) return;
			const k = order[n];
			if (!reach[k]) continue;
			const j = Math.floor(k / nav.cols);
			const i = k - j * nav.cols;
			if (nav.h[k] < 20.4) continue;
			const biome = biomeAtCell(nav, i, j);
			if (biomeLimit && countBiome(biome) >= needBiome[biome]) continue;
			const [x, z] = cellCenter(nav, i, j);
			if (tooClose(outdoor, x, z, 40)) continue;
			if (Math.hypot(x, z) < 80) continue;
			let byLandmark = false;
			for (let li = 0; li < landmarks.length; li++) if (Math.hypot(landmarks[li].x - x, landmarks[li].z - z) < 200) {
				byLandmark = true;
				break;
			}
			if (byLandmark) continue;
			const s = sample(x, z);
			outdoor.push({
				kind,
				variant: n % 3,
				x,
				z,
				y: s.y + (kind === "chest" ? .55 : .7),
				biome: s.biome,
				landmarkId: null,
				caveId: null,
				mapX: x,
				mapZ: z
			});
		}
	}
	tryFill("trinket", true);
	tryFill("trinket", false);
	tryFill("chest", false);
	const relics = caves.map((cave) => {
		const o = caveOrigin(cave.id);
		return {
			kind: "relic",
			variant: 0,
			x: o.x + 16.5,
			z: o.z + .2,
			y: 1.15,
			biome: cave.biome,
			landmarkId: null,
			caveId: cave.id,
			mapX: cave.x,
			mapZ: cave.z
		};
	});
	const trinkets = outdoor.filter((t) => t.kind === "trinket").slice(0, 120);
	const chests = outdoor.filter((t) => t.kind === "chest").slice(0, 20);
	return [
		...trinkets,
		...chests,
		...relics
	].map((t, id) => ({
		...t,
		id
	}));
}
function generateWorld() {
	const t0 = Date.now();
	const nav = buildNav();
	const spawnCell = pickSpawn(nav);
	const reach = flood(nav, spawnCell.i, spawnCell.j);
	const landmarks = placeLandmarks(nav, reach);
	const caves = placeCaves(nav, reach);
	const treasures = placeTreasures(nav, reach, landmarks, caves);
	const spawnS = sample(spawnCell.x, spawnCell.z);
	return {
		nav,
		reach,
		spawn: {
			x: spawnCell.x,
			y: spawnS.y,
			z: spawnCell.z,
			biome: spawnS.biome
		},
		landmarks,
		caves,
		treasures,
		ms: Date.now() - t0
	};
}
var WALK = 4.2;
var CLIMB_SPEED = 1.6;
var JUMP = 6.3;
var GRAV = 16;
var DRAIN = 18;
var REGEN = 12;
var tmp$1 = {
	y: 0,
	biome: "meadow",
	moisture: 0,
	temp: 0
};
function clamp(v, a, b) {
	return v < a ? a : v > b ? b : v;
}
function createSim(spawn) {
	return {
		x: spawn.x,
		y: spawn.y,
		z: spawn.z,
		vy: 0,
		air: false,
		stamina: 100,
		climbing: false,
		yaw: Math.PI,
		pitch: .32,
		cave: -1,
		speed: 0,
		coyote: .12
	};
}
function stepSim(p, a, dt, world) {
	p.yaw += a.lookX || 0;
	p.pitch = clamp(p.pitch + (a.lookY || 0), -.5, .9);
	const yaw = p.yaw;
	const fx = -Math.sin(yaw);
	const fz = -Math.cos(yaw);
	const rx = Math.cos(yaw);
	const rz = -Math.sin(yaw);
	let mx = a.moveX || 0;
	let my = a.moveY || 0;
	const mag = Math.hypot(mx, my);
	if (mag > 1) {
		mx /= mag;
		my /= mag;
	}
	const wishX = fx * my + rx * mx;
	const wishZ = fz * my + rz * mx;
	const moving = mag > .08;
	if (p.cave >= 0) {
		stepCave(p, a, dt, world, wishX, wishZ, moving);
		return;
	}
	const h0 = sampleInto(p.x, p.z, tmp$1).y;
	let step = WALK * dt;
	let climbing = false;
	let blocked = false;
	if (moving && !p.air) {
		const h1 = sampleInto(p.x + wishX * step, p.z + wishZ * step, tmp$1).y;
		const horiz = Math.max(1e-4, Math.hypot(wishX * step, wishZ * step));
		const slope = (h1 - h0) / horiz;
		if (h1 < 19.7) blocked = true;
		else if (slope > MAX_CLIMB) blocked = true;
		else if (slope > MAX_WALK) {
			if (a.climb && p.stamina > 1) {
				climbing = true;
				step = CLIMB_SPEED * dt;
			} else blocked = true;
		}
	}
	let dx = 0;
	let dz = 0;
	if (moving && !blocked) {
		dx = wishX * (climbing ? CLIMB_SPEED * dt : step);
		dz = wishZ * (climbing ? CLIMB_SPEED * dt : step);
		const bx = p.x + dx;
		const bz = p.z + dz;
		if (Math.abs(bx) < 3988 && Math.abs(bz) < 3988) {
			if (sampleInto(bx, bz, tmp$1).y >= 19.7) {
				p.x = bx;
				p.z = bz;
			}
		}
	}
	if (climbing) {
		p.stamina = Math.max(0, p.stamina - DRAIN * dt);
		p.climbing = true;
	} else {
		p.climbing = false;
		if (!p.air) p.stamina = Math.min(100, p.stamina + REGEN * dt);
	}
	if (!p.air) {
		p.y = sampleInto(p.x, p.z, tmp$1).y;
		p.vy = 0;
		p.coyote = .12;
		if (a.jump && p.stamina > 8 && !climbing) {
			p.vy = JUMP;
			p.air = true;
			p.stamina = Math.max(0, p.stamina - 10);
			p.coyote = 0;
		}
	} else {
		p.coyote = Math.max(0, p.coyote - dt);
		if (a.jump && p.coyote > 0 && p.vy <= 0 && p.stamina > 8) {
			p.vy = JUMP;
			p.stamina = Math.max(0, p.stamina - 10);
			p.coyote = 0;
		}
		p.vy -= GRAV * dt;
		p.y += p.vy * dt;
		const g = sampleInto(p.x, p.z, tmp$1).y;
		if (p.y <= g) {
			p.y = g;
			p.air = false;
			p.vy = 0;
		}
	}
	p.speed = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
	if (!p.air && moving) for (let i = 0; i < world.caves.length; i++) {
		const c = world.caves[i];
		const ddx = p.x - c.x;
		const ddz = p.z - c.z;
		if (ddx * ddx + ddz * ddz > 6.2) continue;
		const ux = Math.sin(c.yaw);
		const uz = Math.cos(c.yaw);
		if (fx * ux + fz * uz > .35) {
			const o = caveOrigin(c.id);
			p.cave = c.id;
			p.x = o.x + 2.2;
			p.z = o.z;
			p.y = 0;
			p.air = false;
			p.vy = 0;
			p.speed = 0;
			break;
		}
	}
}
function stepCave(p, a, dt, world, wishX, wishZ, moving) {
	const cave = world.caves[p.cave];
	const o = caveOrigin(p.cave);
	let lx = p.x - o.x;
	let lz = p.z - o.z;
	if (moving) {
		lx += wishX * WALK * dt;
		lz += wishZ * WALK * dt;
	}
	if (lx < .7) {
		p.cave = -1;
		p.x = cave.x - Math.sin(cave.yaw) * 3.2;
		p.z = cave.z - Math.cos(cave.yaw) * 3.2;
		p.y = sampleInto(p.x, p.z, tmp$1).y;
		p.air = false;
		p.vy = 0;
		p.speed = 0;
		p.climbing = false;
		p.stamina = Math.min(100, p.stamina + REGEN * dt);
		return;
	}
	if (lx > 18.6) lx = 18.6;
	if (lz > 2.45) lz = 2.45;
	if (lz < -2.45) lz = -2.45;
	p.x = o.x + lx;
	p.z = o.z + lz;
	p.y = 0;
	p.air = false;
	p.vy = 0;
	p.climbing = false;
	p.speed = moving ? WALK : 0;
	p.stamina = Math.min(100, p.stamina + REGEN * dt);
	if (a.jump && p.stamina > 8) p.stamina = Math.max(0, p.stamina - 4);
}
function mulberry32(seed) {
	let a = seed >>> 0;
	return function next() {
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
var SRGB = {
	forest: [
		.29,
		.48,
		.31
	],
	autumn: [
		.78,
		.42,
		.18
	],
	pine: [
		.2,
		.36,
		.28
	],
	cactus: [
		.45,
		.55,
		.32
	],
	rock: [
		.48,
		.45,
		.4
	],
	snowrock: [
		.75,
		.78,
		.8
	],
	reed: [
		.45,
		.52,
		.28
	],
	flower: [
		.86,
		.55,
		.42
	],
	sandrock: [
		.72,
		.6,
		.4
	]
};
function shade(hex, n) {
	const k = .86 + n * .22;
	return [
		hex[0] * k,
		hex[1] * k,
		hex[2] * k
	];
}
/** kind: 0 tree, 1 pine, 2 cactus, 3 rock, 4 reed, 5 flower */
function buildChunkGeometry(cx, cz, seg) {
	const n = seg + 1;
	const positions = new Float32Array(n * n * 3);
	const colors = new Float32Array(n * n * 3);
	const indices = new Uint32Array(seg * seg * 6);
	const x0 = cx * 64;
	const z0 = cz * 64;
	const tmp = {
		y: 0,
		biome: "meadow",
		moisture: 0,
		temp: 0
	};
	for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
		const x = x0 + i / seg * 64;
		const z = z0 + j / seg * 64;
		sampleInto(x, z, tmp);
		const k = j * n + i;
		positions[k * 3] = x;
		positions[k * 3 + 1] = tmp.y;
		positions[k * 3 + 2] = z;
		const col = biomeColor(tmp.biome, tmp.y);
		const s = .9 + noise(x * .04, z * .04) * .16;
		colors[k * 3] = col[0] * s;
		colors[k * 3 + 1] = col[1] * s;
		colors[k * 3 + 2] = col[2] * s;
	}
	let t = 0;
	for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
		const a = j * n + i;
		indices[t++] = a;
		indices[t++] = a + n;
		indices[t++] = a + 1;
		indices[t++] = a + 1;
		indices[t++] = a + n;
		indices[t++] = a + n + 1;
	}
	const rng = mulberry32((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ SEED) >>> 0);
	const props = [];
	const tries = 9;
	for (let i = 0; i < tries; i++) {
		const x = x0 + rng() * 64;
		const z = z0 + rng() * 64;
		sampleInto(x, z, tmp);
		if (tmp.y < 20.6 || tmp.y > 520) continue;
		const y2 = sampleInto(x + 2, z, {
			y: 0,
			biome: "",
			moisture: 0,
			temp: 0
		}).y;
		if (Math.abs(y2 - tmp.y) > 2.2) continue;
		const roll = rng();
		let kind = 3;
		let tint = SRGB.rock;
		let scale = .7 + rng() * .8;
		if (tmp.biome === "forest" && roll > .25) {
			kind = 0;
			tint = SRGB.forest;
			scale = 1.3 + rng() * 1.4;
		} else if (tmp.biome === "autumn" && roll > .3) {
			kind = 0;
			tint = SRGB.autumn;
			scale = 1.2 + rng() * 1.3;
		} else if (tmp.biome === "snow" && roll > .55) {
			kind = 1;
			tint = SRGB.pine;
			scale = 1.1 + rng();
		} else if (tmp.biome === "desert" && roll > .45) {
			kind = 2;
			tint = SRGB.cactus;
			scale = 1 + rng() * .6;
		} else if (tmp.biome === "swamp" && roll > .35) {
			kind = 4;
			tint = SRGB.reed;
			scale = 1.2 + rng();
		} else if (tmp.biome === "meadow" && roll > .55) {
			kind = 5;
			tint = SRGB.flower;
			scale = .8 + rng() * .5;
		} else if (tmp.biome === "shore") {
			kind = 3;
			tint = SRGB.sandrock;
			scale = .5 + rng() * .5;
		} else if (tmp.biome === "snow") tint = SRGB.snowrock;
		else if (tmp.biome === "desert") tint = SRGB.sandrock;
		const col = shade(tint, rng());
		props.push(kind, x, tmp.y, z, rng() * Math.PI * 2, scale, col[0], col[1], col[2]);
	}
	return {
		positions,
		colors,
		indices,
		props: new Float32Array(props)
	};
}
function makeBuf() {
	return {
		p: [],
		c: []
	};
}
function tri(buf, ax, ay, az, bx, by, bz, cx, cy, cz, col) {
	buf.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
	const r = col[0];
	const g = col[1];
	const b = col[2];
	buf.c.push(r, g, b, r, g, b, r, g, b);
}
function box(buf, x, y, z, sx, sy, sz, col) {
	const hx = sx / 2;
	const hy = sy / 2;
	const hz = sz / 2;
	const v = [
		[
			x - hx,
			y - hy,
			z - hz
		],
		[
			x + hx,
			y - hy,
			z - hz
		],
		[
			x + hx,
			y + hy,
			z - hz
		],
		[
			x - hx,
			y + hy,
			z - hz
		],
		[
			x - hx,
			y - hy,
			z + hz
		],
		[
			x + hx,
			y - hy,
			z + hz
		],
		[
			x + hx,
			y + hy,
			z + hz
		],
		[
			x - hx,
			y + hy,
			z + hz
		]
	];
	const f = [
		[
			0,
			2,
			1,
			0,
			3,
			2
		],
		[
			4,
			5,
			6,
			4,
			6,
			7
		],
		[
			0,
			1,
			5,
			0,
			5,
			4
		],
		[
			3,
			7,
			6,
			3,
			6,
			2
		],
		[
			1,
			2,
			6,
			1,
			6,
			5
		],
		[
			0,
			4,
			7,
			0,
			7,
			3
		]
	];
	for (let i = 0; i < f.length; i++) {
		const q = f[i];
		tri(buf, ...v[q[0]], ...v[q[1]], ...v[q[2]], col);
		tri(buf, ...v[q[3]], ...v[q[4]], ...v[q[5]], col);
	}
}
function cyl(buf, x, y, z, r, h, sides, col) {
	for (let i = 0; i < sides; i++) {
		const a0 = i / sides * Math.PI * 2;
		const a1 = (i + 1) / sides * Math.PI * 2;
		const x0 = Math.cos(a0) * r;
		const z0 = Math.sin(a0) * r;
		const x1 = Math.cos(a1) * r;
		const z1 = Math.sin(a1) * r;
		tri(buf, x + x0, y, z + z0, x + x1, y, z + z1, x + x1, y + h, z + z1, col);
		tri(buf, x + x0, y, z + z0, x + x1, y + h, z + z1, x + x0, y + h, z + z0, col);
		tri(buf, x, y + h, z, x + x0, y + h, z + z0, x + x1, y + h, z + z1, col);
		tri(buf, x, y, z, x + x1, y, z + z1, x + x0, y, z + z0, col);
	}
}
function cone(buf, x, y, z, r, h, sides, col) {
	for (let i = 0; i < sides; i++) {
		const a0 = i / sides * Math.PI * 2;
		const a1 = (i + 1) / sides * Math.PI * 2;
		tri(buf, x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, x, y + h, z, col);
	}
}
function finalize(buf) {
	return {
		positions: new Float32Array(buf.p),
		colors: new Float32Array(buf.c)
	};
}
var WHITE = [
	1,
	1,
	1
];
function treeGeometry() {
	const b = makeBuf();
	cyl(b, 0, 0, 0, .16, 1.1, 5, WHITE);
	cone(b, 0, .9, 0, .85, 1.8, 6, WHITE);
	return finalize(b);
}
function cactusGeometry() {
	const b = makeBuf();
	box(b, 0, .7, 0, .28, 1.4, .28, WHITE);
	box(b, .34, .85, 0, .55, .18, .18, WHITE);
	box(b, .52, 1.05, 0, .18, .45, .18, WHITE);
	return finalize(b);
}
function rockGeometry() {
	const b = makeBuf();
	cone(b, 0, 0, 0, .7, .55, 5, WHITE);
	return finalize(b);
}
function tuftGeometry() {
	const b = makeBuf();
	cone(b, 0, 0, 0, .22, .55, 4, WHITE);
	return finalize(b);
}
function trinketGeometry(variant) {
	const b = makeBuf();
	const gold = palette("gold");
	const rock = palette("rock");
	const leaf = palette("autumn");
	if (variant === 1) {
		for (let i = 0; i < 5; i++) {
			const a = i / 5 * Math.PI * 2;
			cone(b, Math.cos(a) * .55, 0, Math.sin(a) * .55, .16, .35, 4, leaf);
		}
		cone(b, 0, .15, 0, .12, .38, 4, gold);
	} else if (variant === 2) {
		cyl(b, 0, 0, 0, .38, .45, 6, palette("trunk"));
		box(b, .1, .55, 0, .16, .16, .16, gold);
	} else {
		cone(b, .35, 0, .1, .45, .4, 5, rock);
		box(b, -.05, .35, 0, .16, .22, .16, gold);
	}
	return finalize(b);
}
function chestGeometry() {
	const b = makeBuf();
	const wood = palette("trunk");
	const gold = palette("gold");
	box(b, 0, .28, 0, .7, .42, .46, wood);
	box(b, 0, .52, 0, .74, .16, .5, wood);
	box(b, 0, .34, .24, .1, .1, .06, gold);
	return finalize(b);
}
function relicGeometry() {
	const b = makeBuf();
	const gold = palette("gold");
	cone(b, 0, .15, 0, .28, .55, 4, gold);
	cone(b, 0, .7, 0, .28, -.55, 4, gold);
	return finalize(b);
}
function playerGeometry() {
	const b = makeBuf();
	const cloth = [
		.22,
		.28,
		.34
	];
	const skin = [
		.62,
		.45,
		.32
	];
	cyl(b, 0, 0, 0, .26, .85, 6, cloth);
	cyl(b, 0, .9, 0, .16, .26, 6, skin);
	box(b, 0, .62, .2, .22, .16, .1, palette("gold"));
	return finalize(b);
}
var LOOM = {
	peak: 620,
	"great-tree": 24,
	"desert-arch": 12,
	"frozen-tower": 28,
	waterfall: 16,
	"ruined-bridge": 7,
	"stone-circle": 5,
	"autumn-spire": 22,
	"swamp-lanterns": 9,
	wreck: 6,
	mesa: 14,
	glacier: 12,
	"hollow-oak": 9,
	menhirs: 7,
	aqueduct: 9,
	windmill: 13,
	needle: 30,
	lilies: 3,
	"canyon-gate": 14,
	"pine-ring": 12,
	cairn: 5,
	colonnade: 9,
	tide: 3,
	watchtower: 16
};
function buildLandmark(type) {
	const b = makeBuf();
	const trunk = palette("trunk");
	const leaf = palette("forest");
	const snow = palette("snow");
	const sand = palette("desert");
	const gold = palette("gold");
	const rock = palette("rock");
	const autumn = palette("autumn");
	const water = palette("lake");
	const moss = palette("swamp");
	switch (type) {
		case "peak":
			cyl(b, 0, 0, 0, 1.4, .6, 6, rock);
			box(b, 0, 1.3, 0, .7, 1.4, .7, snow);
			break;
		case "great-tree":
			cyl(b, 0, 0, 0, 1.5, 7, 7, trunk);
			cone(b, 0, 5.5, 0, 6.5, 9, 8, leaf);
			cone(b, 0, 9.5, 0, 4.2, 6, 8, leaf);
			break;
		case "desert-arch":
			box(b, -2.2, 2.2, 0, 1.1, 4.4, 1.1, sand);
			box(b, 2.2, 2.2, 0, 1.1, 4.4, 1.1, sand);
			box(b, 0, 4.6, 0, 5.6, 1.1, 1.1, sand);
			break;
		case "frozen-tower":
			cyl(b, 0, 0, 0, 1.6, 6, 6, snow);
			cyl(b, 0, 6, 0, 1.15, 5, 6, snow);
			cone(b, 0, 11, 0, 1.4, 3.2, 6, [
				.75,
				.86,
				.95
			]);
			break;
		case "waterfall":
			box(b, 0, 2, -1.2, 3.2, 5, 1.4, rock);
			box(b, 0, 2.2, .2, 1.2, 4.2, .35, water);
			break;
		case "ruined-bridge":
			box(b, -2.4, 1.1, 0, 2.6, .35, 1.3, rock);
			box(b, 2.6, 1.1, 0, 2.2, .35, 1.3, rock);
			box(b, -3.6, .8, 0, .45, 1.6, 1.3, rock);
			box(b, 3.6, .8, 0, .45, 1.6, 1.3, rock);
			break;
		case "stone-circle":
			for (let i = 0; i < 8; i++) {
				const a = i / 8 * Math.PI * 2;
				box(b, Math.cos(a) * 3.2, 1.1, Math.sin(a) * 3.2, .45, 2.2, .7, rock);
			}
			break;
		case "autumn-spire":
			cyl(b, 0, 0, 0, .7, 8, 6, trunk);
			cone(b, 0, 6, 0, 2.4, 6, 6, autumn);
			break;
		case "swamp-lanterns":
			for (let i = 0; i < 4; i++) {
				box(b, (i - 1.5) * 1.4, 1.1, i % 2 * .8, .12, 2.2, .12, trunk);
				cone(b, (i - 1.5) * 1.4, 2.2, i % 2 * .8, .28, .4, 5, gold);
			}
			break;
		case "wreck":
			box(b, 0, .6, 0, 3.4, .8, 1.1, trunk);
			box(b, .4, 1.6, 0, .12, 2.2, .12, trunk);
			break;
		case "mesa":
			cyl(b, 0, 0, 0, 3.2, 5, 6, sand);
			cyl(b, 0, 5, 0, 4.2, .6, 6, sand);
			break;
		case "glacier":
			cone(b, -1, 0, 0, 1.6, 3.5, 4, snow);
			cone(b, 1.2, 0, .4, 1.3, 2.6, 4, snow);
			break;
		case "hollow-oak":
			cyl(b, 0, .6, 0, .7, 1.2, 6, trunk);
			box(b, .2, .7, .4, .35, .45, .2, [
				.02,
				.02,
				.02
			]);
			break;
		case "menhirs":
			box(b, -1, 1.6, 0, .7, 3.2, .45, rock);
			box(b, 1.1, 1.2, .2, .55, 2.4, .4, rock);
			break;
		case "aqueduct":
			for (let i = 0; i < 4; i++) box(b, i * 1.6 - 2.4, 1.4, 0, .35, 2.8, .35, rock);
			box(b, -.4, 2.9, 0, 5.2, .35, .7, rock);
			break;
		case "windmill":
			cyl(b, 0, 0, 0, 1.1, 4.5, 7, rock);
			cone(b, 0, 4.5, 0, 1.5, 1.4, 6, autumn);
			box(b, 0, 3.6, .2, 4.2, .18, .18, trunk);
			box(b, 0, 3.6, .2, .18, 4.2, .18, trunk);
			break;
		case "needle":
			cone(b, 0, 0, 0, 1.3, 14, 5, [
				.12,
				.14,
				.18
			]);
			break;
		case "lilies":
			for (let i = 0; i < 5; i++) {
				const a = i / 5 * Math.PI * 2;
				cyl(b, Math.cos(a) * 1.4, .05, Math.sin(a) * 1.4, .45, .12, 6, moss);
			}
			break;
		case "canyon-gate":
			box(b, -2, 2.4, 0, 1.2, 4.8, 1.2, sand);
			box(b, 2, 2.4, 0, 1.2, 4.8, 1.2, sand);
			box(b, 0, 5, 0, 5.2, .8, 1.2, sand);
			break;
		case "pine-ring":
			for (let i = 0; i < 6; i++) {
				const a = i / 6 * Math.PI * 2;
				cone(b, Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4, .8, 3.4, 5, leaf);
			}
			break;
		case "cairn":
			box(b, 0, .35, 0, 1.4, .5, 1.1, rock);
			box(b, .1, .85, 0, .9, .45, .7, rock);
			box(b, 0, 1.25, 0, .45, .35, .4, rock);
			break;
		case "colonnade":
			for (let i = 0; i < 5; i++) cyl(b, i * 1.1 - 2.2, 0, 0, .22, 3.2, 6, autumn);
			box(b, 0, 3.3, 0, 5.2, .28, .8, trunk);
			break;
		case "tide":
			cyl(b, -.8, .05, 0, .7, .15, 7, water);
			cyl(b, .7, .05, .3, .5, .12, 6, water);
			break;
		case "watchtower":
			cyl(b, 0, 0, 0, 1.3, 6.5, 7, rock);
			cone(b, 0, 6.5, 0, 2, 1.8, 7, autumn);
			break;
		default: box(b, 0, 1, 0, 1, 2, 2, 4, 1.2, rock);
	}
	return finalize(b);
}
function buildCaveMouth() {
	const b = makeBuf();
	const rock = palette("rock");
	box(b, -1.35, 1.25, 0, .7, 2.5, .9, rock);
	box(b, 1.35, 1.25, 0, .7, 2.5, .9, rock);
	box(b, 0, 2.7, 0, 3.4, .55, .9, rock);
	return finalize(b);
}
function buildCaveInterior() {
	const b = makeBuf();
	const rock = [
		.45,
		.4,
		.36
	];
	const dark = [
		.32,
		.29,
		.26
	];
	box(b, 10, -.2, 0, 22, .4, 6.2, dark);
	box(b, 10, 1.7, 2.9, 22, 3.6, .45, rock);
	box(b, 10, 1.7, -2.9, 22, 3.6, .45, rock);
	box(b, 20.2, 1.7, 0, .45, 3.6, 6.2, rock);
	box(b, 10, 3.5, 0, 22, .35, 6.2, dark);
	cyl(b, 16.5, 0, .2, .72, .85, 6, rock);
	return finalize(b);
}
var PRESETS = {
	low: {
		radius: 2,
		seg: 8,
		fog: 155,
		near: 55,
		pixel: .8
	},
	medium: {
		radius: 3,
		seg: 10,
		fog: 220,
		near: 85,
		pixel: .92
	},
	high: {
		radius: 4,
		seg: 14,
		fog: 390,
		near: 130,
		pixel: 1
	}
};
var tmp = {
	y: 0,
	biome: "meadow",
	moisture: 0,
	temp: 0
};
var _m = new Matrix4();
var _q = new Quaternion();
var _v = new Vector3();
var _s = new Vector3();
var _c = new Color();
var _up = new Vector3(0, 1, 0);
function geoOf(data) {
	const g = new BufferGeometry();
	g.setAttribute("position", new BufferAttribute(data.positions, 3));
	g.setAttribute("color", new BufferAttribute(data.colors, 3));
	g.computeVertexNormals();
	return g;
}
function makeInstances(geometry, cap) {
	const mat = new MeshLambertMaterial({ flatShading: true });
	const mesh = new InstancedMesh(geometry, mat, cap);
	mesh.count = 0;
	mesh.frustumCulled = false;
	mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3), 3);
	return mesh;
}
function putInstance(mesh, i, x, y, z, rot, scale, r, g, b) {
	_v.set(x, y, z);
	_q.setFromAxisAngle(_up, rot);
	_s.set(scale, scale, scale);
	_m.compose(_v, _q, _s);
	mesh.setMatrixAt(i, _m);
	_c.setRGB(r, g, b, SRGBColorSpace);
	mesh.setColorAt(i, _c);
}
function startGame(root) {
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
		const renderer = new WebGLRenderer({
			canvas,
			antialias: false,
			alpha: false,
			stencil: false,
			powerPreference: "high-performance"
		});
		renderer.outputColorSpace = SRGBColorSpace;
		renderer.setClearColor(12965342, 1);
		renderer.shadowMap.enabled = false;
		const scene = new Scene();
		const camera = new PerspectiveCamera(58, 1, .12, 900);
		const outdoor = new Group();
		const interior = new Group();
		scene.add(outdoor, interior);
		const hemi = new HemisphereLight(14018287, 7174744, .95);
		const dir = new DirectionalLight(16773336, .85);
		dir.position.set(60, 90, 30);
		scene.add(hemi, dir);
		const caveLight = new PointLight(14721370, 0, 14);
		interior.add(caveLight);
		const lambert = new MeshLambertMaterial({
			vertexColors: true,
			flatShading: true
		});
		const skyGeo = new SphereGeometry(420, 16, 12);
		const skyMat = new MeshBasicMaterial({
			vertexColors: true,
			side: 1,
			fog: false,
			depthWrite: false
		});
		paintSky(skyGeo, .34);
		const sky = new Mesh(skyGeo, skyMat);
		scene.add(sky);
		scene.fog = new Fog(12965342, 80, 220);
		const water = new Mesh(new CircleGeometry(HALF, 48), new MeshBasicMaterial({
			color: 3110288,
			transparent: true,
			opacity: .72,
			depthWrite: false
		}));
		water.rotation.x = -Math.PI / 2;
		water.position.y = 20.08;
		outdoor.add(water);
		const sim = createSim(world.spawn);
		sim.yaw = Math.atan2(world.spawn.x, world.spawn.z);
		const player = new Mesh(geoOf(playerGeometry()), lambert);
		player.scale.setScalar(1.25);
		const blobTex = blobTexture();
		const blob = new Mesh(new PlaneGeometry(1.5, 1.5), new MeshBasicMaterial({
			map: blobTex,
			transparent: true,
			depthWrite: false,
			color: 0
		}));
		blob.rotation.x = -Math.PI / 2;
		scene.add(blob);
		const trees = makeInstances(geoOf(treeGeometry()), 700);
		const cacti = makeInstances(geoOf(cactusGeometry()), 220);
		const rocks = makeInstances(geoOf(rockGeometry()), 420);
		const tufts = makeInstances(geoOf(tuftGeometry()), 320);
		outdoor.add(trees, cacti, rocks, tufts);
		const trinketInst = [
			0,
			1,
			2
		].map((v) => {
			const mesh = new InstancedMesh(geoOf(trinketGeometry(v)), lambert, 48);
			mesh.count = 0;
			mesh.frustumCulled = false;
			outdoor.add(mesh);
			return mesh;
		});
		const chestInst = new InstancedMesh(geoOf(chestGeometry()), lambert, 24);
		chestInst.count = 0;
		chestInst.frustumCulled = false;
		outdoor.add(chestInst);
		const landmarkMeshes = world.landmarks.map((lm) => {
			const mesh = new Mesh(geoOf(buildLandmark(lm.type)), lambert);
			mesh.position.set(lm.x, lm.y, lm.z);
			mesh.rotation.y = lm.yaw;
			mesh.visible = false;
			outdoor.add(mesh);
			return mesh;
		});
		const impostor = new InstancedMesh(geoOf(impostorGeo()), new MeshBasicMaterial({
			vertexColors: false,
			color: 9347246,
			fog: false,
			transparent: true,
			opacity: .88,
			depthWrite: false
		}), 24);
		impostor.frustumCulled = false;
		scene.add(impostor);
		const mouths = world.caves.map((cave) => {
			const mesh = new Mesh(geoOf(buildCaveMouth()), lambert);
			mesh.position.set(cave.x, cave.y, cave.z);
			mesh.rotation.y = cave.yaw + Math.PI;
			mesh.visible = false;
			outdoor.add(mesh);
			return mesh;
		});
		const caveMat = new MeshBasicMaterial({
			vertexColors: true,
			side: 2
		});
		const caveMesh = new Mesh(geoOf(buildCaveInterior()), caveMat);
		caveMesh.frustumCulled = false;
		interior.add(caveMesh);
		const relic = new Mesh(geoOf(relicGeometry()), lambert);
		relic.position.set(16.5, 1.15, .2);
		relic.frustumCulled = false;
		interior.add(relic);
		const ring = new Mesh(new RingGeometry(.82, 1, 40), new MeshBasicMaterial({
			color: 14721370,
			transparent: true,
			opacity: .42,
			side: 2,
			depthWrite: false
		}));
		ring.rotation.x = -Math.PI / 2;
		ring.visible = false;
		scene.add(ring);
		const built = /* @__PURE__ */ new Map();
		const wanted = /* @__PURE__ */ new Set();
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
			const g = new BufferGeometry();
			g.setAttribute("position", new BufferAttribute(msg.positions, 3));
			g.setAttribute("color", new BufferAttribute(msg.colors, 3));
			g.setIndex(new BufferAttribute(msg.indices, 1));
			g.computeVertexNormals();
			const mesh = new Mesh(g, lambert);
			outdoor.add(mesh);
			built.set(key, {
				mesh,
				props: msg.props,
				cx: msg.cx,
				cz: msg.cz
			});
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
					const row = [
						p[i + 1],
						p[i + 2],
						p[i + 3],
						p[i + 4],
						p[i + 5],
						p[i + 6],
						p[i + 7],
						p[i + 8]
					];
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
			const trinkets = [
				[],
				[],
				[]
			];
			const chests = [];
			for (const t of world.treasures) {
				if (found.has(t.id) || t.kind === "relic") continue;
				const cx = Math.floor(t.x / 64);
				const cz = Math.floor(t.z / 64);
				if (!built.has(`${cx}:${cz}`)) continue;
				const row = [
					t.x,
					t.y,
					t.z,
					t.id,
					1
				];
				if (t.kind === "chest") chests.push(row);
				else trinkets[t.variant % 3].push(row);
			}
			writePlain(chestInst, chests);
			for (let v = 0; v < 3; v++) writePlain(trinketInst[v], trinkets[v]);
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
					commitChunk({
						...buildChunkGeometry(job.cx, job.cz, job.seg),
						cx: job.cx,
						cz: job.cz,
						token
					});
					continue;
				}
				inflight++;
				worker.postMessage({
					id: job.key,
					cx: job.cx,
					cz: job.cz,
					seg: job.seg,
					token
				});
				return;
			}
		}
		function reconcile() {
			const p = preset();
			const cx = Math.floor(sim.x / 64);
			const cz = Math.floor(sim.z / 64);
			const minC = Math.floor(-HALF / 64);
			const maxC = Math.floor((HALF - 1) / 64);
			const next = /* @__PURE__ */ new Set();
			const jobs = [];
			for (let dz = -p.radius; dz <= p.radius; dz++) for (let dx = -p.radius; dx <= p.radius; dx++) {
				const x = cx + dx;
				const z = cz + dz;
				if (x < minC || z < minC || x > maxC || z > maxC) continue;
				const key = keyOf(x, z);
				next.add(key);
				if (!built.has(key)) jobs.push({
					key,
					cx: x,
					cz: z,
					seg: p.seg,
					d: dx * dx + dz * dz
				});
			}
			for (const [key, rec] of built) if (!next.has(key)) {
				outdoor.remove(rec.mesh);
				rec.mesh.geometry.dispose();
				built.delete(key);
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
			const fit = Math.min(1, (coarse ? 1280 : 1920) / Math.max(w, h));
			const dpr = Math.min(window.devicePixelRatio || 1, 2) * preset().pixel * resScale * fit;
			renderer.setPixelRatio(Math.max(.4, dpr));
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
			const day = Math.sin(u * Math.PI * 2 - Math.PI / 2) * .5 + .5;
			const k = .42 + day * .58;
			return {
				top: new Color().setRGB(.45 * k, .58 * k, .72 * k),
				horizon: new Color().setRGB(.78 * k + .12, .8 * k, .74 * k + day * .05),
				light: .55 + day * .5
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
			hemi.intensity = .45 + c.light * .45;
			dir.intensity = .25 + c.light * .55;
			hemi.color.copy(c.top);
		}
		function updateCamera(dt) {
			if (!playing) sim.yaw += dt * .12;
			const dist = sim.cave >= 0 ? 4.4 : 7.6;
			const lx = -Math.sin(sim.yaw) * Math.cos(sim.pitch);
			const ly = Math.sin(sim.pitch);
			const lz = -Math.cos(sim.yaw) * Math.cos(sim.pitch);
			const ty = sim.y + 1.35;
			camera.position.set(sim.x - lx * dist, ty - ly * dist + .85, sim.z - lz * dist);
			if (sim.cave < 0) {
				const gy = sampleInto(camera.position.x, camera.position.z, tmp).y + .45;
				if (camera.position.y < gy) camera.position.y = gy;
			}
			sky.position.copy(camera.position);
			camera.lookAt(sim.x, ty, sim.z);
			camera.far = sim.cave >= 0 ? 60 : 900;
			camera.updateProjectionMatrix();
		}
		function updatePlayer() {
			const bob = playing && sim.speed > .4 ? Math.sin(performance.now() * .012) * .04 : 0;
			player.position.set(sim.x, sim.y + bob, sim.z);
			_v.set(sim.x - Math.sin(sim.yaw), sim.y, sim.z - Math.cos(sim.yaw));
			player.lookAt(_v);
			blob.position.set(sim.x, sim.y + .08, sim.z);
			blob.visible = sim.cave < 0;
			player.visible = true;
		}
		function pointOf(t) {
			if (t.kind === "relic" && sim.cave !== t.caveId) {
				sampleInto(t.mapX, t.mapZ, tmp);
				return {
					x: t.mapX,
					y: tmp.y + .4,
					z: t.mapZ
				};
			}
			return {
				x: t.x,
				y: t.y,
				z: t.z
			};
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
			return {
				t: best,
				d: bestD,
				pt
			};
		}
		function updateSense(dt, now) {
			if (senseCd > 0) senseCd = Math.max(0, senseCd - dt);
			const active = senseId != null && !found.has(senseId) ? world.treasures[senseId] : null;
			if (!active) {
				ring.visible = false;
				return;
			}
			const pt = pointOf(active);
			const dist = Math.hypot(sim.x - pt.x, sim.z - pt.z);
			const radius = Math.max(3.5, dist * .86);
			ring.visible = sim.cave < 0 || active.caveId === sim.cave;
			ring.position.set(pt.x, pt.y + .35, pt.z);
			ring.scale.setScalar(radius);
			const interval = Math.max(.16, Math.min(1.35, dist / 170));
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
			hud.setCounts([
				"meadow",
				"forest",
				"desert",
				"snow",
				"shore",
				"swamp",
				"autumn"
			].map((b) => `<li><span>${biomeLabel(b)}</span><span>${got[b] || 0}/${totals[b] || 0}</span></li>`).join(""));
		}
		function updateDressing() {
			const fog = sim.cave >= 0 ? 30 : preset().fog;
			for (let i = 0; i < world.landmarks.length; i++) {
				const lm = world.landmarks[i];
				const dx = lm.x - sim.x;
				const dz = lm.z - sim.z;
				const dist = Math.hypot(dx, dz) || 1;
				const near = dist < fog * .82;
				landmarkMeshes[i].visible = near && sim.cave < 0;
				const shell = fog * .93;
				if (sim.cave >= 0 || dist < fog * .72) {
					_s.set(0, 0, 0);
					_v.set(0, -999, 0);
				} else {
					const k = shell / dist;
					const h = LOOM[lm.type] || 10;
					_v.set(sim.x + dx * k, Math.max(6, h * k * .55), sim.z + dz * k);
					const s = Math.max(.6, h * k);
					_s.set(s, s, s);
				}
				_q.identity();
				_m.compose(_v, _q, _s);
				impostor.setMatrixAt(i, _m);
			}
			impostor.instanceMatrix.needsUpdate = true;
			impostor.visible = sim.cave < 0;
			for (let i = 0; i < mouths.length; i++) {
				const c = world.caves[i];
				mouths[i].visible = sim.cave < 0 && Math.hypot(c.x - sim.x, c.z - sim.z) < fog;
			}
			outdoor.visible = sim.cave < 0;
			if (sim.cave >= 0) {
				const o = caveOrigin(sim.cave);
				interior.position.set(o.x, 0, o.z);
				interior.visible = true;
				caveLight.intensity = 2.2;
				caveLight.position.set(16.5, 2.2, .2);
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
			return {
				...actions,
				moveX: 0,
				moveY: 1,
				climb: true,
				lookX: 0,
				lookY: 0,
				jump: false
			};
		}
		function track(dt) {
			const fps = dt > 0 ? 1 / dt : 60;
			fpsEma = fpsEma * .9 + fps * .1;
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
			if (bad > .45 && resScale > .55) {
				resScale = Math.max(.55, resScale * .8);
				bad = 0;
				resize();
			} else if (bad > .45 && tier !== "low") {
				const order = [
					"low",
					"medium",
					"high"
				];
				applyQuality(order[Math.max(0, order.indexOf(tier) - 1)]);
				qualityLock = 1.5;
				bad = 0;
			}
			if (good > 4 && resScale < 1) {
				resScale = Math.min(1, resScale * 1.08);
				good = 0;
				resize();
			} else if (good > 4 && !coarse && tier !== "high") {
				const order = [
					"low",
					"medium",
					"high"
				];
				applyQuality(order[Math.min(2, order.indexOf(tier) + 1)]);
				qualityLock = 2;
				good = 0;
			}
		}
		const timer = new Timer();
		timer.connect(document);
		function frame() {
			if (bag.dead) return;
			timer.update();
			const dt = Math.min(.1, timer.getDelta());
			updateSky(timeFreeze != null ? timeFreeze : timer.getElapsed() % 480 / 480);
			acc += dt;
			let steps = 0;
			while (acc >= 1 / 60 && steps < 4) {
				let actions = playing ? input.read(1 / 60) : {
					moveX: 0,
					moveY: 0,
					jump: false,
					climb: false,
					sense: false,
					lookX: 0,
					lookY: 0
				};
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
				updateSense(1 / 60, performance.now() / 1e3);
				acc -= 1 / 60;
				steps++;
			}
			updateCamera(dt);
			updatePlayer();
			if (sim.cave < 0) {
				const cx = Math.floor(sim.x / 64);
				const cz = Math.floor(sim.z / 64);
				if (cx !== frame.cx || cz !== frame.cz || built.size === 0) {
					frame.cx = cx;
					frame.cz = cz;
					reconcile();
				} else pump();
			}
			updateDressing();
			const pset = preset();
			scene.fog.near = sim.cave >= 0 ? 3 : pset.near;
			scene.fog.far = sim.cave >= 0 ? 28 : pset.fog;
			sampleInto(sim.x, sim.z, tmp);
			const place = sim.cave >= 0 ? `Cave ${sim.cave + 1} · ${biomeLabel(world.caves[sim.cave].biome)}` : biomeLabel(tmp.biome);
			hud.update(sim, {
				found: found.size,
				total: 150,
				place,
				stamina: sim.stamina,
				qualityLabel: mode === "auto" ? `Auto · ${tier}` : tier[0].toUpperCase() + tier.slice(1),
				fpsLabel: `${Math.round(fpsEma)} fps`,
				senseCd,
				dt
			});
			renderer.render(scene, camera);
			lastCalls = renderer.info.render.calls;
			track(dt);
		}
		renderer.setAnimationLoop(frame);
		resize();
		updateCounts();
		hud.paintBase();
		reconcile();
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
			const order = [
				"auto",
				"low",
				"medium",
				"high"
			];
			mode = order[(order.indexOf(mode) + 1) % order.length];
			if (mode === "auto") tier = coarse ? "medium" : "high";
			else tier = mode;
			resScale = 1;
			applyQuality(tier);
		});
		if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
		window.__controlsTest = {
			getYaw: () => sim.yaw,
			getSpeed: () => sim.speed,
			setKeys: (codes) => input.setKeys(codes),
			setYaw: (y) => {
				sim.yaw = y;
			},
			getPos: () => ({
				x: sim.x,
				y: sim.y,
				z: sim.z
			})
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
				tier = name === "auto" ? coarse ? "medium" : "high" : name;
				applyQuality(tier);
			},
			setSpike(on) {
				for (const m of spike) scene.remove(m);
				spike = [];
				if (!on) return;
				const g = new BoxGeometry(.4, .4, .4);
				const mat = new MeshBasicMaterial({ color: 16711850 });
				for (let i = 0; i < 260; i++) {
					const m = new Mesh(g, mat);
					m.frustumCulled = false;
					m.position.set(sim.x + i % 16 * .35, sim.y + 1.2, sim.z + Math.floor(i / 16) * .35);
					scene.add(m);
					spike.push(m);
				}
			},
			setHudSabotage(on) {
				root.classList.toggle("is-sabotage", !!on);
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
					heap: performance.memory?.usedJSHeapSize || 0,
					found: found.size,
					tier,
					resScale,
					stamina: sim.stamina,
					playing
				};
			}
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
	const day = Math.sin(u * Math.PI * 2 - Math.PI / 2) * .5 + .5;
	const k = .42 + day * .58;
	const pos = geo.attributes.position;
	let colors = geo.getAttribute("color");
	if (!colors || colors.count !== pos.count) {
		colors = new BufferAttribute(new Float32Array(pos.count * 3), 3);
		geo.setAttribute("color", colors);
	}
	const arr = colors.array;
	for (let i = 0; i < pos.count; i++) {
		const y = pos.getY(i);
		const t = MathUtils.smoothstep(y / 420, -.05, .72);
		arr[i * 3] = (.78 * k + .1) * (1 - t) + .45 * k * t;
		arr[i * 3 + 1] = .8 * k * (1 - t) + .58 * k * t;
		arr[i * 3 + 2] = (.74 * k + day * .05) * (1 - t) + .72 * k * t;
	}
	colors.needsUpdate = true;
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
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	return tex;
}
function impostorGeo() {
	const b = makeBuf();
	cone(b, 0, 0, 0, .45, 1, 6, [
		.55,
		.62,
		.68
	]);
	return finalize(b);
}
//#endregion
export { startGame };
