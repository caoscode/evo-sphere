import { useEffect, useRef } from "react";
import type { SimulationConfig, WorldState } from "../simulation/types";
import type { Camera } from "../rendering/camera";
import { draw } from "../rendering/renderer";
import { step } from "../simulation/world";
import { panCamera, screenToWorld, zoomCamera } from "../rendering/camera";
import { distSq } from "../simulation/spatial-grid";

const TICK_MS = 16; // ~60 ticks/sec
const MAX_STEPS_PER_FRAME = 5;

interface SimulationCanvasProps {
  worldRef: React.RefObject<WorldState>;
  configRef: React.RefObject<SimulationConfig>;
  pausedRef: React.RefObject<boolean>;
  speedRef: React.RefObject<number>;
  cameraRef: React.RefObject<Camera>;
  selectedIdRef: React.MutableRefObject<number | null>;
  onTogglePause: () => void;
  onReset: () => void;
  onInjectFood: () => void;
}

export function SimulationCanvas({
  worldRef,
  configRef,
  pausedRef,
  speedRef,
  cameraRef,
  selectedIdRef,
  onTogglePause,
  onReset,
  onInjectFood,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    // Mouse handlers
    function onMouseDown(e: MouseEvent) {
      if (e.button === 0) {
        draggingRef.current = true;
        dragMovedRef.current = false;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (draggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          dragMovedRef.current = true;
        }
        panCamera(cameraRef.current!, dx, dy);
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (draggingRef.current && !dragMovedRef.current) {
        // Click without drag — select organism
        const wp = screenToWorld(
          cameraRef.current!,
          e.clientX,
          e.clientY,
          window.innerWidth,
          window.innerHeight,
        );
        let closestId: number | null = null;
        let closestDSq = 400; // max 20 world units click radius
        for (const org of worldRef.current!.organisms) {
          const d = distSq(wp.x, wp.y, org.x, org.y);
          if (d < closestDSq) {
            closestDSq = d;
            closestId = org.id;
          }
        }
        selectedIdRef.current = closestId;
      }
      draggingRef.current = false;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomCamera(
        cameraRef.current!,
        factor,
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight,
      );
    }

    // Keyboard shortcuts
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          onTogglePause();
          break;
        case "KeyR":
          onReset();
          break;
        case "KeyF":
          onInjectFood();
          break;
        case "Equal":
        case "NumpadAdd":
          zoomCamera(
            cameraRef.current!,
            1.2,
            window.innerWidth / 2,
            window.innerHeight / 2,
            window.innerWidth,
            window.innerHeight,
          );
          break;
        case "Minus":
        case "NumpadSubtract":
          zoomCamera(
            cameraRef.current!,
            0.8,
            window.innerWidth / 2,
            window.innerHeight / 2,
            window.innerWidth,
            window.innerHeight,
          );
          break;
        case "Escape":
          selectedIdRef.current = null;
          break;
      }
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);

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
        if (accumulator > TICK_MS * MAX_STEPS_PER_FRAME) {
          accumulator = 0;
        }
      } else {
        accumulator = 0;
      }

      draw(
        ctx!,
        worldRef.current!,
        window.innerWidth,
        window.innerHeight,
        cameraRef.current!,
        selectedIdRef.current,
      );
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    worldRef,
    configRef,
    pausedRef,
    speedRef,
    cameraRef,
    selectedIdRef,
    onTogglePause,
    onReset,
    onInjectFood,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        display: "block",
        cursor: "grab",
      }}
    />
  );
}
