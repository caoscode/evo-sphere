import { useEffect, useRef } from "react";
import type { SimulationConfig, WorldState } from "../simulation/types";
import { draw } from "../rendering/renderer";
import { step } from "../simulation/world";

const TICK_MS = 16; // ~60 ticks/sec
const MAX_STEPS_PER_FRAME = 5;

interface SimulationCanvasProps {
  worldRef: React.RefObject<WorldState>;
  configRef: React.RefObject<SimulationConfig>;
  pausedRef: React.RefObject<boolean>;
  speedRef: React.RefObject<number>;
}

export function SimulationCanvas({
  worldRef,
  configRef,
  pausedRef,
  speedRef,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize handler
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(document.documentElement);

    // Animation loop
    let rafId: number;
    let lastTime = performance.now();
    let accumulator = 0;

    function frame(now: number) {
      const dt = now - lastTime;
      lastTime = now;

      if (!pausedRef.current) {
        accumulator += dt;
        const speed = speedRef.current ?? 1;
        let steps = 0;
        while (accumulator >= TICK_MS && steps < MAX_STEPS_PER_FRAME * speed) {
          step(worldRef.current!, configRef.current!);
          accumulator -= TICK_MS;
          steps++;
        }
        // Prevent accumulator from growing unbounded
        if (accumulator > TICK_MS * MAX_STEPS_PER_FRAME) {
          accumulator = 0;
        }
      } else {
        accumulator = 0;
      }

      draw(ctx!, worldRef.current!, window.innerWidth, window.innerHeight);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [worldRef, configRef, pausedRef, speedRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        display: "block",
      }}
    />
  );
}
