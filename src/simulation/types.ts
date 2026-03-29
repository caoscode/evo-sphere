export type BehaviorState =
  | "FORAGING"
  | "FLEEING"
  | "HUNTING"
  | "FEEDING"
  | "GATHERING"
  | "BUILDING"
  | "DEFENDING"
  | "COOPERATING"
  | "PATROLLING"
  | "INVADING";

export type AbilityType = "burstSpeed" | "energyDrain" | "camouflage" | "areaSense" | "reproSpike";

export type SocietyRole = "farmer" | "builder" | "defender" | "attacker" | "leader" | "none";
export type StructureType = "home" | "storage" | "farm";
export type SocietyStrategy = "expand" | "defend" | "attack" | "consolidate";

export interface SocietyPersonality {
  aggression: number;
  defensiveness: number;
  expansiveness: number;
  economicFocus: number;
}

export interface LeaderDirective {
  type: "rally" | "target" | "scatter" | "idle";
  targetX?: number;
  targetY?: number;
  targetSocietyId?: number;
  issuedTick: number;
}

export interface SocietyEmblem {
  shape: "circle" | "triangle" | "diamond" | "cross" | "star" | "hexagon";
  pattern: "solid" | "striped" | "dotted" | "rings";
  secondaryHue: number;
  borderStyle: "solid" | "dashed" | "double";
}

export interface SocietyHistory {
  foundingMembers: number;
  peakPower: number;
  peakTick: number;
  territorySamples: number[];
  isRising: boolean;
  isFalling: boolean;
}

export interface Structure {
  id: number;
  type: StructureType;
  x: number;
  y: number;
  societyId: number;
  health: number;
  maxHealth: number;
  storedEnergy: number;
  buildProgress: number;
  createdTick: number;
}

export interface Society {
  id: number;
  memberIds: Set<number>;
  foundedTick: number;
  centroidX: number;
  centroidY: number;
  hue: number;
  totalEnergy: number;
  structureIds: Set<number>;
  sharedPool: number;
  territorySize: number;
  territoryValue: number;
  borderCells: number;
  power: number;
  peakTerritorySize: number;
  personality: SocietyPersonality;
  strategy: SocietyStrategy;
  leaderDirective: LeaderDirective;
  leaderId: number | null;
  stabilityScore: number;
  overextensionPenalty: number;
  peakMemberCount: number;
  collapseTimer: number;
  emblem: SocietyEmblem;
  history: SocietyHistory;
  rivalries: Map<number, number>;
}

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
  // Society
  societyId: number | null;
  role: SocietyRole;
  socialAffinity: number;
  proximityTimer: number;
  buildContribution: number;
  independenceCooldown: number;
}

export interface Food {
  x: number;
  y: number;
  energy: number;
}

export interface TerritoryGrid {
  originX: number;
  originY: number;
  cols: number;
  rows: number;
  cellSize: number;
  influence: Map<number, Float32Array>;
  owner: Int16Array;
  contestLevel: Float32Array;
}

export interface WorldState {
  width: number;
  height: number;
  organisms: Organism[];
  food: Food[];
  tick: number;
  nextId: number;
  societies: Society[];
  structures: Structure[];
  nextSocietyId: number;
  nextStructureId: number;
  territoryGrid: TerritoryGrid | null;
  foodSurgeCooldown: number;
  totalSocietiesEver: number;
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
  maxStructures: number;
  societyFormationRadius: number;
  minSocietySize: number;
  structureDecayRate: number;
}
