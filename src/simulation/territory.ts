import type { Society, TerritoryGrid, WorldState } from "./types";
import type { SpatialGrid } from "./spatial-grid";
import { distSq } from "./spatial-grid";
import { foodDensityAt } from "./terrain";
import {
  TERRITORY_CELL_SIZE,
  INFLUENCE_MEMBER_BASE,
  INFLUENCE_STRUCTURE_HOME,
  INFLUENCE_STRUCTURE_STORAGE,
  INFLUENCE_STRUCTURE_FARM,
  INFLUENCE_DECAY_RATE,
  INFLUENCE_CLAIM_THRESHOLD,
  INFLUENCE_CONTEST_RATIO,
  BORDER_SKIRMISH_RANGE,
} from "./config";

const MEMBER_STAMP_RADIUS = 5; // cells
const STRUCTURE_STAMP_RADIUS = 7; // cells
const GRID_MARGIN = 400;

export function createTerritoryGrid(world: WorldState): TerritoryGrid {
  const originX = -world.width / 2 - GRID_MARGIN;
  const originY = -world.height / 2 - GRID_MARGIN;
  const totalW = world.width + GRID_MARGIN * 2;
  const totalH = world.height + GRID_MARGIN * 2;
  const cols = Math.ceil(totalW / TERRITORY_CELL_SIZE);
  const rows = Math.ceil(totalH / TERRITORY_CELL_SIZE);
  const totalCells = cols * rows;

  return {
    originX,
    originY,
    cols,
    rows,
    cellSize: TERRITORY_CELL_SIZE,
    influence: new Map(),
    owner: new Int16Array(totalCells).fill(-1),
    contestLevel: new Float32Array(totalCells),
  };
}

function worldToCell(grid: TerritoryGrid, wx: number, wy: number): { col: number; row: number } {
  return {
    col: Math.floor((wx - grid.originX) / grid.cellSize),
    row: Math.floor((wy - grid.originY) / grid.cellSize),
  };
}

function cellToWorld(grid: TerritoryGrid, col: number, row: number): { x: number; y: number } {
  return {
    x: grid.originX + (col + 0.5) * grid.cellSize,
    y: grid.originY + (row + 0.5) * grid.cellSize,
  };
}

function cellIndex(grid: TerritoryGrid, col: number, row: number): number {
  return row * grid.cols + col;
}

function inBounds(grid: TerritoryGrid, col: number, row: number): boolean {
  return col >= 0 && col < grid.cols && row >= 0 && row < grid.rows;
}

function getOrCreateInfluence(grid: TerritoryGrid, societyId: number): Float32Array {
  let arr = grid.influence.get(societyId);
  if (!arr) {
    arr = new Float32Array(grid.cols * grid.rows);
    grid.influence.set(societyId, arr);
  }
  return arr;
}

function stampInfluence(
  arr: Float32Array,
  grid: TerritoryGrid,
  wx: number,
  wy: number,
  base: number,
  radius: number,
): void {
  const { col: cx, row: cy } = worldToCell(grid, wx, wy);
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const c = cx + dc;
      const r = cy + dr;
      if (!inBounds(grid, c, r)) continue;
      const dist = Math.max(Math.abs(dc), Math.abs(dr)); // Chebyshev distance
      const value = base * Math.max(0, 1 - dist * INFLUENCE_DECAY_RATE);
      if (value > 0) {
        arr[cellIndex(grid, c, r)] += value;
      }
    }
  }
}

export function updateTerritoryGrid(grid: TerritoryGrid, world: WorldState): void {
  const activeSocietyIds = new Set<number>();

  // Clear influence for all known societies
  for (const [id, arr] of grid.influence) {
    arr.fill(0);
    activeSocietyIds.add(id);
  }

  // Stamp influence from members
  for (const society of world.societies) {
    activeSocietyIds.add(society.id);
    const arr = getOrCreateInfluence(grid, society.id);
    for (const org of world.organisms) {
      if (org.societyId === society.id) {
        stampInfluence(arr, grid, org.x, org.y, INFLUENCE_MEMBER_BASE, MEMBER_STAMP_RADIUS);
      }
    }
  }

  // Stamp influence from structures
  for (const structure of world.structures) {
    if (structure.societyId === -1) continue; // orphaned
    if (structure.buildProgress < 1) continue; // not yet built
    const arr = grid.influence.get(structure.societyId);
    if (!arr) continue;
    let base: number;
    switch (structure.type) {
      case "home":
        base = INFLUENCE_STRUCTURE_HOME;
        break;
      case "storage":
        base = INFLUENCE_STRUCTURE_STORAGE;
        break;
      case "farm":
        base = INFLUENCE_STRUCTURE_FARM;
        break;
    }
    stampInfluence(arr, grid, structure.x, structure.y, base, STRUCTURE_STAMP_RADIUS);
  }

  // Remove influence arrays for dissolved societies
  for (const id of activeSocietyIds) {
    if (!world.societies.some((s) => s.id === id)) {
      grid.influence.delete(id);
    }
  }

  // Derive ownership and contest level
  const totalCells = grid.cols * grid.rows;
  grid.owner.fill(-1);
  grid.contestLevel.fill(0);

  // Collect active society influence arrays for fast iteration
  const societyEntries: Array<{ id: number; arr: Float32Array }> = [];
  for (const [id, arr] of grid.influence) {
    societyEntries.push({ id, arr });
  }

  for (let i = 0; i < totalCells; i++) {
    let bestId = -1;
    let bestVal = 0;
    let secondVal = 0;

    for (const { id, arr } of societyEntries) {
      const val = arr[i];
      if (val > bestVal) {
        secondVal = bestVal;
        bestVal = val;
        bestId = id;
      } else if (val > secondVal) {
        secondVal = val;
      }
    }

    if (bestVal >= INFLUENCE_CLAIM_THRESHOLD) {
      grid.owner[i] = bestId;
      grid.contestLevel[i] = bestVal > 0 ? secondVal / bestVal : 0;
    }
  }

  // Update territory stats per society
  // Reset stats
  for (const society of world.societies) {
    society.territorySize = 0;
    society.territoryValue = 0;
    society.borderCells = 0;
  }

  const societyMap = new Map<number, Society>();
  for (const s of world.societies) societyMap.set(s.id, s);

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const idx = cellIndex(grid, c, r);
      const ownerId = grid.owner[idx];
      if (ownerId === -1) continue;

      const society = societyMap.get(ownerId);
      if (!society) continue;

      society.territorySize++;
      const { x, y } = cellToWorld(grid, c, r);
      society.territoryValue += foodDensityAt(x, y);

      // Check if border cell (adjacent to different owner)
      for (const [dc, dr] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nc = c + dc;
        const nr = r + dr;
        if (!inBounds(grid, nc, nr)) continue;
        const neighborOwner = grid.owner[cellIndex(grid, nc, nr)];
        if (neighborOwner !== -1 && neighborOwner !== ownerId) {
          society.borderCells++;
          break;
        }
      }
    }
  }

  // Update power and peak territory
  for (const society of world.societies) {
    society.power =
      society.memberIds.size * 2 +
      society.structureIds.size * 5 +
      society.territorySize * 0.5 +
      society.totalEnergy * 0.01;
    if (society.territorySize > society.peakTerritorySize) {
      society.peakTerritorySize = society.territorySize;
    }
  }
}

export function getCellOwner(grid: TerritoryGrid, x: number, y: number): number {
  const { col, row } = worldToCell(grid, x, y);
  if (!inBounds(grid, col, row)) return -1;
  return grid.owner[cellIndex(grid, col, row)];
}

export function isContested(grid: TerritoryGrid, x: number, y: number): boolean {
  const { col, row } = worldToCell(grid, x, y);
  if (!inBounds(grid, col, row)) return false;
  return grid.contestLevel[cellIndex(grid, col, row)] >= INFLUENCE_CONTEST_RATIO;
}

export function findBorderDirection(
  grid: TerritoryGrid,
  societyId: number,
  fromX: number,
  fromY: number,
): { x: number; y: number } | null {
  const { col: cx, row: cy } = worldToCell(grid, fromX, fromY);
  const searchRadius = 8;
  let bestDist = Infinity;
  let bestCol = -1;
  let bestRow = -1;

  for (let dr = -searchRadius; dr <= searchRadius; dr++) {
    for (let dc = -searchRadius; dc <= searchRadius; dc++) {
      const c = cx + dc;
      const r = cy + dr;
      if (!inBounds(grid, c, r)) continue;
      const idx = cellIndex(grid, c, r);
      if (grid.owner[idx] !== societyId) continue;

      // Check if this cell is a border cell
      let isBorder = false;
      for (const [ndc, ndr] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nc = c + ndc;
        const nr = r + ndr;
        if (!inBounds(grid, nc, nr)) continue;
        const neighborOwner = grid.owner[cellIndex(grid, nc, nr)];
        if (neighborOwner !== -1 && neighborOwner !== societyId) {
          isBorder = true;
          break;
        }
      }
      if (!isBorder) continue;

      const dist = dc * dc + dr * dr;
      if (dist < bestDist) {
        bestDist = dist;
        bestCol = c;
        bestRow = r;
      }
    }
  }

  if (bestCol === -1) return null;
  const target = cellToWorld(grid, bestCol, bestRow);
  return { x: target.x, y: target.y };
}

export function findExpansionTarget(
  grid: TerritoryGrid,
  societyId: number,
  fromX: number,
  fromY: number,
): { x: number; y: number } | null {
  const { col: cx, row: cy } = worldToCell(grid, fromX, fromY);
  const searchRadius = 10;
  let bestValue = 0;
  let bestCol = -1;
  let bestRow = -1;

  for (let dr = -searchRadius; dr <= searchRadius; dr++) {
    for (let dc = -searchRadius; dc <= searchRadius; dc++) {
      const c = cx + dc;
      const r = cy + dr;
      if (!inBounds(grid, c, r)) continue;
      const idx = cellIndex(grid, c, r);
      const owner = grid.owner[idx];

      // Target unclaimed or weakly contested cells
      if (owner !== -1 && owner !== societyId) continue;
      if (owner === societyId) continue; // already ours

      // Must be adjacent to our territory
      let adjacentToOurs = false;
      for (const [ndc, ndr] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nc = c + ndc;
        const nr = r + ndr;
        if (!inBounds(grid, nc, nr)) continue;
        if (grid.owner[cellIndex(grid, nc, nr)] === societyId) {
          adjacentToOurs = true;
          break;
        }
      }
      if (!adjacentToOurs) continue;

      const { x, y } = cellToWorld(grid, c, r);
      const value = foodDensityAt(x, y);
      if (value > bestValue) {
        bestValue = value;
        bestCol = c;
        bestRow = r;
      }
    }
  }

  if (bestCol === -1) return null;
  const target = cellToWorld(grid, bestCol, bestRow);
  return { x: target.x, y: target.y };
}

export function findInvasionTarget(
  grid: TerritoryGrid,
  societyId: number,
  fromX: number,
  fromY: number,
): { x: number; y: number } | null {
  const { col: cx, row: cy } = worldToCell(grid, fromX, fromY);
  const searchRadius = 10;
  let bestContest = 0;
  let bestCol = -1;
  let bestRow = -1;

  for (let dr = -searchRadius; dr <= searchRadius; dr++) {
    for (let dc = -searchRadius; dc <= searchRadius; dc++) {
      const c = cx + dc;
      const r = cy + dr;
      if (!inBounds(grid, c, r)) continue;
      const idx = cellIndex(grid, c, r);
      const owner = grid.owner[idx];

      // Target enemy cells adjacent to our territory
      if (owner === -1 || owner === societyId) continue;

      let adjacentToOurs = false;
      for (const [ndc, ndr] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nc = c + ndc;
        const nr = r + ndr;
        if (!inBounds(grid, nc, nr)) continue;
        if (grid.owner[cellIndex(grid, nc, nr)] === societyId) {
          adjacentToOurs = true;
          break;
        }
      }
      if (!adjacentToOurs) continue;

      const contest = grid.contestLevel[idx];
      if (contest > bestContest) {
        bestContest = contest;
        bestCol = c;
        bestRow = r;
      }
    }
  }

  if (bestCol === -1) return null;
  const target = cellToWorld(grid, bestCol, bestRow);
  return { x: target.x, y: target.y };
}

export function processBorderConflicts(world: WorldState, orgGrid: SpatialGrid): void {
  const grid = world.territoryGrid;
  if (!grid) return;

  const rangeSq = BORDER_SKIRMISH_RANGE * BORDER_SKIRMISH_RANGE;

  for (const org of world.organisms) {
    if (org.societyId === null) continue;
    if (org.role !== "defender" && org.role !== "attacker") continue;

    const { col, row } = worldToCell(grid, org.x, org.y);
    if (!inBounds(grid, col, row)) continue;
    const idx = cellIndex(grid, col, row);

    // Only process if in contested or enemy territory
    const cellOwner = grid.owner[idx];
    const isContested = grid.contestLevel[idx] >= INFLUENCE_CONTEST_RATIO;
    const inEnemyTerritory = cellOwner !== -1 && cellOwner !== org.societyId;

    if (!isContested && !inEnemyTerritory) continue;

    // Find nearby enemy organisms
    const nearby = orgGrid.query(org.x, org.y, BORDER_SKIRMISH_RANGE);
    for (const ni of nearby) {
      const other = world.organisms[ni];
      if (!other || other.id === org.id) continue;
      if (other.societyId === null || other.societyId === org.societyId) continue;
      if (distSq(org.x, org.y, other.x, other.y) >= rangeSq) continue;

      // Attrition: both lose energy based on opponent's aggression
      let damage = 0.5 * other.aggression;

      // Defenders in own territory get 20% reduction
      if (org.role === "defender" && cellOwner === org.societyId) {
        damage *= 0.8;
      }
      // Attackers in enemy territory get 10% boost to their damage output
      // (applied to the opponent's damage calculation, so reduce our damage taken)
      if (org.role === "attacker" && inEnemyTerritory) {
        damage *= 0.9;
      }

      org.energy -= damage;
    }
  }
}
