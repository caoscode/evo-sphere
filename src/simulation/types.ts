export type BehaviorState = "FORAGING" | "FLEEING" | "HUNTING" | "FEEDING";

export type AbilityType = "burstSpeed" | "energyDrain" | "camouflage" | "areaSense" | "reproSpike";

export interface Ability {
  type: AbilityType;
  cooldownTimer: number;
  cooldownMax: number;
  active: boolean;
  activeTimer: number;
  activeDuration: number;
}

export interface Organism {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  age: number;
  generation: number;
  // Core traits
  speed: number;
  vision: number;
  metabolism: number;
  reproductionThreshold: number;
  // Behavioral traits
  aggression: number;
  awareness: number;
  efficiency: number;
  riskTolerance: number;
  // State machine
  state: BehaviorState;
  // Abilities (0-2 slots)
  abilities: Ability[];
  trail: Array<{ x: number; y: number }>;
}

export interface Food {
  x: number;
  y: number;
  energy: number;
}

export interface WorldState {
  width: number;
  height: number;
  organisms: Organism[];
  food: Food[];
  tick: number;
  nextId: number;
}

export interface SimulationConfig {
  worldWidth: number;
  worldHeight: number;
  initialOrganismCount: number;
  initialFoodCount: number;
  foodSpawnRate: number;
  foodEnergy: number;
  energyCostMultiplier: number;
  mutationRate: number;
  maxOrganisms: number;
  maxFood: number;
}
