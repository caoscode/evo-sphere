import type { SimulationConfig } from "./types";

export const DEFAULT_CONFIG: SimulationConfig = {
  worldWidth: 1200,
  worldHeight: 800,
  initialOrganismCount: 30,
  initialFoodCount: 100,
  foodSpawnRate: 0.8,
  foodEnergy: 30,
  energyCostMultiplier: 1.0,
  mutationRate: 0.15,
  maxOrganisms: 500,
  maxFood: 400,
};

// Energy cost coefficients
export const SPEED_COST_FACTOR = 0.4;
export const VISION_COST_FACTOR = 0.08;

// Organism defaults
export const INITIAL_ENERGY = 50;
export const CONTACT_RADIUS = 6;
export const MAX_TRAIL_LENGTH = 8;

// Trait ranges (min, max) for clamping after mutation
export const TRAIT_RANGES = {
  speed: [0.3, 8],
  vision: [10, 200],
  metabolism: [0.05, 2],
  reproductionThreshold: [30, 200],
} as const;

// Initial trait values for first generation
export const INITIAL_TRAITS = {
  speed: 2.5,
  vision: 60,
  metabolism: 0.3,
  reproductionThreshold: 80,
};
