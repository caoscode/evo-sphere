import type { Organism, WorldState } from "../simulation/types";
import { energyToRadius } from "./visual-encoding";
import { roleToColor } from "./visual-encoding";

type ViewBounds = { minX: number; minY: number; maxX: number; maxY: number };

// --- Society territories ---

export function drawSocietyConnections(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  vb: ViewBounds,
  zoom: number,
): void {
  if (zoom < 0.3) return;

  for (const society of world.societies) {
    const members = world.organisms.filter((o) => o.societyId === society.id);
    if (members.length === 0) continue;

    // Skip if centroid is far off screen
    if (
      society.centroidX < vb.minX - 300 ||
      society.centroidX > vb.maxX + 300 ||
      society.centroidY < vb.minY - 300 ||
      society.centroidY > vb.maxY + 300
    )
      continue;

    // Draw thin lines between nearby society members
    ctx.strokeStyle = `hsla(${society.hue}, 50%, 60%, 0.06)`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const dx = members[i].x - members[j].x;
        const dy = members[i].y - members[j].y;
        if (dx * dx + dy * dy < 3600) {
          // within 60 units
          ctx.beginPath();
          ctx.moveTo(members[i].x, members[i].y);
          ctx.lineTo(members[j].x, members[j].y);
          ctx.stroke();
        }
      }
    }
  }
}

// --- Structures ---

export function drawStructures(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  vb: ViewBounds,
  zoom: number,
): void {
  for (const s of world.structures) {
    if (s.x < vb.minX - 40 || s.x > vb.maxX + 40 || s.y < vb.minY - 40 || s.y > vb.maxY + 40)
      continue;

    const society = world.societies.find((soc) => soc.id === s.societyId);
    const hue = society?.hue ?? 0;
    const underConstruction = s.buildProgress < 1;

    if (underConstruction) {
      ctx.setLineDash([3, 3]);
      ctx.globalAlpha = 0.3 + s.buildProgress * 0.7;
    }

    switch (s.type) {
      case "home":
        drawHexagon(ctx, s.x, s.y, 8, hue, underConstruction);
        break;
      case "storage":
        drawStorageBox(ctx, s.x, s.y, 8, s.storedEnergy / 500, underConstruction);
        break;
      case "farm":
        drawFarm(ctx, s.x, s.y, 6, zoom, underConstruction);
        break;
    }

    if (underConstruction) {
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Health bar when damaged
    if (s.health < s.maxHealth * 0.8 && s.buildProgress >= 1) {
      const barW = 16;
      const barH = 2;
      const frac = s.health / s.maxHealth;
      ctx.fillStyle = "rgba(60, 60, 60, 0.6)";
      ctx.fillRect(s.x - barW / 2, s.y + 12, barW, barH);
      ctx.fillStyle = frac > 0.4 ? "rgba(80, 200, 80, 0.8)" : "rgba(255, 80, 60, 0.8)";
      ctx.fillRect(s.x - barW / 2, s.y + 12, barW * frac, barH);
    }
  }
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  hue: number,
  outline: boolean,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  if (outline) {
    ctx.strokeStyle = `hsla(${hue}, 60%, 60%, 0.6)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = `hsla(${hue}, 60%, 50%, 0.4)`;
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue}, 60%, 60%, 0.6)`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Center dot
  ctx.fillStyle = `hsla(${hue}, 70%, 70%, 0.8)`;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawStorageBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fillLevel: number,
  outline: boolean,
): void {
  const half = size / 2;
  if (outline) {
    ctx.strokeStyle = "rgba(220, 180, 50, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - half, y - half, size, size);
  } else {
    ctx.fillStyle = "rgba(220, 180, 50, 0.2)";
    ctx.fillRect(x - half, y - half, size, size);
    // Fill level indicator (fills from bottom)
    if (fillLevel > 0) {
      const fillH = size * fillLevel;
      ctx.fillStyle = "rgba(220, 180, 50, 0.5)";
      ctx.fillRect(x - half, y + half - fillH, size, fillH);
    }
    ctx.strokeStyle = "rgba(220, 180, 50, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - half, y - half, size, size);
  }
}

function drawFarm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  zoom: number,
  outline: boolean,
): void {
  if (outline) {
    ctx.strokeStyle = "rgba(80, 180, 60, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(80, 180, 60, 0.3)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 180, 60, 0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Radius indicator at higher zoom
    if (zoom > 0.2) {
      ctx.strokeStyle = "rgba(80, 180, 60, 0.08)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Small seed dots
    ctx.fillStyle = "rgba(80, 180, 60, 0.5)";
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 3, y + Math.sin(angle) * 3, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- Society ring and role icon on organisms ---

export function drawSocietyRing(ctx: CanvasRenderingContext2D, org: Organism, hue: number): void {
  const radius = energyToRadius(org.energy);
  ctx.strokeStyle = `hsla(${hue}, 60%, 60%, 0.3)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(org.x, org.y, radius + 4, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawRoleIcon(ctx: CanvasRenderingContext2D, org: Organism): void {
  if (org.role === "none") return;
  const radius = energyToRadius(org.energy);
  const ix = org.x;
  const iy = org.y - radius - 8;
  const color = roleToColor(org.role);

  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  switch (org.role) {
    case "farmer": {
      // Green square
      ctx.fillRect(ix - 2, iy - 2, 4, 4);
      break;
    }
    case "builder": {
      // Yellow triangle
      ctx.beginPath();
      ctx.moveTo(ix, iy - 3);
      ctx.lineTo(ix - 3, iy + 2);
      ctx.lineTo(ix + 3, iy + 2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "defender": {
      // Blue circle
      ctx.beginPath();
      ctx.arc(ix, iy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "attacker": {
      // Red diamond
      ctx.beginPath();
      ctx.moveTo(ix, iy - 3);
      ctx.lineTo(ix + 3, iy);
      ctx.lineTo(ix, iy + 3);
      ctx.lineTo(ix - 3, iy);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "leader": {
      // White star (larger)
      drawStar(ctx, ix, iy, 4, 2, 5);
      break;
    }
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    if (i === 0) ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    else ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
}
