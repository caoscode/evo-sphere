import { useCallback, useEffect, useState } from "react";
import type { SimulationConfig, WorldState } from "../simulation/types";
import type { Camera } from "../rendering/camera";
import { injectFoodBurst } from "../simulation/food";
import { killPortion, computeCentroid } from "../simulation/world";
import { createSimulation } from "../simulation/world";
import { StatsDisplay } from "./StatsDisplay";

interface ControlPanelProps {
  worldRef: React.MutableRefObject<WorldState>;
  configRef: React.MutableRefObject<SimulationConfig>;
  pausedRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
  cameraRef: React.MutableRefObject<Camera>;
  selectedIdRef: React.MutableRefObject<number | null>;
}

export function ControlPanel({
  worldRef,
  configRef,
  pausedRef,
  speedRef,
  cameraRef,
  selectedIdRef,
}: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [foodRate, setFoodRate] = useState(configRef.current.foodSpawnRate);
  const [energyCost, setEnergyCost] = useState(configRef.current.energyCostMultiplier);
  const [simSpeed, setSimSpeed] = useState(1);
  const [mutationRate, setMutationRate] = useState(configRef.current.mutationRate);

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

  const handleMutationRate = useCallback(
    (value: number) => {
      setMutationRate(value);
      configRef.current.mutationRate = value;
    },
    [configRef],
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
    const c = computeCentroid(worldRef.current.organisms);
    cameraRef.current.x = c.x;
    cameraRef.current.y = c.y;
  }, [worldRef, configRef, pausedRef, cameraRef]);

  const handleCenterView = useCallback(() => {
    const c = computeCentroid(worldRef.current.organisms);
    cameraRef.current.x = c.x;
    cameraRef.current.y = c.y;
  }, [worldRef, cameraRef]);

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

        <label>
          <span className="slider-label">
            Mutation Rate <span className="slider-value">{mutationRate.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min="0.01"
            max="0.5"
            step="0.01"
            value={mutationRate}
            onChange={(e) => handleMutationRate(Number(e.target.value))}
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
        <button onClick={handleCenterView}>Center View</button>
      </div>

      <div className="panel-section">
        <StatsDisplay worldRef={worldRef} />
      </div>

      <SelectedOrganism worldRef={worldRef} selectedIdRef={selectedIdRef} />
    </div>
  );
}

function SelectedOrganism({
  worldRef,
  selectedIdRef,
}: {
  worldRef: React.MutableRefObject<WorldState>;
  selectedIdRef: React.MutableRefObject<number | null>;
}) {
  const [info, setInfo] = useState<{
    id: number;
    energy: number;
    speed: number;
    vision: number;
    metabolism: number;
    aggression: number;
    awareness: number;
    efficiency: number;
    riskTolerance: number;
    state: string;
    generation: number;
    age: number;
    abilities: string[];
  } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = selectedIdRef.current;
      if (id == null) {
        setInfo(null);
        return;
      }
      const org = worldRef.current.organisms.find((o) => o.id === id);
      if (!org) {
        setInfo(null);
        selectedIdRef.current = null;
        return;
      }
      setInfo({
        id: org.id,
        energy: org.energy,
        speed: org.speed,
        vision: org.vision,
        metabolism: org.metabolism,
        aggression: org.aggression,
        awareness: org.awareness,
        efficiency: org.efficiency,
        riskTolerance: org.riskTolerance,
        state: org.state,
        generation: org.generation,
        age: org.age,
        abilities: org.abilities.map((a) => `${a.type}${a.active ? "*" : ""}`),
      });
    }, 250);
    return () => clearInterval(interval);
  }, [worldRef, selectedIdRef]);

  if (!info) return null;

  return (
    <div className="panel-section">
      <div className="stat-divider" />
      <div className="stat-label">Selected #{info.id}</div>
      <div className="stat-row">
        <span>State</span>
        <span>{info.state}</span>
      </div>
      <div className="stat-row">
        <span>Energy</span>
        <span>{info.energy.toFixed(1)}</span>
      </div>
      <div className="stat-row">
        <span>Gen / Age</span>
        <span>
          {info.generation} / {info.age}
        </span>
      </div>
      <div className="stat-row">
        <span>Speed</span>
        <span>{info.speed.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Vision</span>
        <span>{info.vision.toFixed(1)}</span>
      </div>
      <div className="stat-row">
        <span>Aggression</span>
        <span>{info.aggression.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Awareness</span>
        <span>{info.awareness.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Efficiency</span>
        <span>{info.efficiency.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Risk</span>
        <span>{info.riskTolerance.toFixed(2)}</span>
      </div>
      {info.abilities.length > 0 && (
        <div className="stat-row">
          <span>Abilities</span>
          <span>{info.abilities.join(", ")}</span>
        </div>
      )}
    </div>
  );
}
