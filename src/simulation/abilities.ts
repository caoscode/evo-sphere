import type { Ability, AbilityType, Food, Organism } from "./types";
import { ABILITY_MUTATION_CHANCE, MAX_ABILITIES } from "./config";
import { distSq } from "./spatial-grid";

const ABILITY_DEFS: Record<
  AbilityType,
  { cooldownMax: number; activeDuration: number; energyCost: number }
> = {
  burstSpeed: { cooldownMax: 120, activeDuration: 10, energyCost: 8 },
  energyDrain: { cooldownMax: 60, activeDuration: 15, energyCost: 5 },
  camouflage: { cooldownMax: 200, activeDuration: 50, energyCost: 3 },
  areaSense: { cooldownMax: 0, activeDuration: Infinity, energyCost: 0 },
  reproSpike: { cooldownMax: 500, activeDuration: 1, energyCost: 0 },
};

const ALL_ABILITY_TYPES: AbilityType[] = [
  "burstSpeed",
  "energyDrain",
  "camouflage",
  "areaSense",
  "reproSpike",
];

export function createAbility(type: AbilityType): Ability {
  const def = ABILITY_DEFS[type];
  return {
    type,
    cooldownTimer: 0,
    cooldownMax: def.cooldownMax,
    active: type === "areaSense", // areaSense is always active
    activeTimer: type === "areaSense" ? Infinity : 0,
    activeDuration: def.activeDuration,
  };
}

export function tickAbilities(abilities: Ability[]): void {
  for (const a of abilities) {
    if (a.type === "areaSense") continue; // always active, no timers
    if (a.active) {
      a.activeTimer--;
      if (a.activeTimer <= 0) {
        a.active = false;
        a.cooldownTimer = a.cooldownMax;
      }
    } else if (a.cooldownTimer > 0) {
      a.cooldownTimer--;
    }
  }
}

export function tryActivateAbilities(
  abilities: Ability[],
  org: Organism,
  nearbyOrgs: { org: Organism; dSq: number }[],
  _nearbyFood: Food[],
): void {
  for (const a of abilities) {
    if (a.active || a.cooldownTimer > 0) continue;

    const def = ABILITY_DEFS[a.type];

    switch (a.type) {
      case "burstSpeed": {
        // Activate when fleeing or hunting and target/threat is nearby
        if (org.state === "FLEEING" || org.state === "HUNTING") {
          const hasClose = nearbyOrgs.some((n) => n.dSq < org.vision * org.vision * 0.25);
          if (hasClose && org.energy > def.energyCost * 2) {
            a.active = true;
            a.activeTimer = a.activeDuration;
            org.energy -= def.energyCost;
          }
        }
        break;
      }
      case "energyDrain": {
        // Activate when close to another organism
        const drainRange = 16 * 16; // 2x predation radius squared
        const hasTarget = nearbyOrgs.some((n) => n.dSq < drainRange);
        if (hasTarget && org.energy > def.energyCost * 2) {
          a.active = true;
          a.activeTimer = a.activeDuration;
          org.energy -= def.energyCost;
        }
        break;
      }
      case "camouflage": {
        // Activate when a high-aggression organism is in vision range
        const hasPredator = nearbyOrgs.some(
          (n) => n.org.aggression > 0.5 && n.org.energy > org.energy,
        );
        if (hasPredator && org.energy > def.energyCost * 2) {
          a.active = true;
          a.activeTimer = a.activeDuration;
          org.energy -= def.energyCost;
        }
        break;
      }
      case "reproSpike": {
        // 5% chance per tick to activate
        if (Math.random() < 0.05) {
          a.active = true;
          a.activeTimer = a.activeDuration;
        }
        break;
      }
      // areaSense is always active, handled separately
    }
  }
}

export interface AbilityModifiers {
  speedMultiplier: number;
  detectionReduction: number; // 0-1, how much harder to detect (0 = normal, 0.6 = 60% harder)
  reproThresholdMultiplier: number;
}

export function computeAbilityModifiers(abilities: Ability[]): AbilityModifiers {
  const mods: AbilityModifiers = {
    speedMultiplier: 1,
    detectionReduction: 0,
    reproThresholdMultiplier: 1,
  };

  for (const a of abilities) {
    if (!a.active) continue;
    switch (a.type) {
      case "burstSpeed":
        mods.speedMultiplier = 2.0;
        break;
      case "camouflage":
        mods.detectionReduction = 0.6;
        break;
      case "reproSpike":
        mods.reproThresholdMultiplier = 0.6;
        break;
    }
  }

  return mods;
}

export function applyEnergyDrain(
  org: Organism,
  nearbyOrgs: { org: Organism; dSq: number }[],
): void {
  const drainAbility = org.abilities.find((a) => a.type === "energyDrain" && a.active);
  if (!drainAbility) return;

  const drainRange = 16 * 16;
  let closest: Organism | null = null;
  let closestDSq = Infinity;
  for (const { org: other, dSq: d } of nearbyOrgs) {
    if (d < drainRange && d < closestDSq) {
      closestDSq = d;
      closest = other;
    }
  }

  if (closest) {
    const drainAmount = Math.min(2, closest.energy * 0.1);
    closest.energy -= drainAmount;
    org.energy += drainAmount;
  }
}

export function findDensestFoodCluster(
  org: Organism,
  food: Food[],
  candidates: number[],
): { x: number; y: number } | null {
  if (candidates.length === 0) return null;

  // Divide vision into quadrants and find the one with the most food
  let bestX = 0;
  let bestY = 0;
  let bestCount = 0;

  // Sample 4 directions — pick the direction with most food
  const visionSq = org.vision * org.vision;
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (const dir of dirs) {
    let count = 0;
    let sx = 0;
    let sy = 0;
    for (const idx of candidates) {
      const f = food[idx];
      const dx = f.x - org.x;
      const dy = f.y - org.y;
      if (distSq(org.x, org.y, f.x, f.y) > visionSq) continue;
      // Is food in this direction's half?
      if (dx * dir.x + dy * dir.y > 0) {
        count++;
        sx += f.x;
        sy += f.y;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestX = sx / count;
      bestY = sy / count;
    }
  }

  if (bestCount === 0) return null;
  return { x: bestX, y: bestY };
}

export function mutateAbilities(parentAbilities: Ability[]): Ability[] {
  const abilities = parentAbilities.map((a) => createAbility(a.type));

  // Chance to lose an ability
  if (abilities.length > 0 && Math.random() < ABILITY_MUTATION_CHANCE) {
    abilities.splice(Math.floor(Math.random() * abilities.length), 1);
  }

  // Chance to gain a new ability
  if (abilities.length < MAX_ABILITIES && Math.random() < ABILITY_MUTATION_CHANCE) {
    const existingTypes = new Set(abilities.map((a) => a.type));
    const available = ALL_ABILITY_TYPES.filter((t) => !existingTypes.has(t));
    if (available.length > 0) {
      abilities.push(createAbility(available[Math.floor(Math.random() * available.length)]));
    }
  }

  return abilities;
}
