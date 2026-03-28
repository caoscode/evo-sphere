export class SpatialGrid {
  private cellSize: number;
  private cells: Map<number, number[]>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear(): void {
    this.cells.clear();
  }

  private key(col: number, row: number): number {
    // Cantor pairing — works for negative coordinates via offset
    const a = col >= 0 ? col * 2 : -col * 2 - 1;
    const b = row >= 0 ? row * 2 : -row * 2 - 1;
    return ((a + b) * (a + b + 1)) / 2 + b;
  }

  insert(x: number, y: number, index: number): void {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    const k = this.key(col, row);
    const cell = this.cells.get(k);
    if (cell) {
      cell.push(index);
    } else {
      this.cells.set(k, [index]);
    }
  }

  query(x: number, y: number, radius: number): number[] {
    const result: number[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCol = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);

    for (let dr = -cellRadius; dr <= cellRadius; dr++) {
      for (let dc = -cellRadius; dc <= cellRadius; dc++) {
        const k = this.key(centerCol + dc, centerRow + dr);
        const cell = this.cells.get(k);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            result.push(cell[i]);
          }
        }
      }
    }

    return result;
  }
}

export function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

export function direction(from: number, to: number): number {
  return to - from;
}
