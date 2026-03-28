export class SpatialGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private cells: number[][];

  constructor(worldWidth: number, worldHeight: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear(): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].length = 0;
    }
  }

  insert(x: number, y: number, index: number): void {
    const col = Math.floor(x / this.cellSize) % this.cols;
    const row = Math.floor(y / this.cellSize) % this.rows;
    this.cells[row * this.cols + col].push(index);
  }

  query(x: number, y: number, radius: number): number[] {
    const result: number[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCol = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);

    for (let dr = -cellRadius; dr <= cellRadius; dr++) {
      for (let dc = -cellRadius; dc <= cellRadius; dc++) {
        const col = (((centerCol + dc) % this.cols) + this.cols) % this.cols;
        const row = (((centerRow + dr) % this.rows) + this.rows) % this.rows;
        const cell = this.cells[row * this.cols + col];
        for (let i = 0; i < cell.length; i++) {
          result.push(cell[i]);
        }
      }
    }

    return result;
  }
}

export function wrapDist(a: number, b: number, size: number): number {
  const d = Math.abs(a - b);
  return d > size / 2 ? size - d : d;
}

export function wrapDistSq(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  h: number,
): number {
  const dx = wrapDist(x1, x2, w);
  const dy = wrapDist(y1, y2, h);
  return dx * dx + dy * dy;
}

export function wrapDirection(from: number, to: number, size: number): number {
  const d = to - from;
  if (Math.abs(d) <= size / 2) return d;
  return d > 0 ? d - size : d + size;
}
