// @ts-nocheck
export function createAudio() {
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
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  return {
    unlock,
    sense(dist) {
      const closeness = Math.max(0, Math.min(1, 1 - dist / 280));
      tone(520 + closeness * 280, 0.07, 0.035, "sine");
    },
    approach(dist) {
      const closeness = Math.max(0, Math.min(1, 1 - dist / 60));
      tone(440 + closeness * 220, 0.16, 0.012 + closeness * 0.045, "sine");
    },
    found(kind) {
      tone(kind === "relic" ? 392 : 523, 0.09, 0.05, "triangle");
      setTimeout(() => tone(kind === "relic" ? 784 : 784, 0.14, 0.04, "sine"), 80);
    },
  };
}
