export interface Organism {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  age: number;
  generation: number;
  speed: number;
  vision: number;
  metabolism: number;
  reproductionThreshold: number;
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
