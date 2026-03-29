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
  maxStructures: 100,
  societyFormationRadius: 120,
  minSocietySize: 3,
  structureDecayRate: 0.02,
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
  socialAffinity: [0, 1],
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
  socialAffinity: 0.5,
};

// Society constants
export const SOCIETY_JOIN_TICKS = 10;
export const SOCIETY_FORM_TICKS = 15;
export const SOCIETY_LEAVE_DISTANCE = 200;
export const MAX_SOCIETY_SIZE = 30;

// Territory constants
export const TERRITORY_CELL_SIZE = 40;
export const TERRITORY_UPDATE_INTERVAL = 10;
export const INFLUENCE_MEMBER_BASE = 1.0;
export const INFLUENCE_STRUCTURE_HOME = 3.0;
export const INFLUENCE_STRUCTURE_STORAGE = 2.0;
export const INFLUENCE_STRUCTURE_FARM = 2.5;
export const INFLUENCE_DECAY_RATE = 0.15;
export const INFLUENCE_CLAIM_THRESHOLD = 0.3;
export const INFLUENCE_CONTEST_RATIO = 0.6;
export const TERRITORY_ENERGY_PENALTY = 0.1;
export const BORDER_SKIRMISH_RANGE = 60;

// Food surge constants
export const FOOD_SURGE_MIN_INTERVAL = 500;
export const FOOD_SURGE_MAX_INTERVAL = 1500;
export const FOOD_SURGE_AMOUNT_MIN = 30;
export const FOOD_SURGE_AMOUNT_MAX = 80;
export const FOOD_SURGE_ENERGY_MULT = 1.5;
export const FOOD_SURGE_RADIUS = 150;

// Farm enhancement constants
export const FARM_MATURITY_TICKS = 200;
export const FARM_FARMER_BONUS = 0.1;
export const FARM_MAX_RATE = 1.2;

// Overextension constants
export const OVEREXTENSION_THRESHOLD = 0.1;

// Collapse constants
export const COLLAPSE_STABILITY_THRESHOLD = 0.3;
export const COLLAPSE_TIMER_LIMIT = 50;
export const COLLAPSE_MIN_AGE = 200;
export const INDEPENDENCE_COOLDOWN_TICKS = 50;

// War zone constants
export const WAR_ZONE_CONTEST_THRESHOLD = 0.8;
export const WAR_ZONE_FOOD_REJECT_CHANCE = 0.5;
export const WAR_ZONE_REFUGEE_CHANCE = 0.01;
