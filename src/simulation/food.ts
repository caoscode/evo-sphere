import type { Food, SimulationConfig, WorldState } from "./types";

function createFood(config: SimulationConfig): Food {
  return {
    x: Math.random() * config.worldWidth,
    y: Math.random() * config.worldHeight,
    energy: config.foodEnergy,
  };
}

export function spawnFood(world: WorldState, config: SimulationConfig): void {
  // Fractional spawn rate: accumulate and spawn when >= 1
  // Use a simple probabilistic approach
  const count = Math.floor(config.foodSpawnRate);
  const frac = config.foodSpawnRate - count;

  for (let i = 0; i < count && world.food.length < config.maxFood; i++) {
    world.food.push(createFood(config));
  }

  if (frac > 0 && Math.random() < frac && world.food.length < config.maxFood) {
    world.food.push(createFood(config));
  }
}

export function injectFoodBurst(world: WorldState, config: SimulationConfig, amount: number): void {
  for (let i = 0; i < amount && world.food.length < config.maxFood; i++) {
    world.food.push(createFood(config));
  }
}
