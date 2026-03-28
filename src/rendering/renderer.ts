import type { Organism, WorldState } from "../simulation/types";
import { foodDensityAt } from "../simulation/terrain";
import type { Camera } from "./camera";
import { getVisibleBounds } from "./camera";
import {
  drawRoleIcon,
  drawSocietyRing,
  drawSocietyTerritories,
  drawStructures,
} from "./society-renderer";
import {
  aggressionToSpikes,
  energyToRadius,
  metabolismToHue,
  speedToTrailAlpha,
  stateToOutlineColor,
} from "./visual-encoding";

const GRID_SPACING = 100;
const TERRAIN_CELL = 50; // world units per terrain heatmap cell

export function draw(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  canvasWidth: number,
  canvasHeight: number,
  camera: Camera,
  selectedId: number | null = null,
): void {
  const vb = getVisibleBounds(camera, canvasWidth, canvasHeight);

  // Background
  ctx.fillStyle = "#070710";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.translate(
    canvasWidth / 2 - camera.x * camera.zoom,
    canvasHeight / 2 - camera.y * camera.zoom,
  );
  ctx.scale(camera.zoom, camera.zoom);

  // Terrain heatmap (faint green tint showing food density)
  drawTerrainHeatmap(ctx, vb);

  // Subtle grid for spatial reference
  drawGrid(ctx, vb, camera.zoom);

  // Society territories (behind everything)
  drawSocietyTerritories(ctx, world, vb, camera.zoom);

  // Structures
  drawStructures(ctx, world, vb, camera.zoom);

  // Food — viewport cull
  for (const f of world.food) {
    if (f.x < vb.minX - 5 || f.x > vb.maxX + 5 || f.y < vb.minY - 5 || f.y > vb.maxY + 5) continue;
    ctx.fillStyle = "#44cc55";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Organisms — viewport cull with vision margin
  for (const org of world.organisms) {
    const margin = Math.max(org.vision, 20);
    if (
      org.x < vb.minX - margin ||
      org.x > vb.maxX + margin ||
      org.y < vb.minY - margin ||
      org.y > vb.maxY + margin
    )
      continue;

    drawOrganism(ctx, org, camera.zoom, org.id === selectedId, world);
  }

  ctx.restore();
}

function drawOrganism(
  ctx: CanvasRenderingContext2D,
  org: Organism,
  zoom: number,
  selected: boolean,
  world: WorldState,
): void {
  const hue = metabolismToHue(org.metabolism);
  const radius = energyToRadius(org.energy);
  const trailAlpha = speedToTrailAlpha(org.speed);
  const hasCamo = org.abilities.some((a) => a.type === "camouflage" && a.active);

  // Trail
  if (org.trail.length > 1) {
    ctx.strokeStyle = `hsla(${hue}, 70%, 55%, ${trailAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(org.trail[0].x, org.trail[0].y);
    for (let i = 1; i < org.trail.length; i++) {
      ctx.lineTo(org.trail[i].x, org.trail[i].y);
    }
    ctx.lineTo(org.x, org.y);
    ctx.stroke();
  }

  // Vision ring (skip when zoomed out far)
  if (zoom > 0.15) {
    const hasAreaSense = org.abilities.some((a) => a.type === "areaSense");
    if (hasAreaSense) {
      // Dashed vision ring for areaSense
      ctx.setLineDash([4, 4]);
    }
    ctx.strokeStyle = `hsla(${hue}, 50%, 50%, 0.08)`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(org.x, org.y, org.vision, 0, Math.PI * 2);
    ctx.stroke();
    if (hasAreaSense) {
      ctx.setLineDash([]);
    }
  }

  // State outline ring
  if (org.state !== "FORAGING" && zoom > 0.1) {
    ctx.strokeStyle = stateToOutlineColor(org.state);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(org.x, org.y, radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Apply camouflage transparency to body
  if (hasCamo) ctx.globalAlpha = 0.3;

  // Body — spiky for aggressive, round for passive
  const spikes = aggressionToSpikes(org.aggression);
  if (spikes > 0 && zoom > 0.2) {
    drawSpikyBody(ctx, org.x, org.y, radius, spikes, hue);
  } else {
    ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
    ctx.beginPath();
    ctx.arc(org.x, org.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bright center dot
  ctx.fillStyle = `hsl(${hue}, 80%, 80%)`;
  ctx.beginPath();
  ctx.arc(org.x, org.y, radius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  if (hasCamo) ctx.globalAlpha = 1;

  // Direction indicator for hunting/fleeing
  if ((org.state === "HUNTING" || org.state === "FLEEING") && zoom > 0.15) {
    const vLen = Math.sqrt(org.vx * org.vx + org.vy * org.vy);
    if (vLen > 0) {
      const nx = org.vx / vLen;
      const ny = org.vy / vLen;
      ctx.strokeStyle = stateToOutlineColor(org.state);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(org.x + nx * radius, org.y + ny * radius);
      ctx.lineTo(org.x + nx * (radius + 8), org.y + ny * (radius + 8));
      ctx.stroke();
    }
  }

  // Selection highlight
  if (selected) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(org.x, org.y, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(org.x, org.y, radius + 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Society ring and role icon
  if (org.societyId !== null) {
    const society = world.societies.find((s) => s.id === org.societyId);
    if (society) {
      drawSocietyRing(ctx, org, society.hue);
      if (zoom > 0.3) {
        drawRoleIcon(ctx, org);
      }
    }
  }

  // Ability visual indicators (only when zoomed in enough)
  if (zoom > 0.2) {
    drawAbilityIndicators(ctx, org, radius);
  }
}

function drawAbilityIndicators(ctx: CanvasRenderingContext2D, org: Organism, radius: number): void {
  for (const ability of org.abilities) {
    if (!ability.active) continue;
    switch (ability.type) {
      case "burstSpeed": {
        // Motion lines behind the organism
        ctx.strokeStyle = "rgba(255, 200, 50, 0.4)";
        ctx.lineWidth = 1;
        const vLen = Math.sqrt(org.vx * org.vx + org.vy * org.vy);
        if (vLen > 0) {
          const nx = -org.vx / vLen;
          const ny = -org.vy / vLen;
          for (let i = -1; i <= 1; i++) {
            const px = org.x + ny * i * 3;
            const py = org.y - nx * i * 3;
            ctx.beginPath();
            ctx.moveTo(px + nx * radius, py + ny * radius);
            ctx.lineTo(px + nx * (radius + 10), py + ny * (radius + 10));
            ctx.stroke();
          }
        }
        break;
      }
      case "energyDrain": {
        // Pulsing inner ring
        ctx.strokeStyle = "rgba(180, 50, 255, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(org.x, org.y, radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "reproSpike": {
        // Brief star burst
        ctx.fillStyle = "rgba(255, 255, 100, 0.4)";
        ctx.beginPath();
        ctx.arc(org.x, org.y, radius + 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
}

function drawSpikyBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  spikes: number,
  hue: number,
): void {
  const innerR = radius * 0.7;
  const outerR = radius * 1.2;
  ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes;
    const r = i % 2 === 0 ? outerR : innerR;
    if (i === 0) {
      ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    } else {
      ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
  }
  ctx.closePath();
  ctx.fill();
}

function drawTerrainHeatmap(
  ctx: CanvasRenderingContext2D,
  vb: { minX: number; minY: number; maxX: number; maxY: number },
): void {
  const startX = Math.floor(vb.minX / TERRAIN_CELL) * TERRAIN_CELL;
  const startY = Math.floor(vb.minY / TERRAIN_CELL) * TERRAIN_CELL;

  for (let x = startX; x <= vb.maxX; x += TERRAIN_CELL) {
    for (let y = startY; y <= vb.maxY; y += TERRAIN_CELL) {
      const density = foodDensityAt(x + TERRAIN_CELL / 2, y + TERRAIN_CELL / 2);
      if (density > 0.1) {
        const alpha = density * 0.06;
        ctx.fillStyle = `rgba(40, 180, 60, ${alpha})`;
        ctx.fillRect(x, y, TERRAIN_CELL, TERRAIN_CELL);
      }
    }
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  vb: { minX: number; minY: number; maxX: number; maxY: number },
  zoom: number,
): void {
  const alpha = Math.max(0.02, Math.min(0.06, zoom * 0.04));
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = 0.5;

  const startX = Math.floor(vb.minX / GRID_SPACING) * GRID_SPACING;
  const startY = Math.floor(vb.minY / GRID_SPACING) * GRID_SPACING;

  ctx.beginPath();
  for (let x = startX; x <= vb.maxX; x += GRID_SPACING) {
    ctx.moveTo(x, vb.minY);
    ctx.lineTo(x, vb.maxY);
  }
  for (let y = startY; y <= vb.maxY; y += GRID_SPACING) {
    ctx.moveTo(vb.minX, y);
    ctx.lineTo(vb.maxX, y);
  }
  ctx.stroke();
}
