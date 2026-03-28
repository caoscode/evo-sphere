import type { Food, SimulationConfig, WorldState } from "./types";
import { computeBounds } from "./world";
import { foodDensityAt } from "./terrain";

const FOOD_SPAWN_MARGIN = 500;

function createFood(world: WorldState, config: SimulationConfig): Food | null {
  const bounds = computeBounds(world.organisms, FOOD_SPAWN_MARGIN);
  // Try to place food, weighted by terrain density
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    const density = foodDensityAt(x, y);
    // Accept with probability proportional to density
    if (Math.random() < density) {
      return { x, y, energy: config.foodEnergy };
    }
  }
  // Fallback: always spawn at least sometimes
  const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
  const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
  return { x, y, energy: config.foodEnergy };
}

export function spawnFood(world: WorldState, config: SimulationConfig): void {
  const count = Math.floor(config.foodSpawnRate);
  const frac = config.foodSpawnRate - count;

  for (let i = 0; i < count && world.food.length < config.maxFood; i++) {
    const f = createFood(world, config);
    if (f) world.food.push(f);
  }

  if (frac > 0 && Math.random() < frac && world.food.length < config.maxFood) {
    const f = createFood(world, config);
    if (f) world.food.push(f);
  }
}

export function injectFoodBurst(world: WorldState, config: SimulationConfig, amount: number): void {
  for (let i = 0; i < amount; i++) {
    const f = createFood(world, config);
    if (f) world.food.push(f);
  }
}
