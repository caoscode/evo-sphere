import type {
  LeaderDirective,
  Organism,
  SimulationConfig,
  Society,
  SocietyEmblem,
  SocietyHistory,
  SocietyPersonality,
  SocietyRole,
  SocietyStrategy,
  WorldState,
} from "./types";
import { type SpatialGrid, distSq } from "./spatial-grid";
import {
  COLLAPSE_MIN_AGE,
  COLLAPSE_STABILITY_THRESHOLD,
  COLLAPSE_TIMER_LIMIT,
  INDEPENDENCE_COOLDOWN_TICKS,
  MAX_SOCIETY_SIZE,
  SOCIETY_FORM_TICKS,
  SOCIETY_JOIN_TICKS,
  SOCIETY_LEAVE_DISTANCE,
  TRAIT_RANGES,
  WAR_ZONE_REFUGEE_CHANCE,
} from "./config";
import { findBorderDirection, findExpansionTarget, getCellOwner, isContested } from "./territory";

// --- Emblem shapes/patterns ---

const EMBLEM_SHAPES: SocietyEmblem["shape"][] = [
  "circle",
  "triangle",
  "diamond",
  "cross",
  "star",
  "hexagon",
];
const EMBLEM_PATTERNS: SocietyEmblem["pattern"][] = ["solid", "striped", "dotted", "rings"];

function generateEmblem(societyId: number, hue: number): SocietyEmblem {
  return {
    shape: EMBLEM_SHAPES[societyId % EMBLEM_SHAPES.length],
    pattern: EMBLEM_PATTERNS[Math.floor(societyId / EMBLEM_SHAPES.length) % EMBLEM_PATTERNS.length],
    secondaryHue: (hue + 120) % 360,
    borderStyle: "solid",
  };
}

// --- Society formation helpers ---

function traitCompatibility(a: Organism, b: Organism): number {
  const dSpeed = (a.speed - b.speed) / (TRAIT_RANGES.speed[1] - TRAIT_RANGES.speed[0]);
  const dEff =
    (a.efficiency - b.efficiency) / (TRAIT_RANGES.efficiency[1] - TRAIT_RANGES.efficiency[0]);
  const dAgg = a.aggression - b.aggression;
  const dAware = a.awareness - b.awareness;
  return 1 - Math.sqrt((dSpeed * dSpeed + dEff * dEff + dAgg * dAgg + dAware * dAware) / 4);
}

function averageMetabolismHue(organisms: Organism[]): number {
  let sum = 0;
  for (const org of organisms) sum += org.metabolism;
  const avgMeta = sum / organisms.length;
  const norm =
    (avgMeta - TRAIT_RANGES.metabolism[0]) /
    (TRAIT_RANGES.metabolism[1] - TRAIT_RANGES.metabolism[0]);
  return ((1 - norm) * 240 + 30) % 360;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function defaultPersonality(): SocietyPersonality {
  return { aggression: 0.25, defensiveness: 0.25, expansiveness: 0.25, economicFocus: 0.25 };
}

function defaultDirective(tick: number): LeaderDirective {
  return { type: "idle", issuedTick: tick };
}

function defaultHistory(memberCount: number): SocietyHistory {
  return {
    foundingMembers: memberCount,
    peakPower: 0,
    peakTick: 0,
    territorySamples: [],
    isRising: false,
    isFalling: false,
  };
}

function createSocietyObject(
  id: number,
  memberIds: Set<number>,
  hue: number,
  tick: number,
): Society {
  return {
    id,
    memberIds,
    foundedTick: tick,
    centroidX: 0,
    centroidY: 0,
    hue,
    totalEnergy: 0,
    structureIds: new Set(),
    sharedPool: 0,
    territorySize: 0,
    territoryValue: 0,
    borderCells: 0,
    power: 0,
    peakTerritorySize: 0,
    personality: defaultPersonality(),
    strategy: "consolidate",
    leaderDirective: defaultDirective(tick),
    leaderId: null,
    stabilityScore: 1.0,
    overextensionPenalty: 0,
    peakMemberCount: memberIds.size,
    collapseTimer: 0,
    emblem: generateEmblem(id, hue),
    history: defaultHistory(memberIds.size),
    rivalries: new Map(),
  };
}

// --- Society formation ---

function tryFormSocieties(world: WorldState, config: SimulationConfig, orgGrid: SpatialGrid): void {
  const radius = config.societyFormationRadius;
  const radiusSq = radius * radius;

  for (const org of world.organisms) {
    if (org.societyId !== null || org.socialAffinity <= 0.3) continue;
    if (org.independenceCooldown > 0) continue;

    const nearbyIndices = orgGrid.query(org.x, org.y, radius);
    let eligibleNeighbors = 0;
    for (const idx of nearbyIndices) {
      const other = world.organisms[idx];
      if (!other || other.id === org.id || other.societyId !== null) continue;
      if (other.socialAffinity <= 0.3 || other.independenceCooldown > 0) continue;
      const d = distSq(org.x, org.y, other.x, other.y);
      if (d < radiusSq) eligibleNeighbors++;
    }

    if (eligibleNeighbors >= config.minSocietySize - 1) {
      org.proximityTimer++;
    } else {
      org.proximityTimer = Math.max(0, org.proximityTimer - 1);
    }
  }

  const ready = new Set<number>();
  for (const org of world.organisms) {
    if (org.societyId !== null || org.independenceCooldown > 0) continue;
    if (org.proximityTimer >= SOCIETY_FORM_TICKS) {
      ready.add(org.id);
    }
  }

  if (ready.size < config.minSocietySize) return;

  const claimed = new Set<number>();
  for (const org of world.organisms) {
    if (!ready.has(org.id) || claimed.has(org.id)) continue;

    const nearbyIndices = orgGrid.query(org.x, org.y, radius);
    const cluster: Organism[] = [org];
    claimed.add(org.id);

    for (const idx of nearbyIndices) {
      const other = world.organisms[idx];
      if (!other || !ready.has(other.id) || claimed.has(other.id)) continue;
      const d = distSq(org.x, org.y, other.x, other.y);
      if (d < radiusSq) {
        cluster.push(other);
        claimed.add(other.id);
      }
    }

    if (cluster.length < config.minSocietySize) {
      for (const m of cluster) claimed.delete(m.id);
      continue;
    }

    const hue = averageMetabolismHue(cluster);
    const society = createSocietyObject(
      world.nextSocietyId++,
      new Set(cluster.map((m) => m.id)),
      hue,
      world.tick,
    );

    for (const member of cluster) {
      member.societyId = society.id;
      member.proximityTimer = 0;
    }

    updateSocietyCentroid(society, cluster);
    world.societies.push(society);
    world.totalSocietiesEver++;
    world.events.push({
      type: "society_formed",
      tick: world.tick,
      detail: `Society #${society.id} formed with ${cluster.length} members`,
      data: { societyId: society.id, members: cluster.length, hue: society.hue },
    });
  }
}

// --- Joining ---

function tryJoinSocieties(
  world: WorldState,
  config: SimulationConfig,
  _orgGrid: SpatialGrid,
): void {
  const radius = config.societyFormationRadius;

  for (const org of world.organisms) {
    if (org.societyId !== null || org.socialAffinity <= 0.2) continue;
    if (org.independenceCooldown > 0) continue;

    let bestSociety: Society | null = null;
    let bestDist = Infinity;

    for (const society of world.societies) {
      if (society.memberIds.size >= MAX_SOCIETY_SIZE) continue;
      const d = distSq(org.x, org.y, society.centroidX, society.centroidY);
      if (d < radius * radius && d < bestDist) {
        bestDist = d;
        bestSociety = society;
      }
    }

    if (!bestSociety) {
      continue;
    }

    org.proximityTimer++;
    if (org.proximityTimer < SOCIETY_JOIN_TICKS) continue;

    const members = world.organisms.filter((o) => bestSociety!.memberIds.has(o.id));
    if (members.length === 0) continue;

    let compatSum = 0;
    for (const member of members) compatSum += traitCompatibility(org, member);
    if (compatSum / members.length < 0.25) continue;

    org.societyId = bestSociety.id;
    org.proximityTimer = 0;
    bestSociety.memberIds.add(org.id);
    if (bestSociety.memberIds.size > bestSociety.peakMemberCount) {
      bestSociety.peakMemberCount = bestSociety.memberIds.size;
    }
  }
}

// --- Leaving ---

function processLeaving(world: WorldState): void {
  for (const society of world.societies) {
    let totalEnergy = 0;
    let memberCount = 0;
    for (const org of world.organisms) {
      if (org.societyId === society.id) {
        totalEnergy += org.energy;
        memberCount++;
      }
    }
    const avgEnergy = memberCount > 0 ? totalEnergy / memberCount : 0;

    for (const org of world.organisms) {
      if (org.societyId !== society.id) continue;

      // Leave if energy critically low
      const inDecline =
        society.peakTerritorySize > 0 && society.territorySize < society.peakTerritorySize * 0.3;
      // Decline modifier from history: loosen threshold when society is falling
      const declineBonus = society.history.isFalling && society.stabilityScore < 0.5 ? 0.05 : 0;
      const leaveEnergyThreshold = (inDecline ? 0.3 : 0.2) - declineBonus;
      if (org.energy < avgEnergy * leaveEnergyThreshold) {
        removeMember(org, society);
        continue;
      }

      // Leave if too far from centroid for too long
      const d = distSq(org.x, org.y, society.centroidX, society.centroidY);
      const leaveDist = SOCIETY_LEAVE_DISTANCE;
      if (d > leaveDist * leaveDist) {
        org.proximityTimer++;
        if (org.proximityTimer > 30) {
          removeMember(org, society);
        }
      } else {
        org.proximityTimer = 0;
      }
    }
  }
}

// --- War zone refugee mechanic ---

function processWarZoneRefugees(world: WorldState): void {
  if (!world.territoryGrid) return;
  for (const org of world.organisms) {
    if (org.societyId === null) continue;
    const contested = isContested(world.territoryGrid, org.x, org.y);
    if (!contested) continue;
    // Check if contest level is very high (war zone)
    if (Math.random() < WAR_ZONE_REFUGEE_CHANCE) {
      const society = world.societies.find((s) => s.id === org.societyId);
      if (society) {
        removeMember(org, society);
        org.independenceCooldown = INDEPENDENCE_COOLDOWN_TICKS;
      }
    }
  }
}

function removeMember(org: Organism, society: Society): void {
  org.societyId = null;
  org.role = "none";
  org.proximityTimer = 0;
  society.memberIds.delete(org.id);
}

// --- Dissolution & Collapse ---

function dissolveSocieties(world: WorldState, config: SimulationConfig): void {
  for (let i = world.societies.length - 1; i >= 0; i--) {
    const society = world.societies[i];

    // Count actual living members
    let livingMembers = 0;
    for (const org of world.organisms) {
      if (org.societyId === society.id) livingMembers++;
    }
    society.memberIds = new Set(
      world.organisms.filter((o) => o.societyId === society.id).map((o) => o.id),
    );

    // Standard dissolution: too few members
    if (livingMembers < config.minSocietySize) {
      dissolveSociety(world, society, i);
      continue;
    }

    // Collapse check: sustained instability
    const age = world.tick - society.foundedTick;
    if (society.stabilityScore < COLLAPSE_STABILITY_THRESHOLD && age > COLLAPSE_MIN_AGE) {
      society.collapseTimer++;
    } else {
      society.collapseTimer = Math.max(0, society.collapseTimer - 1);
    }

    if (society.collapseTimer > COLLAPSE_TIMER_LIMIT) {
      // Try fragmentation first
      if (livingMembers >= 6) {
        fragmentSociety(world, config, society, i);
      } else {
        dissolveSociety(world, society, i);
      }
    }
  }
}

function dissolveSociety(world: WorldState, society: Society, index: number): void {
  for (const org of world.organisms) {
    if (org.societyId === society.id) {
      org.societyId = null;
      org.role = "none";
      org.proximityTimer = 0;
      org.independenceCooldown = INDEPENDENCE_COOLDOWN_TICKS;
    }
  }
  // Mark structures for fast decay, drop stored energy as food
  for (const sid of society.structureIds) {
    const structure = world.structures.find((s) => s.id === sid);
    if (structure) {
      structure.societyId = -1;
      // Drop stored energy as food
      if (structure.storedEnergy > 0) {
        const foodCount = Math.floor(structure.storedEnergy / 25);
        for (let f = 0; f < foodCount; f++) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 20;
          world.food.push({
            x: structure.x + Math.cos(angle) * r,
            y: structure.y + Math.sin(angle) * r,
            energy: 25,
          });
        }
        structure.storedEnergy = 0;
      }
    }
  }
  world.events.push({
    type: "society_dissolved",
    tick: world.tick,
    detail: `Society #${society.id} dissolved (${society.memberIds.size} members)`,
    data: { societyId: society.id, members: society.memberIds.size },
  });
  world.societies[index] = world.societies[world.societies.length - 1];
  world.societies.pop();
}

function fragmentSociety(
  world: WorldState,
  config: SimulationConfig,
  society: Society,
  index: number,
): void {
  const members = world.organisms.filter((o) => o.societyId === society.id);
  if (members.length < 6) {
    dissolveSociety(world, society, index);
    return;
  }

  // Find the member farthest from centroid as seed for cluster B
  let farthestDist = 0;
  let farthestMember = members[0];
  for (const m of members) {
    const d = distSq(m.x, m.y, society.centroidX, society.centroidY);
    if (d > farthestDist) {
      farthestDist = d;
      farthestMember = m;
    }
  }

  // Cluster A seed = centroid, cluster B seed = farthest member
  const seedAx = society.centroidX;
  const seedAy = society.centroidY;
  const seedBx = farthestMember.x;
  const seedBy = farthestMember.y;

  const clusterA: Organism[] = [];
  const clusterB: Organism[] = [];

  for (const m of members) {
    const distA = distSq(m.x, m.y, seedAx, seedAy);
    const distB = distSq(m.x, m.y, seedBx, seedBy);
    if (distA <= distB) {
      clusterA.push(m);
    } else {
      clusterB.push(m);
    }
  }

  // If either cluster too small, dissolve instead
  if (clusterA.length < config.minSocietySize || clusterB.length < config.minSocietySize) {
    dissolveSociety(world, society, index);
    return;
  }

  // Release all members from current society
  for (const m of members) {
    m.societyId = null;
    m.role = "none";
    m.proximityTimer = 0;
  }

  // Divide shared pool proportionally
  const totalMembers = clusterA.length + clusterB.length;
  const poolA = society.sharedPool * (clusterA.length / totalMembers);
  const poolB = society.sharedPool * (clusterB.length / totalMembers);

  // Create fragment A
  const hueA = averageMetabolismHue(clusterA);
  const fragA = createSocietyObject(
    world.nextSocietyId++,
    new Set(clusterA.map((m) => m.id)),
    hueA,
    world.tick,
  );
  fragA.sharedPool = poolA;
  // Mutate personality from parent
  fragA.personality = mutatePersonality(society.personality);
  for (const m of clusterA) m.societyId = fragA.id;
  updateSocietyCentroid(fragA, clusterA);

  // Create fragment B
  const hueB = averageMetabolismHue(clusterB);
  const fragB = createSocietyObject(
    world.nextSocietyId++,
    new Set(clusterB.map((m) => m.id)),
    hueB,
    world.tick,
  );
  fragB.sharedPool = poolB;
  fragB.personality = mutatePersonality(society.personality);
  for (const m of clusterB) m.societyId = fragB.id;
  updateSocietyCentroid(fragB, clusterB);

  // Distribute structures to nearest fragment or orphan them
  for (const sid of society.structureIds) {
    const structure = world.structures.find((s) => s.id === sid);
    if (!structure) continue;
    const distToA = distSq(structure.x, structure.y, fragA.centroidX, fragA.centroidY);
    const distToB = distSq(structure.x, structure.y, fragB.centroidX, fragB.centroidY);
    if (distToA < distToB && distToA < 200 * 200) {
      structure.societyId = fragA.id;
      fragA.structureIds.add(structure.id);
    } else if (distToB < 200 * 200) {
      structure.societyId = fragB.id;
      fragB.structureIds.add(structure.id);
    } else {
      structure.societyId = -1; // orphaned
    }
  }

  // Remove old society
  world.societies[index] = world.societies[world.societies.length - 1];
  world.societies.pop();

  // Add new fragments
  world.societies.push(fragA, fragB);
  world.totalSocietiesEver += 2;
  world.events.push({
    type: "society_fragmented",
    tick: world.tick,
    detail: `Society fragmented into #${fragA.id} (${fragA.memberIds.size}) and #${fragB.id} (${fragB.memberIds.size})`,
    data: { fragAId: fragA.id, fragBId: fragB.id },
  });
}

function mutatePersonality(p: SocietyPersonality): SocietyPersonality {
  const mutate = (v: number) => clamp(v + (Math.random() - 0.5) * 0.2, 0, 1);
  return {
    aggression: mutate(p.aggression),
    defensiveness: mutate(p.defensiveness),
    expansiveness: mutate(p.expansiveness),
    economicFocus: mutate(p.economicFocus),
  };
}

// --- Personality & Strategy ---

function computeSocietyPersonality(members: Organism[], society: Society): SocietyPersonality {
  if (members.length === 0) return defaultPersonality();

  let totalAgg = 0;
  let totalWeight = 0;
  let totalAwareness = 0;
  let totalRiskTolerance = 0;
  let totalSpeed = 0;
  let totalSocialAffinity = 0;
  let totalEfficiency = 0;
  let defenderCount = 0;
  let farmerCount = 0;

  for (const m of members) {
    const weight = m.role === "attacker" ? 1.5 : m.id === society.leaderId ? 2.0 : 1.0;
    totalAgg += m.aggression * weight;
    totalWeight += weight;
    totalAwareness += m.awareness;
    totalRiskTolerance += m.riskTolerance;
    totalSpeed += m.speed;
    totalSocialAffinity += m.socialAffinity;
    totalEfficiency += m.efficiency;
    if (m.role === "defender") defenderCount++;
    if (m.role === "farmer") farmerCount++;
  }

  const n = members.length;
  const avgAgg = totalAgg / totalWeight;
  const avgAwareness = totalAwareness / n;
  const avgRiskTolerance = totalRiskTolerance / n;
  const avgSpeed = totalSpeed / n;
  const avgSocialAffinity = totalSocialAffinity / n;
  const avgEfficiency = totalEfficiency / n;
  const defenderRatio = defenderCount / n;
  const farmerRatio = farmerCount / n;

  // Territory growth rate: compare current to peak
  const territoryGrowthRate =
    society.peakTerritorySize > 0
      ? clamp(society.territorySize / society.peakTerritorySize, 0, 1)
      : 0.5;

  // Storage energy from structures
  let storageEnergy = 0;
  // We approximate: use sharedPool as proxy since we don't have world access here
  storageEnergy = society.sharedPool;

  return {
    aggression: clamp(avgAgg, 0, 1),
    defensiveness: clamp(
      avgAwareness * 0.4 + (1 - avgRiskTolerance) * 0.3 + defenderRatio * 0.3,
      0,
      1,
    ),
    expansiveness: clamp(
      (avgSpeed / 8) * 0.3 +
        territoryGrowthRate * 0.3 +
        avgSocialAffinity * 0.2 +
        (n / MAX_SOCIETY_SIZE) * 0.2,
      0,
      1,
    ),
    economicFocus: clamp(
      farmerRatio * 0.4 + avgEfficiency * 0.3 + clamp(storageEnergy / 200, 0, 1) * 0.3,
      0,
      1,
    ),
  };
}

function deriveSocietyStrategy(personality: SocietyPersonality, society: Society): SocietyStrategy {
  // Survival mode: lost significant territory and low resources
  if (
    society.peakTerritorySize > 0 &&
    society.territorySize < society.peakTerritorySize * 0.5 &&
    society.sharedPool < 50
  ) {
    return "consolidate";
  }

  // Pick highest personality axis
  const axes: [SocietyStrategy, number][] = [
    ["attack", personality.aggression],
    ["defend", personality.defensiveness],
    ["expand", personality.expansiveness],
    ["consolidate", personality.economicFocus],
  ];

  axes.sort((a, b) => b[1] - a[1]);
  return axes[0][0];
}

// --- Stability ---

function computeStabilityScore(society: Society, members: Organism[]): number {
  if (members.length === 0) return 0;

  // Resource depletion penalty
  const resourcePenalty = 1 - clamp(society.sharedPool / 100, 0, 1);

  // Territory loss penalty
  const territoryPenalty =
    society.peakTerritorySize > 0
      ? 1 - clamp(society.territorySize / society.peakTerritorySize, 0, 1)
      : 0;

  // Member loss penalty
  const memberPenalty =
    society.peakMemberCount > 0 ? 1 - clamp(members.length / society.peakMemberCount, 0, 1) : 0;

  // Energy variance penalty
  let totalEnergy = 0;
  for (const m of members) totalEnergy += m.energy;
  const avgEnergy = totalEnergy / members.length;
  let variance = 0;
  for (const m of members) {
    const diff = m.energy - avgEnergy;
    variance += diff * diff;
  }
  const stdDev = Math.sqrt(variance / members.length);
  const variancePenalty = avgEnergy > 0 ? clamp(stdDev / avgEnergy, 0, 1) : 1;

  // Overextension penalty
  const overextension = society.overextensionPenalty;

  return clamp(
    1 -
      (resourcePenalty * 0.25 +
        territoryPenalty * 0.25 +
        memberPenalty * 0.2 +
        variancePenalty * 0.15 +
        overextension * 0.15),
    0,
    1,
  );
}

// --- Leadership ---

function updateLeaderDirective(world: WorldState, society: Society): void {
  const leader = world.organisms.find(
    (o) => o.id === society.leaderId && o.societyId === society.id,
  );

  if (!leader) {
    society.leaderDirective = defaultDirective(world.tick);
    return;
  }

  const grid = world.territoryGrid;

  switch (society.strategy) {
    case "attack": {
      if (society.borderCells > 0 && grid) {
        // Find the highest-hostility neighboring society
        let targetSocietyId: number | undefined;
        let highestHostility = 0;
        for (const [sid, hostility] of society.rivalries) {
          if (hostility > highestHostility) {
            highestHostility = hostility;
            targetSocietyId = sid;
          }
        }
        // Find border direction toward target or any contested border
        const target = findBorderDirection(grid, society.id, society.centroidX, society.centroidY);
        if (target) {
          society.leaderDirective = {
            type: "target",
            targetX: target.x,
            targetY: target.y,
            targetSocietyId,
            issuedTick: world.tick,
          };
          return;
        }
      }
      society.leaderDirective = defaultDirective(world.tick);
      break;
    }
    case "defend": {
      if (society.borderCells > 0 && grid) {
        const border = findBorderDirection(grid, society.id, society.centroidX, society.centroidY);
        if (border) {
          society.leaderDirective = {
            type: "rally",
            targetX: border.x,
            targetY: border.y,
            issuedTick: world.tick,
          };
          return;
        }
      }
      society.leaderDirective = defaultDirective(world.tick);
      break;
    }
    case "expand": {
      if (grid) {
        const expansion = findExpansionTarget(
          grid,
          society.id,
          society.centroidX,
          society.centroidY,
        );
        if (expansion) {
          society.leaderDirective = {
            type: "target",
            targetX: expansion.x,
            targetY: expansion.y,
            issuedTick: world.tick,
          };
          return;
        }
      }
      society.leaderDirective = defaultDirective(world.tick);
      break;
    }
    case "consolidate":
    default:
      // If stability is very low, scatter
      if (society.stabilityScore < 0.15) {
        society.leaderDirective = { type: "scatter", issuedTick: world.tick };
      } else {
        society.leaderDirective = defaultDirective(world.tick);
      }
      break;
  }
}

// --- Rivalries ---

function updateRivalries(world: WorldState, society: Society): void {
  // Decay all existing rivalries
  for (const [sid, hostility] of society.rivalries) {
    const decayed = hostility - 0.005;
    if (decayed <= 0) {
      society.rivalries.delete(sid);
    } else {
      society.rivalries.set(sid, decayed);
    }
  }

  // Increment hostility based on border conflicts
  if (!world.territoryGrid) return;

  for (const other of world.societies) {
    if (other.id === society.id) continue;
    // Check if we share border cells
    if (society.borderCells === 0 && other.borderCells === 0) continue;

    // Count contested organisms between these two societies
    let conflictIntensity = 0;
    for (const org of world.organisms) {
      if (org.societyId !== society.id) continue;
      if (org.role !== "defender" && org.role !== "attacker") continue;
      const cellOwner = getCellOwner(world.territoryGrid, org.x, org.y);
      if (cellOwner === other.id) {
        conflictIntensity += 0.02;
      } else if (isContested(world.territoryGrid, org.x, org.y)) {
        conflictIntensity += 0.01;
      }
    }

    if (conflictIntensity > 0) {
      const current = society.rivalries.get(other.id) ?? 0;
      society.rivalries.set(other.id, clamp(current + conflictIntensity, 0, 1));
    }
  }
}

// --- History ---

function updateSocietyHistory(society: Society, tick: number): void {
  society.history.territorySamples.push(society.territorySize);
  if (society.history.territorySamples.length > 10) {
    society.history.territorySamples.shift();
  }

  if (society.power > society.history.peakPower) {
    society.history.peakPower = society.power;
    society.history.peakTick = tick;
  }

  const samples = society.history.territorySamples;
  if (samples.length >= 3) {
    const latest = samples[samples.length - 1];
    let prevAvg = 0;
    for (let i = 0; i < samples.length - 1; i++) prevAvg += samples[i];
    prevAvg /= samples.length - 1;

    society.history.isRising = latest > prevAvg;
    society.history.isFalling = latest < prevAvg * 0.7;
  }
}

// --- Role assignment ---

function evaluateRoles(world: WorldState): void {
  for (const society of world.societies) {
    const members = world.organisms.filter((o) => o.societyId === society.id);
    if (members.length === 0) continue;

    // Compute personality and strategy
    society.personality = computeSocietyPersonality(members, society);
    society.strategy = deriveSocietyStrategy(society.personality, society);

    // Update emblem border style based on strategy
    society.emblem.borderStyle =
      society.strategy === "defend" ? "double" : society.strategy === "expand" ? "dashed" : "solid";

    // Compute stability
    society.stabilityScore = computeStabilityScore(society, members);

    // Track peak member count
    if (members.length > society.peakMemberCount) {
      society.peakMemberCount = members.length;
    }

    const avgEnergy = society.totalEnergy / members.length || 1;

    // Score each member for each role
    const scores: Array<{ org: Organism; role: SocietyRole; score: number }> = [];

    for (const org of members) {
      const relEnergy = org.energy / avgEnergy;
      scores.push({
        org,
        role: "farmer",
        score: org.efficiency * (1 - org.aggression) * 0.5 + org.awareness * 0.2,
      });
      scores.push({
        org,
        role: "builder",
        score: org.efficiency * 0.4 + (1 - org.speed / 8) * 0.3 + org.socialAffinity * 0.3,
      });
      scores.push({
        org,
        role: "defender",
        score: org.aggression * 0.3 + org.awareness * 0.4 + org.riskTolerance * 0.3,
      });
      scores.push({
        org,
        role: "attacker",
        score: org.aggression * 0.4 + (org.speed / 8) * 0.3 + org.riskTolerance * 0.3,
      });
      if (members.length >= 5) {
        scores.push({
          org,
          role: "leader",
          score: (org.vision / 200) * 0.3 + org.awareness * 0.3 + relEnergy * 0.4,
        });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const assigned = new Set<number>();
    const roleCounts: Record<string, number> = {
      farmer: 0,
      builder: 0,
      defender: 0,
      attacker: 0,
      leader: 0,
    };

    // Strategy-dependent role limits
    const n = members.length;
    const maxLeaders = members.length >= 5 ? 1 : 0;
    let maxDefenders: number;
    let maxAttackers: number;
    let maxBuilders: number;

    switch (society.strategy) {
      case "attack":
        maxAttackers = Math.max(1, Math.floor(n * 0.3));
        maxDefenders = Math.max(1, Math.floor(n * 0.15));
        maxBuilders = Math.max(0, Math.floor(n * 0.1));
        break;
      case "defend":
        maxAttackers = 0;
        maxDefenders = Math.max(1, Math.floor(n * 0.35));
        maxBuilders = Math.max(1, Math.floor(n * 0.15));
        break;
      case "expand":
        maxAttackers = Math.max(0, Math.floor(n * 0.15));
        maxDefenders = Math.max(1, Math.floor(n * 0.15));
        maxBuilders = Math.max(1, Math.floor(n * 0.3));
        break;
      case "consolidate":
      default:
        maxAttackers = Math.max(0, Math.floor(n * 0.05));
        maxDefenders = Math.max(1, Math.floor(n * 0.15));
        maxBuilders = Math.max(1, Math.floor(n * 0.15));
        break;
    }

    const roleLimits: Record<string, number> = {
      leader: maxLeaders,
      defender: maxDefenders,
      attacker: maxAttackers,
      builder: maxBuilders,
      farmer: n,
    };

    for (const { org, role } of scores) {
      if (assigned.has(org.id)) continue;
      if (roleCounts[role] >= roleLimits[role]) continue;
      org.role = role;
      assigned.add(org.id);
      roleCounts[role]++;
    }

    // Anyone unassigned becomes farmer
    for (const org of members) {
      if (!assigned.has(org.id)) {
        org.role = "farmer";
      }
    }

    // Cache leader ID
    const leader = members.find((m) => m.role === "leader");
    society.leaderId = leader?.id ?? null;

    // Update leader directive
    updateLeaderDirective(world, society);

    // Update rivalries
    updateRivalries(world, society);
  }
}

// --- Cooperation ---

function applySocietyCooperation(world: WorldState): void {
  for (const society of world.societies) {
    const members = world.organisms.filter((o) => o.societyId === society.id);
    if (members.length === 0) continue;

    // Update cached values
    let totalEnergy = 0;
    let cx = 0;
    let cy = 0;
    for (const m of members) {
      totalEnergy += m.energy;
      cx += m.x;
      cy += m.y;
    }
    society.totalEnergy = totalEnergy;
    society.centroidX = cx / members.length;
    society.centroidY = cy / members.length;

    const avgEnergy = totalEnergy / members.length;

    // Territory decline: drain shared pool when territory shrinks significantly
    if (society.peakTerritorySize > 0 && society.territorySize < society.peakTerritorySize * 0.3) {
      society.sharedPool *= 0.99;
    }

    // Overextension drain
    if (society.overextensionPenalty > 0.3) {
      society.sharedPool -= 0.5 * society.overextensionPenalty;
      if (society.sharedPool < 0) society.sharedPool = 0;
    }

    // Golden age / Decline modifiers
    const isGoldenAge =
      society.history.isRising && society.stabilityScore > 0.7 && members.length > 10;
    const isInDecline = society.history.isFalling && society.stabilityScore < 0.5;

    // Energy pooling
    for (const org of members) {
      if (org.energy > avgEnergy * 0.6) {
        const excess = org.energy - avgEnergy * 0.6;
        const contribution = excess * 0.02;
        org.energy -= contribution;
        society.sharedPool += contribution;
      } else if (org.energy < avgEnergy * 0.4 && society.sharedPool > 0) {
        const draw = Math.min(1, society.sharedPool);
        org.energy += draw;
        society.sharedPool -= draw;
      }

      // Golden age: 10% metabolism reduction (applied as energy bonus)
      if (isGoldenAge) {
        org.energy += org.metabolism * 0.1;
      }
      // Decline: 5% metabolism increase (applied as energy drain)
      if (isInDecline) {
        org.energy -= org.metabolism * 0.05;
      }
    }

    // Centroid attraction (5% bias toward centroid)
    for (const org of members) {
      const dx = society.centroidX - org.x;
      const dy = society.centroidY - org.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        org.vx += (dx / dist) * org.speed * 0.05;
        org.vy += (dy / dist) * org.speed * 0.05;
      }
    }

    // Directive-aware steering (replaces old simple leader heading influence)
    const directive = society.leaderDirective;
    if (directive.type === "rally" && directive.targetX != null && directive.targetY != null) {
      // Rally: all members get 15% bias toward rally point
      for (const org of members) {
        if (org.id === society.leaderId) continue;
        const dx = directive.targetX - org.x;
        const dy = directive.targetY - org.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          org.vx += (dx / dist) * org.speed * 0.15;
          org.vy += (dy / dist) * org.speed * 0.15;
        }
      }
    } else if (
      directive.type === "target" &&
      directive.targetX != null &&
      directive.targetY != null
    ) {
      // Target: attackers 20% bias toward target, others 5% centroid bias (already applied)
      for (const org of members) {
        if (org.id === society.leaderId) continue;
        if (org.role === "attacker" || org.role === "defender") {
          const dx = directive.targetX - org.x;
          const dy = directive.targetY - org.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            const strength = org.role === "attacker" ? 0.2 : 0.1;
            org.vx += (dx / dist) * org.speed * strength;
            org.vy += (dy / dist) * org.speed * strength;
          }
        }
      }
    } else if (directive.type === "scatter") {
      // Scatter: 10% centrifugal bias from centroid
      for (const org of members) {
        const dx = org.x - society.centroidX;
        const dy = org.y - society.centroidY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          org.vx += (dx / dist) * org.speed * 0.1;
          org.vy += (dy / dist) * org.speed * 0.1;
        }
      }
    }
    // "idle" — no extra steering beyond centroid attraction

    // Social alarm: fleeing defenders trigger nearby low-awareness members to flee
    for (const org of members) {
      if (org.role === "defender" && org.state === "FLEEING") {
        for (const other of members) {
          if (other.id === org.id) continue;
          if (other.awareness < 0.4 && other.state === "FORAGING") {
            const d = distSq(org.x, org.y, other.x, other.y);
            if (d < org.vision * org.vision * 0.25) {
              other.state = "FLEEING";
            }
          }
        }
      }
    }
  }
}

// --- Independence cooldown tick ---

function tickIndependenceCooldowns(world: WorldState): void {
  for (const org of world.organisms) {
    if (org.independenceCooldown > 0) {
      org.independenceCooldown--;
    }
  }
}

// --- Centroid helper ---

function updateSocietyCentroid(society: Society, members: Organism[]): void {
  if (members.length === 0) return;
  let cx = 0;
  let cy = 0;
  let totalEnergy = 0;
  for (const m of members) {
    cx += m.x;
    cy += m.y;
    totalEnergy += m.energy;
  }
  society.centroidX = cx / members.length;
  society.centroidY = cy / members.length;
  society.totalEnergy = totalEnergy;
}

// --- Main entry point ---

export function updateSocieties(
  world: WorldState,
  config: SimulationConfig,
  orgGrid: SpatialGrid,
): void {
  // Tick independence cooldowns
  tickIndependenceCooldowns(world);

  // Formation and joining run every 5 ticks for performance
  if (world.tick % 5 === 0) {
    tryFormSocieties(world, config, orgGrid);
    tryJoinSocieties(world, config, orgGrid);
  }

  // Leaving checks every tick
  processLeaving(world);

  // War zone refugees every tick
  processWarZoneRefugees(world);

  // Role assignment, personality, strategy, leadership every 20 ticks
  if (world.tick % 20 === 0) {
    evaluateRoles(world);
  }

  // History tracking every 50 ticks
  if (world.tick % 50 === 0) {
    for (const society of world.societies) {
      updateSocietyHistory(society, world.tick);
    }
  }

  // Cooperation every tick
  applySocietyCooperation(world);

  // Dissolution and collapse check
  dissolveSocieties(world, config);
}

// --- Helpers exported for use in organism.ts ---

export function getSociety(world: WorldState, societyId: number | null): Society | undefined {
  if (societyId === null) return undefined;
  return world.societies.find((s) => s.id === societyId);
}

export function countDefendersNear(
  world: WorldState,
  societyId: number,
  x: number,
  y: number,
  radius: number,
): number {
  let count = 0;
  const rSq = radius * radius;
  for (const org of world.organisms) {
    if (org.societyId === societyId && org.role === "defender") {
      if (distSq(org.x, org.y, x, y) < rSq) count++;
    }
  }
  return count;
}
