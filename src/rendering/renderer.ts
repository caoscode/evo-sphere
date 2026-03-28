import type { WorldState } from "../simulation/types";
import { energyToRadius, metabolismToHue, speedToTrailAlpha } from "./visual-encoding";

export function draw(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const scaleX = canvasWidth / world.width;
  const scaleY = canvasHeight / world.height;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (canvasWidth - world.width * scale) / 2;
  const offsetY = (canvasHeight - world.height * scale) / 2;

  // Background
  ctx.fillStyle = "#070710";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Food
  for (const f of world.food) {
    ctx.fillStyle = "#44cc55";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Organisms
  for (const org of world.organisms) {
    const hue = metabolismToHue(org.metabolism);
    const radius = energyToRadius(org.energy);
    const trailAlpha = speedToTrailAlpha(org.speed);

    // Trail
    if (org.trail.length > 1) {
      ctx.strokeStyle = `hsla(${hue}, 70%, 55%, ${trailAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(org.trail[0].x, org.trail[0].y);
      for (let i = 1; i < org.trail.length; i++) {
        // Skip segments that wrap around (large jumps)
        const dx = Math.abs(org.trail[i].x - org.trail[i - 1].x);
        const dy = Math.abs(org.trail[i].y - org.trail[i - 1].y);
        if (dx > world.width / 2 || dy > world.height / 2) {
          ctx.moveTo(org.trail[i].x, org.trail[i].y);
        } else {
          ctx.lineTo(org.trail[i].x, org.trail[i].y);
        }
      }
      // Connect last trail point to current position
      const lastTrail = org.trail[org.trail.length - 1];
      const dx = Math.abs(org.x - lastTrail.x);
      const dy = Math.abs(org.y - lastTrail.y);
      if (dx < world.width / 2 && dy < world.height / 2) {
        ctx.lineTo(org.x, org.y);
      }
      ctx.stroke();
    }

    // Vision ring
    ctx.strokeStyle = `hsla(${hue}, 50%, 50%, 0.08)`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(org.x, org.y, org.vision, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
    ctx.beginPath();
    ctx.arc(org.x, org.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Bright center dot
    ctx.fillStyle = `hsl(${hue}, 80%, 80%)`;
    ctx.beginPath();
    ctx.arc(org.x, org.y, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
