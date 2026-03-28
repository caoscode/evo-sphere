import type { Organism, SimulationConfig, Society, SocietyRole, WorldState } from "./types";
import { type SpatialGrid, distSq } from "./spatial-grid";
import {
  MAX_SOCIETY_SIZE,
  SOCIETY_FORM_TICKS,
  SOCIETY_JOIN_TICKS,
  SOCIETY_LEAVE_DISTANCE,
  TRAIT_RANGES,
} from "./config";

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
  // Shift hue to distinguish from individual coloring (offset by 30 degrees)
  return ((1 - norm) * 240 + 30) % 360;
}

// --- Society formation ---

function tryFormSocieties(world: WorldState, config: SimulationConfig, orgGrid: SpatialGrid): void {
  const radius = config.societyFormationRadius;
  const radiusSq = radius * radius;

  // Step 1: Increment proximity timers for all eligible organisms near other eligible organisms
  for (const org of world.organisms) {
    if (org.societyId !== null || org.socialAffinity <= 0.3) continue;

    const nearbyIndices = orgGrid.query(org.x, org.y, radius);
    let eligibleNeighbors = 0;
    for (const idx of nearbyIndices) {
      const other = world.organisms[idx];
      if (!other || other.id === org.id || other.societyId !== null) continue;
      if (other.socialAffinity <= 0.3) continue;
      const d = distSq(org.x, org.y, other.x, other.y);
      if (d < radiusSq) eligibleNeighbors++;
    }

    if (eligibleNeighbors >= config.minSocietySize - 1) {
      // Has enough neighbors — accumulate timer
      org.proximityTimer++;
    } else {
      // Isolated — decay timer slowly (don't hard reset so progress isn't totally lost)
      org.proximityTimer = Math.max(0, org.proximityTimer - 1);
    }
  }

  // Step 2: Find organisms ready to form (timer reached threshold)
  const ready = new Set<number>();
  for (const org of world.organisms) {
    if (org.societyId !== null) continue;
    if (org.proximityTimer >= SOCIETY_FORM_TICKS) {
      ready.add(org.id);
    }
  }

  if (ready.size < config.minSocietySize) return;

  // Step 3: Cluster ready organisms into societies
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
      // Not enough ready neighbors — unclaim
      for (const m of cluster) claimed.delete(m.id);
      continue;
    }

    // Form society
    const society: Society = {
      id: world.nextSocietyId++,
      memberIds: new Set(cluster.map((m) => m.id)),
      foundedTick: world.tick,
      centroidX: 0,
      centroidY: 0,
      hue: averageMetabolismHue(cluster),
      totalEnergy: 0,
      structureIds: new Set(),
      sharedPool: 0,
    };

    for (const member of cluster) {
      member.societyId = society.id;
      member.proximityTimer = 0;
    }

    updateSocietyCentroid(society, cluster);
    world.societies.push(society);
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

    // Find nearest society centroid within range
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

    // Check trait compatibility with society members
    const members = world.organisms.filter((o) => bestSociety!.memberIds.has(o.id));
    if (members.length === 0) continue;

    let compatSum = 0;
    for (const member of members) compatSum += traitCompatibility(org, member);
    if (compatSum / members.length < 0.25) continue;

    // Join
    org.societyId = bestSociety.id;
    org.proximityTimer = 0;
    bestSociety.memberIds.add(org.id);
  }
}

// --- Leaving ---

function processLeaving(world: WorldState): void {
  for (const society of world.societies) {
    // Compute average energy for the society
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
      if (org.energy < avgEnergy * 0.2) {
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

function removeMember(org: Organism, society: Society): void {
  org.societyId = null;
  org.role = "none";
  org.proximityTimer = 0;
  society.memberIds.delete(org.id);
}

// --- Dissolution ---

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

    if (livingMembers < config.minSocietySize) {
      // Release all members
      for (const org of world.organisms) {
        if (org.societyId === society.id) {
          org.societyId = null;
          org.role = "none";
          org.proximityTimer = 0;
        }
      }
      // Mark structures for fast decay (handled in infrastructure.ts)
      for (const sid of society.structureIds) {
        const structure = world.structures.find((s) => s.id === sid);
        if (structure) structure.societyId = -1; // orphaned
      }
      // Remove society
      world.societies[i] = world.societies[world.societies.length - 1];
      world.societies.pop();
    }
  }
}

// --- Role assignment ---

function evaluateRoles(world: WorldState): void {
  for (const society of world.societies) {
    const members = world.organisms.filter((o) => o.societyId === society.id);
    if (members.length === 0) continue;

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

    // Greedy assignment: highest scores first
    scores.sort((a, b) => b.score - a.score);
    const assigned = new Set<number>();
    const roleCounts: Record<string, number> = {
      farmer: 0,
      builder: 0,
      defender: 0,
      attacker: 0,
      leader: 0,
    };

    // Target distribution based on society size
    const n = members.length;
    const maxLeaders = members.length >= 5 ? 1 : 0;
    const maxDefenders = Math.max(1, Math.floor(n * 0.2));
    const maxAttackers = Math.max(0, Math.floor(n * 0.15));
    const maxBuilders = Math.max(1, Math.floor(n * 0.2));
    // Farmers get the rest

    const roleLimits: Record<string, number> = {
      leader: maxLeaders,
      defender: maxDefenders,
      attacker: maxAttackers,
      builder: maxBuilders,
      farmer: n, // unlimited
    };

    for (const { org, role, score: _score } of scores) {
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

    // Energy pooling
    for (const org of members) {
      if (org.energy > avgEnergy * 0.6) {
        // Contribute 2% of excess to shared pool
        const excess = org.energy - avgEnergy * 0.6;
        const contribution = excess * 0.02;
        org.energy -= contribution;
        society.sharedPool += contribution;
      } else if (org.energy < avgEnergy * 0.4 && society.sharedPool > 0) {
        // Draw from pool (up to 1 energy/tick)
        const draw = Math.min(1, society.sharedPool);
        org.energy += draw;
        society.sharedPool -= draw;
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

    // Leader influence: members steer 10% toward leader's heading
    const leader = members.find((m) => m.role === "leader");
    if (leader) {
      const leaderVLen = Math.sqrt(leader.vx * leader.vx + leader.vy * leader.vy);
      if (leaderVLen > 0.1) {
        const ldx = leader.vx / leaderVLen;
        const ldy = leader.vy / leaderVLen;
        for (const org of members) {
          if (org.id === leader.id) continue;
          const d = distSq(org.x, org.y, leader.x, leader.y);
          if (d < leader.vision * leader.vision) {
            org.vx += ldx * org.speed * 0.1;
            org.vy += ldy * org.speed * 0.1;
          }
        }
      }
    }

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
  // Formation and joining run every 5 ticks for performance
  if (world.tick % 5 === 0) {
    tryFormSocieties(world, config, orgGrid);
    tryJoinSocieties(world, config, orgGrid);
  }

  // Leaving checks every tick
  processLeaving(world);

  // Role assignment every 20 ticks
  if (world.tick % 20 === 0) {
    evaluateRoles(world);
  }

  // Cooperation every tick
  applySocietyCooperation(world);

  // Dissolution check
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
