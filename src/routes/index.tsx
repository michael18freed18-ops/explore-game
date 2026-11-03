import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let stop = () => {};
    let cancelled = false;
    import("@/game/engine.js").then((mod) => {
      if (cancelled || !ref.current) return;
      stop = mod.startGame(ref.current);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
  return (
    <div ref={ref} className="game-root sm-root">
      <canvas className="sm-canvas" />
      <div className="sm-hud">
        <div className="sm-status">
          <p className="sm-found">Found 0/150</p>
          <p className="sm-place">Meadow</p>
          <div className="sm-stam" aria-hidden="true">
            <span />
          </div>
          <button type="button" className="sm-quality">
            Auto · medium
          </button>
        </div>
        <button type="button" className="sm-map" aria-label="Enlarge the map" />
        <div className="sm-stick" aria-hidden="true">
          <div className="sm-knob" />
        </div>
        <div className="sm-actions">
          <button type="button">Jump</button>
          <button type="button">Climb</button>
          <button type="button">Sense</button>
        </div>
        <p className="sm-keys">WASD move · drag to look · Q and E turn · Space jump · Shift climb · F sense</p>
      </div>
      <div className="sm-start">
        <p className="sm-eyebrow">No enemies. Just weather.</p>
        <h1>Stillmere</h1>
        <p className="sm-lead">
          A fixed 8 km of meadow, wood, desert, snow, marsh and shore. One hundred and fifty things are still out
          there.
        </p>
        <button
          type="button"
          onClick={() => {
            (window as unknown as { __stillmereArm?: boolean }).__stillmereArm = true;
          }}
        >
          Begin
        </button>
      </div>
    </div>
  );
}
