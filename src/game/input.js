// @ts-nocheck
const GAME_KEYS = new Set([
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
  "KeyF",
]);

export function createInput(root) {
  const keys = new Set();
  const ptr = new Map();
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
    if (e.clientX > rect.left + rect.width * 0.4) {
      ptr.set(e.pointerId, { kind: "look", x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }
  function moveStick(e) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = rect.width * 0.36;
    const m = Math.hypot(dx, dy);
    if (m > max) {
      dx = (dx / m) * max;
      dy = (dy / m) * max;
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
    let lookX = -lookDX * 0.0032;
    let lookY = -lookDY * 0.0026;
    lookDX = 0;
    lookDY = 0;
    for (const gp of pads) {
      if (!gp || gp.mapping !== "standard") continue;
      const dz = 0.18;
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
      lookY,
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
    },
  };
}
