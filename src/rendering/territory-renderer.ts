import type { Society, TerritoryGrid } from "../simulation/types";
import { INFLUENCE_CONTEST_RATIO } from "../simulation/config";

export interface TerritoryBuffer {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  lastUpdateTick: number;
}

export function createTerritoryBuffer(): TerritoryBuffer {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx, lastUpdateTick: -1 };
}

function hueToRgb(hue: number): { r: number; g: number; b: number } {
  const h = ((hue % 360) + 360) % 360;
  const s = 0.6;
  const l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function updateTerritoryBuffer(
  buffer: TerritoryBuffer,
  grid: TerritoryGrid,
  societies: Society[],
  tick: number,
): void {
  if (tick === buffer.lastUpdateTick) return;
  buffer.lastUpdateTick = tick;

  const { cols, rows } = grid;

  // Resize canvas if needed (use 2x for slightly smoother interpolation)
  const scale = 2;
  const w = cols * scale;
  const h = rows * scale;
  if (buffer.canvas.width !== w || buffer.canvas.height !== h) {
    buffer.canvas.width = w;
    buffer.canvas.height = h;
  }

  const ctx = buffer.ctx;
  ctx.clearRect(0, 0, w, h);

  // Build hue lookup
  const hueMap = new Map<number, { r: number; g: number; b: number }>();
  for (const s of societies) {
    hueMap.set(s.id, hueToRgb(s.hue));
  }

  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const owner = grid.owner[idx];
      if (owner === -1) continue;

      const rgb = hueMap.get(owner);
      if (!rgb) continue;

      const contest = grid.contestLevel[idx];
      const isContested = contest >= INFLUENCE_CONTEST_RATIO;

      // Base alpha: owned territory is subtle, contested is brighter
      let alpha: number;
      if (isContested) {
        alpha = 0.12 + contest * 0.08;
      } else {
        alpha = 0.06 + (1 - contest) * 0.04;
      }

      // Convert alpha to 0-255
      const a = Math.round(alpha * 255);

      // Paint the scale x scale block
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = c * scale + sx;
          const py = r * scale + sy;
          const pi = (py * w + px) * 4;
          data[pi] = rgb.r;
          data[pi + 1] = rgb.g;
          data[pi + 2] = rgb.b;
          data[pi + 3] = a;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Draw border lines on top
  ctx.lineWidth = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const owner = grid.owner[idx];
      if (owner === -1) continue;

      const rgb = hueMap.get(owner);
      if (!rgb) continue;

      // Check right neighbor
      if (c < cols - 1) {
        const rightOwner = grid.owner[idx + 1];
        if (rightOwner !== -1 && rightOwner !== owner) {
          const rightRgb = hueMap.get(rightOwner);
          // Draw border line at right edge
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
          ctx.beginPath();
          ctx.moveTo((c + 1) * scale, r * scale);
          ctx.lineTo((c + 1) * scale, (r + 1) * scale);
          ctx.stroke();
          if (rightRgb) {
            ctx.strokeStyle = `rgba(${rightRgb.r}, ${rightRgb.g}, ${rightRgb.b}, 0.35)`;
            ctx.beginPath();
            ctx.moveTo((c + 1) * scale + 0.5, r * scale);
            ctx.lineTo((c + 1) * scale + 0.5, (r + 1) * scale);
            ctx.stroke();
          }
        }
      }

      // Check bottom neighbor
      if (r < rows - 1) {
        const bottomOwner = grid.owner[(r + 1) * cols + c];
        if (bottomOwner !== -1 && bottomOwner !== owner) {
          const bottomRgb = hueMap.get(bottomOwner);
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
          ctx.beginPath();
          ctx.moveTo(c * scale, (r + 1) * scale);
          ctx.lineTo((c + 1) * scale, (r + 1) * scale);
          ctx.stroke();
          if (bottomRgb) {
            ctx.strokeStyle = `rgba(${bottomRgb.r}, ${bottomRgb.g}, ${bottomRgb.b}, 0.35)`;
            ctx.beginPath();
            ctx.moveTo(c * scale, (r + 1) * scale + 0.5);
            ctx.lineTo((c + 1) * scale, (r + 1) * scale + 0.5);
            ctx.stroke();
          }
        }
      }
    }
  }
}

type ViewBounds = { minX: number; minY: number; maxX: number; maxY: number };

export function drawTerritoryOverlay(
  ctx: CanvasRenderingContext2D,
  buffer: TerritoryBuffer,
  grid: TerritoryGrid,
  _vb: ViewBounds,
  zoom: number,
): void {
  if (zoom < 0.08) return;
  if (buffer.lastUpdateTick < 0) return;

  const worldW = grid.cols * grid.cellSize;
  const worldH = grid.rows * grid.cellSize;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";
  ctx.drawImage(buffer.canvas as HTMLCanvasElement, grid.originX, grid.originY, worldW, worldH);
  ctx.restore();
}
