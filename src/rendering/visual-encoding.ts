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

export function visionToRingRadius(vision: number): number {
  return vision;
}

export function speedToTrailAlpha(speed: number): number {
  const [min, max] = TRAIT_RANGES.speed;
  const t = (speed - min) / (max - min);
  return 0.1 + t * 0.3;
}
