import { useCallback, useState } from "react";
import type { SimulationConfig, WorldState } from "../simulation/types";
import { injectFoodBurst } from "../simulation/food";
import { killPortion } from "../simulation/world";
import { createSimulation } from "../simulation/world";
import { StatsDisplay } from "./StatsDisplay";

interface ControlPanelProps {
  worldRef: React.MutableRefObject<WorldState>;
  configRef: React.MutableRefObject<SimulationConfig>;
  pausedRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
}

export function ControlPanel({ worldRef, configRef, pausedRef, speedRef }: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [foodRate, setFoodRate] = useState(configRef.current.foodSpawnRate);
  const [energyCost, setEnergyCost] = useState(configRef.current.energyCostMultiplier);
  const [simSpeed, setSimSpeed] = useState(1);

  const handleFoodRate = useCallback(
    (value: number) => {
      setFoodRate(value);
      configRef.current.foodSpawnRate = value;
    },
    [configRef],
  );

  const handleEnergyCost = useCallback(
    (value: number) => {
      setEnergyCost(value);
      configRef.current.energyCostMultiplier = value;
    },
    [configRef],
  );

  const handleSimSpeed = useCallback(
    (value: number) => {
      setSimSpeed(value);
      speedRef.current = value;
    },
    [speedRef],
  );

  const togglePause = useCallback(() => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
  }, [paused, pausedRef]);

  const handleReset = useCallback(() => {
    worldRef.current = createSimulation(configRef.current);
    setPaused(false);
    pausedRef.current = false;
  }, [worldRef, configRef, pausedRef]);

  const handleInjectFood = useCallback(() => {
    injectFoodBurst(worldRef.current, configRef.current, 50);
  }, [worldRef, configRef]);

  const handleKill = useCallback(() => {
    killPortion(worldRef.current, 0.5);
  }, [worldRef]);

  if (collapsed) {
    return (
      <div className="control-panel collapsed" onClick={() => setCollapsed(false)}>
        <span className="panel-toggle">EvoSphere</span>
      </div>
    );
  }

  return (
    <div className="control-panel">
      <div className="panel-header">
        <span className="panel-title">EvoSphere</span>
        <button className="panel-toggle" onClick={() => setCollapsed(true)}>
          &minus;
        </button>
      </div>

      <div className="panel-section">
        <label>
          <span className="slider-label">
            Food Rate <span className="slider-value">{foodRate.toFixed(1)}</span>
          </span>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={foodRate}
            onChange={(e) => handleFoodRate(Number(e.target.value))}
          />
        </label>

        <label>
          <span className="slider-label">
            Energy Cost <span className="slider-value">{energyCost.toFixed(1)}</span>
          </span>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            value={energyCost}
            onChange={(e) => handleEnergyCost(Number(e.target.value))}
          />
        </label>

        <label>
          <span className="slider-label">
            Speed <span className="slider-value">{simSpeed}x</span>
          </span>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={simSpeed}
            onChange={(e) => handleSimSpeed(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="panel-section panel-buttons">
        <button onClick={handleInjectFood}>Inject Food</button>
        <button onClick={handleKill} className="danger">
          Kill 50%
        </button>
        <button onClick={togglePause}>{paused ? "Resume" : "Pause"}</button>
        <button onClick={handleReset}>Reset</button>
      </div>

      <div className="panel-section">
        <StatsDisplay worldRef={worldRef} />
      </div>
    </div>
  );
}
