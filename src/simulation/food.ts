import type { Food, SimulationConfig, WorldState } from "./types";
import { computeBounds } from "./world";
import { foodDensityAt } from "./terrain";
import {
  FOOD_SURGE_MIN_INTERVAL,
  FOOD_SURGE_MAX_INTERVAL,
  FOOD_SURGE_AMOUNT_MIN,
  FOOD_SURGE_AMOUNT_MAX,
  FOOD_SURGE_ENERGY_MULT,
  FOOD_SURGE_RADIUS,
  WAR_ZONE_CONTEST_THRESHOLD,
  WAR_ZONE_FOOD_REJECT_CHANCE,
} from "./config";

const FOOD_SPAWN_MARGIN = 500;

function isInWarZone(world: WorldState, x: number, y: number): boolean {
  const grid = world.territoryGrid;
  if (!grid) return false;
  const col = Math.floor((x - grid.originX) / grid.cellSize);
  const row = Math.floor((y - grid.originY) / grid.cellSize);
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return false;
  return grid.contestLevel[row * grid.cols + col] >= WAR_ZONE_CONTEST_THRESHOLD;
}

function createFood(world: WorldState, config: SimulationConfig): Food | null {
  const bounds = computeBounds(world.organisms, FOOD_SPAWN_MARGIN);
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    const density = foodDensityAt(x, y);
    if (Math.random() < density) {
      // War zone food suppression
      if (isInWarZone(world, x, y) && Math.random() < WAR_ZONE_FOOD_REJECT_CHANCE) {
        continue;
      }
      return { x, y, energy: config.foodEnergy };
    }
  }
  // Fallback
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

// --- Food Surge System ---

function randomSurgeInterval(): number {
  return (
    FOOD_SURGE_MIN_INTERVAL +
    Math.floor(Math.random() * (FOOD_SURGE_MAX_INTERVAL - FOOD_SURGE_MIN_INTERVAL))
  );
}

export function checkFoodSurge(world: WorldState, config: SimulationConfig): void {
  world.foodSurgeCooldown--;
  if (world.foodSurgeCooldown > 0) return;

  // Spawn a concentrated burst of food
  const amount =
    FOOD_SURGE_AMOUNT_MIN +
    Math.floor(Math.random() * (FOOD_SURGE_AMOUNT_MAX - FOOD_SURGE_AMOUNT_MIN));

  // Pick a random location near the population
  const bounds = computeBounds(world.organisms, 200);
  const cx = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
  const cy = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);

  const surgeEnergy = config.foodEnergy * FOOD_SURGE_ENERGY_MULT;

  for (let i = 0; i < amount && world.food.length < config.maxFood + amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * FOOD_SURGE_RADIUS;
    world.food.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      energy: surgeEnergy,
    });
  }

  // Reset cooldown
  world.foodSurgeCooldown = randomSurgeInterval();
}

export function initFoodSurgeCooldown(): number {
  return randomSurgeInterval();
}
