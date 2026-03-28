import type { BehaviorState } from "../simulation/types";
import { TRAIT_RANGES } from "../simulation/config";

/**
 * Maps metabolism to HSL hue (0-300).
 * Low metabolism = cool (blue/cyan ~180-240)
 * High metabolism = warm (red/orange ~0-40)
 */
export function metabolismToHue(metabolism: number): number {
  const [min, max] = TRAIT_RANGES.metabolism;
  const t = Math.max(0, Math.min(1, (metabolism - min) / (max - min)));
  // Invert: low metabolism = high hue (blue), high metabolism = low hue (red)
  return (1 - t) * 240;
}

export function energyToRadius(energy: number): number {
  return Math.max(3, Math.min(14, energy / 8));
}

export function speedToTrailAlpha(speed: number): number {
  const [min, max] = TRAIT_RANGES.speed;
  const t = (speed - min) / (max - min);
  return 0.1 + t * 0.3;
}

export function stateToOutlineColor(state: BehaviorState): string {
  switch (state) {
    case "HUNTING":
      return "rgba(255, 60, 60, 0.6)";
    case "FLEEING":
      return "rgba(60, 120, 255, 0.6)";
    case "FEEDING":
      return "rgba(255, 220, 60, 0.5)";
    case "FORAGING":
      return "rgba(60, 220, 100, 0.3)";
  }
}

export function aggressionToSpikes(aggression: number): number {
  // Number of spiky points for high-aggression organisms
  if (aggression < 0.4) return 0;
  return Math.floor(3 + aggression * 5);
}
