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
  avgAggression: number;
  avgAwareness: number;
  avgEfficiency: number;
  avgRiskTolerance: number;
  maxGeneration: number;
  hunters: number;
  fleeing: number;
  withAbilities: number;
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
      avgAggression: 0,
      avgAwareness: 0,
      avgEfficiency: 0,
      avgRiskTolerance: 0,
      maxGeneration: 0,
      hunters: 0,
      fleeing: 0,
      withAbilities: 0,
    };
  }

  let totalSpeed = 0;
  let totalVision = 0;
  let totalMetabolism = 0;
  let totalReproduction = 0;
  let totalAggression = 0;
  let totalAwareness = 0;
  let totalEfficiency = 0;
  let totalRiskTolerance = 0;
  let maxGen = 0;
  let hunters = 0;
  let fleeing = 0;
  let withAbilities = 0;

  for (const org of orgs) {
    totalSpeed += org.speed;
    totalVision += org.vision;
    totalMetabolism += org.metabolism;
    totalReproduction += org.reproductionThreshold;
    totalAggression += org.aggression;
    totalAwareness += org.awareness;
    totalEfficiency += org.efficiency;
    totalRiskTolerance += org.riskTolerance;
    if (org.generation > maxGen) maxGen = org.generation;
    if (org.state === "HUNTING") hunters++;
    if (org.state === "FLEEING") fleeing++;
    if (org.abilities.length > 0) withAbilities++;
  }

  return {
    population: n,
    food: world.food.length,
    tick: world.tick,
    avgSpeed: totalSpeed / n,
    avgVision: totalVision / n,
    avgMetabolism: totalMetabolism / n,
    avgReproduction: totalReproduction / n,
    avgAggression: totalAggression / n,
    avgAwareness: totalAwareness / n,
    avgEfficiency: totalEfficiency / n,
    avgRiskTolerance: totalRiskTolerance / n,
    maxGeneration: maxGen,
    hunters,
    fleeing,
    withAbilities,
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
    avgAggression: 0,
    avgAwareness: 0,
    avgEfficiency: 0,
    avgRiskTolerance: 0,
    maxGeneration: 0,
    hunters: 0,
    fleeing: 0,
    withAbilities: 0,
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
      <div className="stat-divider" />
      <div className="stat-label">Behavioral Traits</div>
      <div className="stat-row">
        <span>Aggression</span>
        <span>{stats.avgAggression.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Awareness</span>
        <span>{stats.avgAwareness.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Efficiency</span>
        <span>{stats.avgEfficiency.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Risk Tolerance</span>
        <span>{stats.avgRiskTolerance.toFixed(2)}</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-label">Activity</div>
      <div className="stat-row">
        <span>Hunters</span>
        <span>{stats.hunters}</span>
      </div>
      <div className="stat-row">
        <span>Fleeing</span>
        <span>{stats.fleeing}</span>
      </div>
      <div className="stat-row">
        <span>With Abilities</span>
        <span>{stats.withAbilities}</span>
      </div>
    </div>
  );
}
