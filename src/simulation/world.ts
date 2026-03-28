import type { Organism, SimulationConfig, WorldState } from "./types";
import { createOrganism, updateOrganism } from "./organism";
import { spawnFood } from "./food";
import { SpatialGrid } from "./spatial-grid";

export function createSimulation(config: SimulationConfig): WorldState {
  const world: WorldState = {
    width: config.worldWidth,
    height: config.worldHeight,
    organisms: [],
    food: [],
    tick: 0,
    nextId: 0,
  };

  // Spawn initial organisms with slight trait variation
  for (let i = 0; i < config.initialOrganismCount; i++) {
    const org = createOrganism(
      world.nextId++,
      Math.random() * config.worldWidth,
      Math.random() * config.worldHeight,
    );
    // Add initial variation so evolution has something to select from
    org.speed *= 0.7 + Math.random() * 0.6;
    org.vision *= 0.7 + Math.random() * 0.6;
    org.metabolism *= 0.7 + Math.random() * 0.6;
    org.reproductionThreshold *= 0.8 + Math.random() * 0.4;
    world.organisms.push(org);
  }

  // Spawn initial food
  for (let i = 0; i < config.initialFoodCount; i++) {
    world.food.push({
      x: Math.random() * config.worldWidth,
      y: Math.random() * config.worldHeight,
      energy: config.foodEnergy,
    });
  }

  return world;
}

export function step(world: WorldState, config: SimulationConfig): void {
  // Build spatial grid for food
  const cellSize = 80;
  const foodGrid = new SpatialGrid(world.width, world.height, cellSize);
  for (let i = 0; i < world.food.length; i++) {
    foodGrid.insert(world.food[i].x, world.food[i].y, i);
  }

  // Update all organisms
  const deadIndices: number[] = [];
  const eatenFoodSet = new Set<number>();
  const newOrganisms: Organism[] = [];

  for (let i = 0; i < world.organisms.length; i++) {
    const result = updateOrganism(world.organisms[i], world.food, foodGrid, world, config);

    if (result.dead) {
      deadIndices.push(i);
    }

    for (const fi of result.eatenFoodIndices) {
      eatenFoodSet.add(fi);
    }

    if (result.offspring) {
      newOrganisms.push(result.offspring);
    }
  }

  // Remove dead organisms (swap-and-pop, reverse order)
  deadIndices.sort((a, b) => b - a);
  for (const i of deadIndices) {
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

  // Spawn new food
  spawnFood(world, config);

  world.tick++;
}

export function killPortion(world: WorldState, fraction: number): void {
  const killCount = Math.floor(world.organisms.length * fraction);
  for (let i = 0; i < killCount; i++) {
    const idx = Math.floor(Math.random() * world.organisms.length);
    world.organisms[idx] = world.organisms[world.organisms.length - 1];
    world.organisms.pop();
  }
}
