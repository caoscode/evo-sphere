import type { SimulationConfig } from "./types";

export const DEFAULT_CONFIG: SimulationConfig = {
  worldWidth: 1200,
  worldHeight: 800,
  initialOrganismCount: 30,
  initialFoodCount: 100,
  foodSpawnRate: 0.8,
  foodEnergy: 50,
  energyCostMultiplier: 1.0,
  mutationRate: 0.15,
  maxOrganisms: 500,
  maxFood: 400,
};

// Energy cost coefficients
export const SPEED_COST_FACTOR = 0.15;
export const VISION_COST_FACTOR = 0.01;
export const AGGRESSION_COST_FACTOR = 0.05;
export const AWARENESS_COST_FACTOR = 0.02;

// Organism defaults
export const INITIAL_ENERGY = 100;
export const CONTACT_RADIUS = 6;
export const PREDATION_CONTACT_RADIUS = 8;
export const MAX_TRAIL_LENGTH = 8;

// Ability constants
export const ABILITY_MUTATION_CHANCE = 0.03;
export const MAX_ABILITIES = 2;

// Trait ranges (min, max) for clamping after mutation
export const TRAIT_RANGES = {
  speed: [0.3, 8],
  vision: [10, 200],
  metabolism: [0.05, 2],
  reproductionThreshold: [30, 200],
  aggression: [0, 1],
  awareness: [0, 1],
  efficiency: [0.5, 2.0],
  riskTolerance: [0, 1],
} as const;

// Initial trait values for first generation
export const INITIAL_TRAITS = {
  speed: 2.5,
  vision: 60,
  metabolism: 0.3,
  reproductionThreshold: 80,
  aggression: 0.2,
  awareness: 0.3,
  efficiency: 1.0,
  riskTolerance: 0.5,
};
