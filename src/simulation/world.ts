import type { Organism, SimulationConfig, WorldState } from "./types";
import { createOrganism, updateOrganism } from "./organism";
import { spawnFood, checkFoodSurge, initFoodSurgeCooldown } from "./food";
import { SpatialGrid } from "./spatial-grid";
import { updateSocieties } from "./society";
import { updateStructures } from "./infrastructure";
import { createTerritoryGrid, updateTerritoryGrid, processBorderConflicts } from "./territory";
import { TERRITORY_UPDATE_INTERVAL } from "./config";

const FOOD_SPAWN_MARGIN = 500;

export function createSimulation(config: SimulationConfig): WorldState {
  const world: WorldState = {
    width: config.worldWidth,
    height: config.worldHeight,
    organisms: [],
    food: [],
    tick: 0,
    nextId: 0,
    societies: [],
    structures: [],
    nextSocietyId: 0,
    nextStructureId: 0,
    territoryGrid: null,
    foodSurgeCooldown: initFoodSurgeCooldown(),
    totalSocietiesEver: 0,
  };

  // Spawn initial organisms centered around origin
  for (let i = 0; i < config.initialOrganismCount; i++) {
    const org = createOrganism(
      world.nextId++,
      (Math.random() - 0.5) * config.worldWidth,
      (Math.random() - 0.5) * config.worldHeight,
    );
    // Add initial variation so evolution has something to select from
    org.speed *= 0.7 + Math.random() * 0.6;
    org.vision *= 0.7 + Math.random() * 0.6;
    org.metabolism *= 0.7 + Math.random() * 0.6;
    org.reproductionThreshold *= 0.8 + Math.random() * 0.4;
    org.aggression = Math.random();
    org.awareness = Math.random();
    org.efficiency = 0.5 + Math.random() * 1.5;
    org.riskTolerance = Math.random();
    org.socialAffinity = Math.random();
    world.organisms.push(org);
  }

  // Spawn initial food around the population area
  const bounds = computeBounds(world.organisms, FOOD_SPAWN_MARGIN);
  for (let i = 0; i < config.initialFoodCount; i++) {
    world.food.push({
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
      energy: config.foodEnergy,
    });
  }

  return world;
}

export function computeBounds(
  organisms: Organism[],
  margin: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (organisms.length === 0) {
    return {
      minX: -margin,
      minY: -margin,
      maxX: margin,
      maxY: margin,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const org of organisms) {
    if (org.x < minX) minX = org.x;
    if (org.y < minY) minY = org.y;
    if (org.x > maxX) maxX = org.x;
    if (org.y > maxY) maxY = org.y;
  }
  return {
    minX: minX - margin,
    minY: minY - margin,
    maxX: maxX + margin,
    maxY: maxY + margin,
  };
}

export function computeCentroid(organisms: Organism[]): { x: number; y: number } {
  if (organisms.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const org of organisms) {
    sx += org.x;
    sy += org.y;
  }
  return { x: sx / organisms.length, y: sy / organisms.length };
}

export function step(world: WorldState, config: SimulationConfig): void {
  // Build spatial grid for food
  const cellSize = 80;
  const foodGrid = new SpatialGrid(cellSize);
  for (let i = 0; i < world.food.length; i++) {
    foodGrid.insert(world.food[i].x, world.food[i].y, i);
  }

  // Build spatial grid for organisms (for future interactions)
  const orgGrid = new SpatialGrid(cellSize);
  for (let i = 0; i < world.organisms.length; i++) {
    orgGrid.insert(world.organisms[i].x, world.organisms[i].y, i);
  }

  // Update all organisms
  const deadIndices: number[] = [];
  const deadSet = new Set<number>(); // track killed organism IDs
  const eatenFoodSet = new Set<number>();
  const newOrganisms: Organism[] = [];

  for (let i = 0; i < world.organisms.length; i++) {
    const org = world.organisms[i];
    // Skip organisms killed by predation this tick
    if (deadSet.has(org.id)) {
      deadIndices.push(i);
      continue;
    }

    const result = updateOrganism(org, world.food, foodGrid, world, config, orgGrid, deadSet);

    if (result.dead) {
      deadIndices.push(i);
      deadSet.add(org.id);
    }

    for (const fi of result.eatenFoodIndices) {
      eatenFoodSet.add(fi);
    }

    if (result.offspring) {
      newOrganisms.push(result.offspring);
    }

    // Mark killed organisms for removal
    for (const killedId of result.killedOrganismIds) {
      for (let j = 0; j < world.organisms.length; j++) {
        if (world.organisms[j].id === killedId && !deadIndices.includes(j)) {
          deadIndices.push(j);
        }
      }
    }
  }

  // Remove dead organisms (swap-and-pop, reverse order, deduplicated)
  const uniqueDeadIndices = [...new Set(deadIndices)].sort((a, b) => b - a);
  for (const i of uniqueDeadIndices) {
    world.organisms[i] = world.organisms[world.organisms.length - 1];
    world.organisms.pop();
  }

  // Remove eaten food (swap-and-pop, reverse order)
  const eatenIndices = Array.from(eatenFoodSet).sort((a, b) => b - a);
  for (const i of eatenIndices) {
    world.food[i] = world.food[world.food.length - 1];
    world.food.pop();
  }

  // Add offspring
  for (const org of newOrganisms) {
    if (world.organisms.length < config.maxOrganisms) {
      world.organisms.push(org);
    }
  }

  // Rebuild organism grid after removals and additions
  orgGrid.clear();
  for (let i = 0; i < world.organisms.length; i++) {
    orgGrid.insert(world.organisms[i].x, world.organisms[i].y, i);
  }

  // Carrying capacity pressure — local density drains energy
  applyDensityPressure(world, orgGrid);

  // Update societies (formation, roles, cooperation)
  updateSocieties(world, config, orgGrid);

  // Update territory grid
  if (world.societies.length > 0) {
    if (!world.territoryGrid) {
      world.territoryGrid = createTerritoryGrid(world);
    }
    if (world.tick % TERRITORY_UPDATE_INTERVAL === 0) {
      updateTerritoryGrid(world.territoryGrid, world);
    }
    processBorderConflicts(world, orgGrid);
  } else if (world.territoryGrid) {
    world.territoryGrid = null;
  }

  // Update structures (building, decay, farm food)
  updateStructures(world, config);

  // Spawn new food around population
  spawnFood(world, config);

  // Check for food surge events
  checkFoodSurge(world, config);

  // Rescue spawn — prevent total extinction
  if (world.organisms.length < 10 && world.organisms.length > 0) {
    const centroid = computeCentroid(world.organisms);
    for (let i = world.organisms.length; i < 15; i++) {
      const org = createOrganism(
        world.nextId++,
        centroid.x + (Math.random() - 0.5) * 200,
        centroid.y + (Math.random() - 0.5) * 200,
      );
      org.aggression = Math.random();
      org.awareness = Math.random();
      org.efficiency = 0.5 + Math.random() * 1.5;
      org.riskTolerance = Math.random();
      org.socialAffinity = Math.random();
      world.organisms.push(org);
    }
  }

  world.tick++;
}

const DENSITY_PRESSURE_RADIUS = 60;
const DENSITY_PRESSURE_THRESHOLD = 8;
const DENSITY_PRESSURE_COST = 0.3;

function applyDensityPressure(world: WorldState, orgGrid: SpatialGrid): void {
  for (const org of world.organisms) {
    const nearby = orgGrid.query(org.x, org.y, DENSITY_PRESSURE_RADIUS);
    // Subtract self
    const neighborCount = nearby.length - 1;
    if (neighborCount > DENSITY_PRESSURE_THRESHOLD) {
      const excess = neighborCount - DENSITY_PRESSURE_THRESHOLD;
      // Same-society neighbors cost half (cooperation advantage)
      if (org.societyId !== null) {
        let sameCount = 0;
        for (const idx of nearby) {
          const other = world.organisms[idx];
          if (other.id !== org.id && other.societyId === org.societyId) sameCount++;
        }
        const otherExcess = Math.max(0, neighborCount - sameCount - DENSITY_PRESSURE_THRESHOLD);
        const sameExcess = excess - otherExcess;
        org.energy -= otherExcess * DENSITY_PRESSURE_COST + Math.max(0, sameExcess) * 0.15;
      } else {
        org.energy -= excess * DENSITY_PRESSURE_COST;
      }
    }
  }
}

export function killPortion(world: WorldState, fraction: number): void {
  const killCount = Math.floor(world.organisms.length * fraction);
  for (let i = 0; i < killCount; i++) {
    const idx = Math.floor(Math.random() * world.organisms.length);
    world.organisms[idx] = world.organisms[world.organisms.length - 1];
    world.organisms.pop();
  }
}
