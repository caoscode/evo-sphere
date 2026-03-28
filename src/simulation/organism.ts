import type {
  BehaviorState,
  Food,
  Organism,
  SimulationConfig,
  Structure,
  WorldState,
} from "./types";
import {
  AGGRESSION_COST_FACTOR,
  AWARENESS_COST_FACTOR,
  CONTACT_RADIUS,
  INITIAL_ENERGY,
  INITIAL_TRAITS,
  MAX_TRAIL_LENGTH,
  PREDATION_CONTACT_RADIUS,
  SPEED_COST_FACTOR,
  TRAIT_RANGES,
  VISION_COST_FACTOR,
} from "./config";
import { type SpatialGrid, direction, distSq } from "./spatial-grid";
import {
  applyEnergyDrain,
  computeAbilityModifiers,
  findDensestFoodCluster,
  mutateAbilities,
  tickAbilities,
  tryActivateAbilities,
} from "./abilities";

type TraitKeys =
  | "speed"
  | "vision"
  | "metabolism"
  | "reproductionThreshold"
  | "aggression"
  | "awareness"
  | "efficiency"
  | "riskTolerance"
  | "socialAffinity";

export interface UpdateResult {
  eatenFoodIndices: number[];
  offspring: Organism | null;
  dead: boolean;
  killedOrganismIds: number[];
}

export function createOrganism(
  id: number,
  x: number,
  y: number,
  traits?: Partial<Pick<Organism, TraitKeys>>,
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
    aggression: traits?.aggression ?? INITIAL_TRAITS.aggression,
    awareness: traits?.awareness ?? INITIAL_TRAITS.awareness,
    efficiency: traits?.efficiency ?? INITIAL_TRAITS.efficiency,
    riskTolerance: traits?.riskTolerance ?? INITIAL_TRAITS.riskTolerance,
    state: "FORAGING",
    abilities: [],
    trail: [],
    societyId: null,
    role: "none",
    socialAffinity: traits?.socialAffinity ?? INITIAL_TRAITS.socialAffinity,
    proximityTimer: 0,
    buildContribution: 0,
  };
}

// --- State evaluation ---

interface SocietyContext {
  centroidX: number;
  centroidY: number;
  buildSite: { x: number; y: number } | null;
  defenderCount: number;
}

function findNearestThreat(
  organism: Organism,
  nearbyOrgs: { org: Organism; dSq: number }[],
): { x: number; y: number; dSq: number } | null {
  const awarenessRange = organism.vision * organism.awareness;
  const awarenessRangeSq = awarenessRange * awarenessRange;
  let closest: { x: number; y: number; dSq: number } | null = null;
  for (const { org: other, dSq: d } of nearbyOrgs) {
    if (
      other.aggression > 0.5 &&
      other.energy > organism.energy &&
      other.societyId !== organism.societyId &&
      d < awarenessRangeSq &&
      (closest === null || d < closest.dSq)
    ) {
      closest = { x: other.x, y: other.y, dSq: d };
    }
  }
  return closest;
}

function evaluateState(
  organism: Organism,
  nearbyOrgs: { org: Organism; dSq: number }[],
  nearestFood: Food | null,
  societyCtx: SocietyContext | null,
): BehaviorState {
  const threat = findNearestThreat(organism, nearbyOrgs);
  const hasThreat = threat !== null;

  // FLEEING takes highest priority if not very risk-tolerant
  if (hasThreat && organism.riskTolerance < 0.7) {
    return "FLEEING";
  }

  // Society role overrides (only when in a society and not fleeing)
  if (organism.societyId !== null && societyCtx) {
    if (organism.role === "defender" && hasThreat) {
      return "DEFENDING";
    }
    if (organism.role === "builder" && societyCtx.buildSite) {
      return "BUILDING";
    }
    if (organism.role === "farmer" && nearestFood) {
      return "GATHERING";
    }
  }

  // HUNTING if aggressive and there's a weaker organism nearby
  if (organism.aggression > 0.5) {
    for (const { org: other, dSq: d } of nearbyOrgs) {
      if (other.energy < organism.energy * 0.8 && d < organism.vision * organism.vision) {
        return "HUNTING";
      }
    }
  }

  // FEEDING if right on top of food
  if (nearestFood) {
    const d = distSq(organism.x, organism.y, nearestFood.x, nearestFood.y);
    if (d < CONTACT_RADIUS * CONTACT_RADIUS * 4) {
      return "FEEDING";
    }
  }

  // Society members with no specific task drift toward centroid
  if (organism.societyId !== null && societyCtx) {
    return "COOPERATING";
  }

  return "FORAGING";
}

// --- Behavior execution ---

function steerToward(organism: Organism, tx: number, ty: number, speedMult: number): void {
  const dx = direction(organism.x, tx);
  const dy = direction(organism.y, ty);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 0) {
    organism.vx = (dx / dist) * organism.speed * speedMult;
    organism.vy = (dy / dist) * organism.speed * speedMult;
  }
}

function steerAwayFrom(organism: Organism, tx: number, ty: number, speedMult: number): void {
  const dx = direction(tx, organism.x); // reversed direction
  const dy = direction(ty, organism.y);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 0) {
    organism.vx = (dx / dist) * organism.speed * speedMult;
    organism.vy = (dy / dist) * organism.speed * speedMult;
  }
}

function wander(organism: Organism): void {
  const wanderAngle = (Math.random() - 0.5) * 0.6;
  const cos = Math.cos(wanderAngle);
  const sin = Math.sin(wanderAngle);
  const nvx = organism.vx * cos - organism.vy * sin;
  const nvy = organism.vx * sin + organism.vy * cos;
  const vLen = Math.sqrt(nvx * nvx + nvy * nvy);
  if (vLen > 0) {
    organism.vx = (nvx / vLen) * organism.speed;
    organism.vy = (nvy / vLen) * organism.speed;
  }
}

function executeBehavior(
  organism: Organism,
  nearbyOrgs: { org: Organism; dSq: number }[],
  nearestFood: Food | null,
  societyCtx: SocietyContext | null,
): void {
  switch (organism.state) {
    case "FORAGING":
    case "GATHERING": {
      // GATHERING behaves like FORAGING (energy deposit handled in eat step)
      if (nearestFood) {
        steerToward(organism, nearestFood.x, nearestFood.y, 1.0);
      } else {
        wander(organism);
      }
      break;
    }
    case "HUNTING": {
      // Find weakest nearby organism
      let target: Organism | null = null;
      let bestDSq = Infinity;
      for (const { org: other, dSq: d } of nearbyOrgs) {
        if (other.energy < organism.energy * 0.8 && d < bestDSq) {
          bestDSq = d;
          target = other;
        }
      }
      if (target) {
        steerToward(organism, target.x, target.y, 1.1);
      } else {
        if (nearestFood) {
          steerToward(organism, nearestFood.x, nearestFood.y, 1.0);
        } else {
          wander(organism);
        }
      }
      break;
    }
    case "FLEEING": {
      const threat = findNearestThreat(organism, nearbyOrgs);
      if (threat) {
        steerAwayFrom(organism, threat.x, threat.y, 1.2);
      } else {
        wander(organism);
      }
      break;
    }
    case "FEEDING": {
      organism.vx *= 0.3;
      organism.vy *= 0.3;
      break;
    }
    case "BUILDING": {
      if (societyCtx?.buildSite) {
        const site = societyCtx.buildSite;
        const d = distSq(organism.x, organism.y, site.x, site.y);
        if (d < 100) {
          // Close to site: slow down and contribute
          organism.vx *= 0.2;
          organism.vy *= 0.2;
        } else {
          steerToward(organism, site.x, site.y, 0.8);
        }
      } else {
        wander(organism);
      }
      break;
    }
    case "DEFENDING": {
      // Steer toward midpoint between threat and society centroid
      const threat = findNearestThreat(organism, nearbyOrgs);
      if (threat && societyCtx) {
        const midX = (threat.x + societyCtx.centroidX) / 2;
        const midY = (threat.y + societyCtx.centroidY) / 2;
        steerToward(organism, midX, midY, 1.1);
      } else if (societyCtx) {
        steerToward(organism, societyCtx.centroidX, societyCtx.centroidY, 0.5);
      } else {
        wander(organism);
      }
      break;
    }
    case "COOPERATING": {
      // Gentle drift toward society centroid, with some foraging
      if (nearestFood) {
        steerToward(organism, nearestFood.x, nearestFood.y, 1.0);
      } else if (societyCtx) {
        steerToward(organism, societyCtx.centroidX, societyCtx.centroidY, 0.3);
      } else {
        wander(organism);
      }
      break;
    }
  }
}

// --- Society helpers ---

function depositToStorage(
  world: WorldState,
  societyId: number,
  x: number,
  y: number,
  amount: number,
): void {
  let bestStructure: Structure | null = null;
  let bestDist = Infinity;
  for (const s of world.structures) {
    if (s.societyId === societyId && s.type === "storage" && s.buildProgress >= 1) {
      const d = distSq(x, y, s.x, s.y);
      if (d < 1600 && d < bestDist) {
        // within 40 units
        bestDist = d;
        bestStructure = s;
      }
    }
  }
  if (bestStructure && bestStructure.storedEnergy < 500) {
    bestStructure.storedEnergy = Math.min(500, bestStructure.storedEnergy + amount);
  } else {
    // Deposit to shared pool instead
    const society = world.societies.find((s) => s.id === societyId);
    if (society) society.sharedPool += amount;
  }
}

function getBuildCost(type: string): number {
  switch (type) {
    case "home":
      return 30;
    case "storage":
      return 40;
    case "farm":
      return 50;
    default:
      return 40;
  }
}

// --- Main update ---

export function updateOrganism(
  organism: Organism,
  food: Food[],
  foodGrid: SpatialGrid,
  world: WorldState,
  config: SimulationConfig,
  orgGrid: SpatialGrid,
  deadSet: Set<number>,
): UpdateResult {
  const eatenFoodIndices: number[] = [];
  const killedOrganismIds: number[] = [];
  let offspring: Organism | null = null;

  // Record trail position
  organism.trail.push({ x: organism.x, y: organism.y });
  if (organism.trail.length > MAX_TRAIL_LENGTH) {
    organism.trail.shift();
  }

  // 1. Sense food
  const foodCandidates = foodGrid.query(organism.x, organism.y, organism.vision);
  let nearestFoodDistSq = Infinity;
  let nearestFood: Food | null = null;

  for (const idx of foodCandidates) {
    const f = food[idx];
    const dSq = distSq(organism.x, organism.y, f.x, f.y);
    if (dSq < organism.vision * organism.vision && dSq < nearestFoodDistSq) {
      nearestFoodDistSq = dSq;
      nearestFood = f;
    }
  }

  // 2. Tick abilities (cooldowns/durations)
  tickAbilities(organism.abilities);

  // 3. Sense nearby organisms (accounting for camouflage)
  const orgCandidates = orgGrid.query(organism.x, organism.y, organism.vision);
  const nearbyOrgs: { org: Organism; dSq: number }[] = [];
  for (const idx of orgCandidates) {
    const other = world.organisms[idx];
    if (other.id === organism.id || deadSet.has(other.id)) continue;
    const dSq = distSq(organism.x, organism.y, other.x, other.y);
    // Camouflaged organisms are harder to detect
    const otherMods = computeAbilityModifiers(other.abilities);
    const effectiveVisionSq =
      organism.vision * organism.vision * (1 - otherMods.detectionReduction);
    if (dSq < effectiveVisionSq) {
      nearbyOrgs.push({ org: other, dSq });
    }
  }

  // 4. Activate abilities based on context
  const nearbyFood: Food[] = [];
  for (const idx of foodCandidates) {
    nearbyFood.push(food[idx]);
  }
  tryActivateAbilities(organism.abilities, organism, nearbyOrgs, nearbyFood);
  const mods = computeAbilityModifiers(organism.abilities);

  // 5. areaSense override — steer toward densest food cluster
  const hasAreaSense = organism.abilities.some((a) => a.type === "areaSense" && a.active);
  let effectiveNearestFood = nearestFood;
  if (hasAreaSense && foodCandidates.length > 1) {
    const cluster = findDensestFoodCluster(organism, food, foodCandidates);
    if (cluster) {
      effectiveNearestFood = { x: cluster.x, y: cluster.y, energy: 0 } as Food;
    }
  }

  // 6. Build society context
  let societyCtx: SocietyContext | null = null;
  if (organism.societyId !== null) {
    const society = world.societies.find((s) => s.id === organism.societyId);
    if (society) {
      // Find build site: first incomplete structure for this society
      let buildSite: { x: number; y: number } | null = null;
      for (const s of world.structures) {
        if (s.societyId === society.id && s.buildProgress < 1) {
          buildSite = { x: s.x, y: s.y };
          break;
        }
      }
      // Also count nearby structures needing repair as build targets
      if (!buildSite) {
        for (const s of world.structures) {
          if (s.societyId === society.id && s.health < s.maxHealth * 0.8) {
            buildSite = { x: s.x, y: s.y };
            break;
          }
        }
      }
      let defenderCount = 0;
      for (const org2 of world.organisms) {
        if (org2.societyId === society.id && org2.role === "defender") defenderCount++;
      }
      societyCtx = {
        centroidX: society.centroidX,
        centroidY: society.centroidY,
        buildSite,
        defenderCount,
      };
    }
  }

  // 7. Evaluate state
  organism.state = evaluateState(organism, nearbyOrgs, effectiveNearestFood, societyCtx);

  // 8. Execute behavior (sets velocity)
  executeBehavior(organism, nearbyOrgs, effectiveNearestFood, societyCtx);

  // 8. Apply speed modifier from abilities (burstSpeed)
  organism.vx *= mods.speedMultiplier;
  organism.vy *= mods.speedMultiplier;

  // 9. Move
  organism.x += organism.vx;
  organism.y += organism.vy;

  // 10. Metabolize (home structures reduce cost by 5%)
  let homeCostMult = 1.0;
  if (organism.societyId !== null) {
    for (const s of world.structures) {
      if (
        s.societyId === organism.societyId &&
        s.type === "home" &&
        s.buildProgress >= 1 &&
        distSq(organism.x, organism.y, s.x, s.y) < 3600 // 60^2
      ) {
        homeCostMult = 0.95;
        break;
      }
    }
  }
  const cost =
    (organism.metabolism +
      organism.speed * SPEED_COST_FACTOR +
      organism.vision * VISION_COST_FACTOR +
      organism.aggression * AGGRESSION_COST_FACTOR +
      organism.awareness * AWARENESS_COST_FACTOR) *
    config.energyCostMultiplier *
    homeCostMult;
  organism.energy -= cost;

  // 11. Energy drain ability
  applyEnergyDrain(organism, nearbyOrgs);

  // 12. Eat food — farmers deposit 15% to nearest storage
  for (const idx of foodCandidates) {
    const f = food[idx];
    const d = distSq(organism.x, organism.y, f.x, f.y);
    if (d < CONTACT_RADIUS * CONTACT_RADIUS) {
      const gained = f.energy * organism.efficiency;
      if (organism.role === "farmer" && organism.societyId !== null) {
        const deposit = gained * 0.15;
        organism.energy += gained - deposit;
        // Find nearest storage structure
        depositToStorage(world, organism.societyId, organism.x, organism.y, deposit);
      } else {
        organism.energy += gained;
      }
      eatenFoodIndices.push(idx);
    }
  }

  // 12b. Builder contribution to structures
  if (organism.state === "BUILDING" && societyCtx?.buildSite) {
    const site = societyCtx.buildSite;
    const d = distSq(organism.x, organism.y, site.x, site.y);
    if (d < 100) {
      // Within 10 units of build site
      for (const s of world.structures) {
        if (s.societyId === organism.societyId && distSq(s.x, s.y, site.x, site.y) < 1) {
          if (s.buildProgress < 1) {
            s.buildProgress += (organism.efficiency * 0.5) / getBuildCost(s.type);
            if (s.buildProgress > 1) s.buildProgress = 1;
          } else if (s.health < s.maxHealth) {
            s.health = Math.min(s.maxHealth, s.health + organism.efficiency * 0.5);
          }
          organism.energy -= 0.3;
          break;
        }
      }
    }
  }

  // 13. Predation — if hunting and contacting a weaker organism, consume it
  // Society members with 2+ defenders get 30% predation resistance
  if (organism.state === "HUNTING") {
    for (const { org: other, dSq: d } of nearbyOrgs) {
      if (deadSet.has(other.id)) continue;
      if (d >= PREDATION_CONTACT_RADIUS * PREDATION_CONTACT_RADIUS) continue;

      // Predation resistance from society defenders
      let requiredRatio = 1.0;
      if (other.societyId !== null && societyCtx === null) {
        // Target is in a society but attacker is not — check target's defenders
        const targetSociety = world.societies.find((s) => s.id === other.societyId);
        if (targetSociety) {
          let defCount = 0;
          for (const org2 of world.organisms) {
            if (org2.societyId === other.societyId && org2.role === "defender") defCount++;
          }
          if (defCount >= 2) requiredRatio = 1.3;
        }
      }

      if (other.energy < organism.energy / requiredRatio) {
        organism.energy += other.energy * organism.efficiency * 0.5;
        killedOrganismIds.push(other.id);
        deadSet.add(other.id);
        break;
      }
    }
  }

  // 14. Reproduce (with reproSpike modifier)
  const effectiveReproThreshold = organism.reproductionThreshold * mods.reproThresholdMultiplier;
  if (organism.energy >= effectiveReproThreshold && world.organisms.length < config.maxOrganisms) {
    organism.energy *= 0.5;
    offspring = createOffspring(organism, world, config);
  }

  // 15. Age and death check
  organism.age++;
  const dead = organism.energy <= 0;

  return { eatenFoodIndices, offspring, dead, killedOrganismIds };
}

function mutateTrait(value: number, mutationRate: number, min: number, max: number): number {
  const mutated = value * (1 + (Math.random() * 2 - 1) * mutationRate);
  return Math.max(min, Math.min(max, mutated));
}

function createOffspring(parent: Organism, world: WorldState, config: SimulationConfig): Organism {
  const id = world.nextId++;
  const offsetAngle = Math.random() * Math.PI * 2;
  const x = parent.x + Math.cos(offsetAngle) * 10;
  const y = parent.y + Math.sin(offsetAngle) * 10;

  const mr = config.mutationRate;
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
      aggression: mutateTrait(parent.aggression, mr, ...TRAIT_RANGES.aggression),
      awareness: mutateTrait(parent.awareness, mr, ...TRAIT_RANGES.awareness),
      efficiency: mutateTrait(parent.efficiency, mr, ...TRAIT_RANGES.efficiency),
      riskTolerance: mutateTrait(parent.riskTolerance, mr, ...TRAIT_RANGES.riskTolerance),
      socialAffinity: mutateTrait(parent.socialAffinity, mr, ...TRAIT_RANGES.socialAffinity),
    },
    parent.generation + 1,
  );
  org.energy = parent.energy;
  org.abilities = mutateAbilities(parent.abilities);
  org.societyId = parent.societyId;
  return org;
}
