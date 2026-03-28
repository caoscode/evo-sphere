import { useRef } from "react";
import { SimulationCanvas } from "./components/SimulationCanvas";
import { ControlPanel } from "./components/ControlPanel";
import { DEFAULT_CONFIG } from "./simulation/config";
import { createSimulation } from "./simulation/world";
import type { SimulationConfig, WorldState } from "./simulation/types";
import "./App.css";

function App() {
  const configRef = useRef<SimulationConfig>({ ...DEFAULT_CONFIG });
  const worldRef = useRef<WorldState>(createSimulation(configRef.current));
  const pausedRef = useRef(false);
  const speedRef = useRef(1);

  return (
    <>
      <SimulationCanvas
        worldRef={worldRef}
        configRef={configRef}
        pausedRef={pausedRef}
        speedRef={speedRef}
      />
      <ControlPanel
        worldRef={worldRef}
        configRef={configRef}
        pausedRef={pausedRef}
        speedRef={speedRef}
      />
    </>
  );
}

export default App;
