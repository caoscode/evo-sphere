import type { SimulationConfig, Society, Structure, StructureType, WorldState } from "./types";
import { distSq } from "./spatial-grid";
import { foodDensityAt } from "./terrain";
import { findExpansionTarget } from "./territory";

const BUILD_COSTS: Record<StructureType, number> = {
  home: 30,
  storage: 40,
  farm: 50,
};

const STRUCTURE_LIMITS: Record<StructureType, number> = {
  home: 1,
  storage: 3,
  farm: 2,
};

function countStructures(world: WorldState, societyId: number, type: StructureType): number {
  let count = 0;
  for (const s of world.structures) {
    if (s.societyId === societyId && s.type === type) count++;
  }
  return count;
}

// --- Build decisions ---

function decideBuild(world: WorldState, society: Society): StructureType | null {
  // Priority: home > storage > farm
  if (countStructures(world, society.id, "home") === 0) return "home";
  if (
    countStructures(world, society.id, "storage") < STRUCTURE_LIMITS.storage &&
    society.sharedPool > 100
  ) {
    return "storage";
  }
  if (countStructures(world, society.id, "farm") < STRUCTURE_LIMITS.farm) {
    // Only build farm if limited food nearby
    return "farm";
  }
  return null;
}

function findBuildSite(
  world: WorldState,
  society: Society,
  type: StructureType,
): { x: number; y: number } | null {
  if (type === "farm") {
    // Try territory expansion target first
    if (world.territoryGrid) {
      const expansionTarget = findExpansionTarget(
        world.territoryGrid,
        society.id,
        society.centroidX,
        society.centroidY,
      );
      if (expansionTarget) {
        const density = foodDensityAt(expansionTarget.x, expansionTarget.y);
        if (density >= 0.3) return expansionTarget;
      }
    }

    // Fallback: find highest food density point within 100 units of centroid
    let bestX = society.centroidX;
    let bestY = society.centroidY;
    let bestDensity = 0;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      for (let r = 20; r <= 100; r += 20) {
        const x = society.centroidX + Math.cos(angle) * r;
        const y = society.centroidY + Math.sin(angle) * r;
        const density = foodDensityAt(x, y);
        if (density > bestDensity) {
          bestDensity = density;
          bestX = x;
          bestY = y;
        }
      }
    }
    if (bestDensity < 0.4) return null; // Not fertile enough
    return { x: bestX, y: bestY };
  }

  // Home and storage: place near centroid, bias toward contested borders if under pressure
  let offsetBase = type === "home" ? 0 : 15 + Math.random() * 20;
  if (
    type === "storage" &&
    society.borderCells > 0 &&
    society.borderCells > society.territorySize * 0.3 &&
    world.territoryGrid
  ) {
    // Under territorial pressure — place storage toward border to amplify influence
    const borderTarget = findExpansionTarget(
      world.territoryGrid,
      society.id,
      society.centroidX,
      society.centroidY,
    );
    if (borderTarget) {
      const dx = borderTarget.x - society.centroidX;
      const dy = borderTarget.y - society.centroidY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        return {
          x: society.centroidX + (dx / dist) * Math.min(dist * 0.5, 40),
          y: society.centroidY + (dy / dist) * Math.min(dist * 0.5, 40),
        };
      }
    }
  }

  const angle = Math.random() * Math.PI * 2;
  return {
    x: society.centroidX + Math.cos(angle) * offsetBase,
    y: society.centroidY + Math.sin(angle) * offsetBase,
  };
}

// --- Structure creation ---

function tryInitiateBuilding(world: WorldState, config: SimulationConfig): void {
  for (const society of world.societies) {
    if (society.memberIds.size < config.minSocietySize) continue;

    // Check if there's already an incomplete structure
    let hasIncomplete = false;
    for (const s of world.structures) {
      if (s.societyId === society.id && s.buildProgress < 1) {
        hasIncomplete = true;
        break;
      }
    }
    if (hasIncomplete) continue;
    if (world.structures.length >= config.maxStructures) continue;

    const type = decideBuild(world, society);
    if (!type) continue;

    const site = findBuildSite(world, society, type);
    if (!site) continue;

    // Check if society can afford it (deduct from shared pool)
    const cost = BUILD_COSTS[type];
    if (society.sharedPool < cost * 0.5) continue; // Need at least half the cost upfront
    society.sharedPool -= cost * 0.3;

    const structure: Structure = {
      id: world.nextStructureId++,
      type,
      x: site.x,
      y: site.y,
      societyId: society.id,
      health: 100,
      maxHealth: 100,
      storedEnergy: 0,
      buildProgress: 0,
      createdTick: world.tick,
    };

    world.structures.push(structure);
    society.structureIds.add(structure.id);
  }
}

// --- Decay and destruction ---

function decayStructures(world: WorldState, config: SimulationConfig): void {
  for (let i = world.structures.length - 1; i >= 0; i--) {
    const s = world.structures[i];
    if (s.buildProgress < 1) continue; // Don't decay structures under construction

    // Orphaned structures decay 5x faster
    const decayMult = s.societyId === -1 ? 5 : 1;
    s.health -= config.structureDecayRate * decayMult;

    // High-aggression non-members damage structures on contact
    // Attacker-role organisms in enemy territory deal extra damage
    for (const org of world.organisms) {
      if (org.societyId === s.societyId) continue;
      const d = distSq(org.x, org.y, s.x, s.y);
      if (org.role === "attacker" && org.societyId !== null && d < 900) {
        // 30u radius, 2 damage
        s.health -= 2;
      } else if (org.aggression > 0.6 && d < 64) {
        // contact radius 8, 1 damage
        s.health -= 1;
      }
    }

    // Remove destroyed structures
    if (s.health <= 0) {
      // Transfer stored energy to attacker's society
      if (s.storedEnergy > 0) {
        for (const org of world.organisms) {
          if (
            org.role === "attacker" &&
            org.societyId !== null &&
            org.societyId !== s.societyId &&
            distSq(org.x, org.y, s.x, s.y) < 900
          ) {
            const attackerSociety = world.societies.find((soc) => soc.id === org.societyId);
            if (attackerSociety) {
              attackerSociety.sharedPool += s.storedEnergy * 0.2;
            }
            break;
          }
        }
      }

      // Remove from society's set
      const society = world.societies.find((soc) => soc.id === s.societyId);
      if (society) society.structureIds.delete(s.id);

      world.structures[i] = world.structures[world.structures.length - 1];
      world.structures.pop();
    }
  }
}

// --- Farm food spawning ---

function spawnFarmFood(world: WorldState, config: SimulationConfig): void {
  for (const s of world.structures) {
    if (s.type !== "farm" || s.buildProgress < 1) continue;
    if (world.food.length >= config.maxFood) break;

    // Spawn 0.5 food/tick on average
    if (Math.random() < 0.5) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 30;
      world.food.push({
        x: s.x + Math.cos(angle) * r,
        y: s.y + Math.sin(angle) * r,
        energy: config.foodEnergy,
      });
    }
  }
}

// --- Main entry point ---

export function updateStructures(world: WorldState, config: SimulationConfig): void {
  // Initiate new builds every 50 ticks
  if (world.tick % 50 === 0) {
    tryInitiateBuilding(world, config);
  }

  // Farm food production
  spawnFarmFood(world, config);

  // Decay and destruction
  decayStructures(world, config);
}
