import { useCallback, useRef, useState } from "react";
import { SimulationCanvas } from "./components/SimulationCanvas";
import { ControlPanel } from "./components/ControlPanel";
import { ObservabilityLayer } from "./components/observability/ObservabilityLayer";
import { DEFAULT_CONFIG } from "./simulation/config";
import { createSimulation, computeCentroid } from "./simulation/world";
import { injectFoodBurst } from "./simulation/food";
import { createDefaultDebugOverlay } from "./observability/debug-overlay";
import type { SimulationConfig, WorldState } from "./simulation/types";
import type { Camera } from "./rendering/camera";
import { createCamera } from "./rendering/camera";
import "./App.css";

function App() {
  const configRef = useRef<SimulationConfig>({ ...DEFAULT_CONFIG });
  const worldRef = useRef<WorldState>(createSimulation(configRef.current));
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const cameraRef = useRef<Camera>(createCamera());
  const selectedIdRef = useRef<number | null>(null);
  const debugOverlayRef = useRef(createDefaultDebugOverlay());
  const stepOnceRef = useRef(false);
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set());

  const handleTogglePanel = useCallback((id: string) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
  }, []);

  const handleReset = useCallback(() => {
    worldRef.current = createSimulation(configRef.current);
    pausedRef.current = false;
    selectedIdRef.current = null;
    const c = computeCentroid(worldRef.current.organisms);
    cameraRef.current.x = c.x;
    cameraRef.current.y = c.y;
  }, []);

  const handleInjectFood = useCallback(() => {
    injectFoodBurst(worldRef.current, configRef.current, 50);
  }, []);

  return (
    <>
      <SimulationCanvas
        worldRef={worldRef}
        configRef={configRef}
        pausedRef={pausedRef}
        speedRef={speedRef}
        cameraRef={cameraRef}
        selectedIdRef={selectedIdRef}
        debugOverlayRef={debugOverlayRef}
        stepOnceRef={stepOnceRef}
        onTogglePause={handleTogglePause}
        onReset={handleReset}
        onInjectFood={handleInjectFood}
      />
      <ControlPanel
        worldRef={worldRef}
        configRef={configRef}
        pausedRef={pausedRef}
        speedRef={speedRef}
        cameraRef={cameraRef}
        selectedIdRef={selectedIdRef}
        openPanels={openPanels}
        onTogglePanel={handleTogglePanel}
      />
      <ObservabilityLayer
        worldRef={worldRef}
        debugOverlayRef={debugOverlayRef}
        stepOnceRef={stepOnceRef}
        pausedRef={pausedRef}
        openPanels={openPanels}
        onTogglePanel={handleTogglePanel}
      />
    </>
  );
}

export default App;
