import type { Food, Organism, SimulationConfig, WorldState } from "./types";
import {
  CONTACT_RADIUS,
  INITIAL_ENERGY,
  INITIAL_TRAITS,
  MAX_TRAIL_LENGTH,
  SPEED_COST_FACTOR,
  TRAIT_RANGES,
  VISION_COST_FACTOR,
} from "./config";
import { type SpatialGrid, wrapDirection, wrapDistSq } from "./spatial-grid";

export function createOrganism(
  id: number,
  x: number,
  y: number,
  traits?: Partial<Pick<Organism, "speed" | "vision" | "metabolism" | "reproductionThreshold">>,
  generation = 0,
): Organism {
  const angle = Math.random() * Math.PI * 2;
  return {
    id,
    x,
    y,
    vx: Math.cos(angle),
    vy: Math.sin(angle),
    energy: INITIAL_ENERGY,
    age: 0,
    generation,
    speed: traits?.speed ?? INITIAL_TRAITS.speed,
    vision: traits?.vision ?? INITIAL_TRAITS.vision,
    metabolism: traits?.metabolism ?? INITIAL_TRAITS.metabolism,
    reproductionThreshold: traits?.reproductionThreshold ?? INITIAL_TRAITS.reproductionThreshold,
    trail: [],
  };
}

export function updateOrganism(
  organism: Organism,
  food: Food[],
  foodGrid: SpatialGrid,
  world: WorldState,
  config: SimulationConfig,
): { eatenFoodIndices: number[]; offspring: Organism | null; dead: boolean } {
  const eatenFoodIndices: number[] = [];
  let offspring: Organism | null = null;

  // Record trail position
  organism.trail.push({ x: organism.x, y: organism.y });
  if (organism.trail.length > MAX_TRAIL_LENGTH) {
    organism.trail.shift();
  }

  // 1. Sense: find nearest food within vision
  const candidateIndices = foodGrid.query(organism.x, organism.y, organism.vision);
  let nearestDistSq = Infinity;
  let nearestFood: Food | null = null;

  for (const idx of candidateIndices) {
    const f = food[idx];
    const distSq = wrapDistSq(organism.x, organism.y, f.x, f.y, world.width, world.height);
    if (distSq < organism.vision * organism.vision && distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestFood = f;
    }
  }

  // 2. Move: steer toward food or wander
  if (nearestFood) {
    const dx = wrapDirection(organism.x, nearestFood.x, world.width);
    const dy = wrapDirection(organism.y, nearestFood.y, world.height);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      organism.vx = dx / dist;
      organism.vy = dy / dist;
    }
  } else {
    // Wander: slightly adjust heading
    const wanderAngle = (Math.random() - 0.5) * 0.6;
    const cos = Math.cos(wanderAngle);
    const sin = Math.sin(wanderAngle);
    const nvx = organism.vx * cos - organism.vy * sin;
    const nvy = organism.vx * sin + organism.vy * cos;
    organism.vx = nvx;
    organism.vy = nvy;
  }

  // Normalize and apply speed
  const vLen = Math.sqrt(organism.vx * organism.vx + organism.vy * organism.vy);
  if (vLen > 0) {
    organism.vx = (organism.vx / vLen) * organism.speed;
    organism.vy = (organism.vy / vLen) * organism.speed;
  }

  organism.x = (((organism.x + organism.vx) % world.width) + world.width) % world.width;
  organism.y = (((organism.y + organism.vy) % world.height) + world.height) % world.height;

  // 3. Metabolize
  const cost =
    (organism.metabolism +
      organism.speed * SPEED_COST_FACTOR +
      organism.vision * VISION_COST_FACTOR) *
    config.energyCostMultiplier;
  organism.energy -= cost;

  // 4. Eat: check contact with food
  for (const idx of candidateIndices) {
    const f = food[idx];
    const distSq = wrapDistSq(organism.x, organism.y, f.x, f.y, world.width, world.height);
    if (distSq < CONTACT_RADIUS * CONTACT_RADIUS) {
      organism.energy += f.energy;
      eatenFoodIndices.push(idx);
    }
  }

  // 5. Reproduce
  if (
    organism.energy >= organism.reproductionThreshold &&
    world.organisms.length < config.maxOrganisms
  ) {
    organism.energy *= 0.5;
    offspring = createOffspring(organism, world);
  }

  // 6. Age and death check
  organism.age++;
  const dead = organism.energy <= 0;

  return { eatenFoodIndices, offspring, dead };
}

function mutateTrait(value: number, mutationRate: number, min: number, max: number): number {
  const mutated = value * (1 + (Math.random() * 2 - 1) * mutationRate);
  return Math.max(min, Math.min(max, mutated));
}

function createOffspring(parent: Organism, world: WorldState): Organism {
  const id = world.nextId++;
  // Slight position offset
  const offsetAngle = Math.random() * Math.PI * 2;
  const x = (((parent.x + Math.cos(offsetAngle) * 10) % world.width) + world.width) % world.width;
  const y =
    (((parent.y + Math.sin(offsetAngle) * 10) % world.height) + world.height) % world.height;

  const mr = 0.15; // mutation rate
  const org = createOrganism(
    id,
    x,
    y,
    {
      speed: mutateTrait(parent.speed, mr, ...TRAIT_RANGES.speed),
      vision: mutateTrait(parent.vision, mr, ...TRAIT_RANGES.vision),
      metabolism: mutateTrait(parent.metabolism, mr, ...TRAIT_RANGES.metabolism),
      reproductionThreshold: mutateTrait(
        parent.reproductionThreshold,
        mr,
        ...TRAIT_RANGES.reproductionThreshold,
      ),
    },
    parent.generation + 1,
  );
  org.energy = parent.energy; // parent already halved its energy
  return org;
}
