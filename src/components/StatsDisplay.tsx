import { useEffect, useState } from "react";
import type { WorldState } from "../simulation/types";

interface Stats {
  population: number;
  food: number;
  tick: number;
  avgSpeed: number;
  avgVision: number;
  avgMetabolism: number;
  avgReproduction: number;
  maxGeneration: number;
}

interface StatsDisplayProps {
  worldRef: React.RefObject<WorldState>;
}

function computeStats(world: WorldState): Stats {
  const orgs = world.organisms;
  const n = orgs.length;
  if (n === 0) {
    return {
      population: 0,
      food: world.food.length,
      tick: world.tick,
      avgSpeed: 0,
      avgVision: 0,
      avgMetabolism: 0,
      avgReproduction: 0,
      maxGeneration: 0,
    };
  }

  let totalSpeed = 0;
  let totalVision = 0;
  let totalMetabolism = 0;
  let totalReproduction = 0;
  let maxGen = 0;

  for (const org of orgs) {
    totalSpeed += org.speed;
    totalVision += org.vision;
    totalMetabolism += org.metabolism;
    totalReproduction += org.reproductionThreshold;
    if (org.generation > maxGen) maxGen = org.generation;
  }

  return {
    population: n,
    food: world.food.length,
    tick: world.tick,
    avgSpeed: totalSpeed / n,
    avgVision: totalVision / n,
    avgMetabolism: totalMetabolism / n,
    avgReproduction: totalReproduction / n,
    maxGeneration: maxGen,
  };
}

export function StatsDisplay({ worldRef }: StatsDisplayProps) {
  const [stats, setStats] = useState<Stats>({
    population: 0,
    food: 0,
    tick: 0,
    avgSpeed: 0,
    avgVision: 0,
    avgMetabolism: 0,
    avgReproduction: 0,
    maxGeneration: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (worldRef.current) {
        setStats(computeStats(worldRef.current));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [worldRef]);

  return (
    <div className="stats">
      <div className="stat-row">
        <span>Population</span>
        <span>{stats.population}</span>
      </div>
      <div className="stat-row">
        <span>Food</span>
        <span>{stats.food}</span>
      </div>
      <div className="stat-row">
        <span>Tick</span>
        <span>{stats.tick}</span>
      </div>
      <div className="stat-row">
        <span>Generation</span>
        <span>{stats.maxGeneration}</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-label">Average Traits</div>
      <div className="stat-row">
        <span>Speed</span>
        <span>{stats.avgSpeed.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Vision</span>
        <span>{stats.avgVision.toFixed(1)}</span>
      </div>
      <div className="stat-row">
        <span>Metabolism</span>
        <span>{stats.avgMetabolism.toFixed(3)}</span>
      </div>
      <div className="stat-row">
        <span>Repro. Threshold</span>
        <span>{stats.avgReproduction.toFixed(1)}</span>
      </div>
    </div>
  );
}
