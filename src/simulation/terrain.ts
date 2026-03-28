// Simple 2D value noise for food density distribution
// No external dependencies — uses a permutation table and gradient interpolation

const TERRAIN_SCALE = 0.002;
const TERRAIN_OCTAVES = 3;

// Permutation table (seeded deterministically)
const perm = new Uint8Array(512);
let terrainSeed = 42;

export function initTerrain(seed: number): void {
  terrainSeed = seed;
  // Fisher-Yates shuffle of 0-255 using seed as PRNG
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}

// Initialize with default seed
initTerrain(terrainSeed);

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function noise2d(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = perm[perm[xi] + yi];
  const ab = perm[perm[xi] + yi + 1];
  const ba = perm[perm[xi + 1] + yi];
  const bb = perm[perm[xi + 1] + yi + 1];

  return lerp(
    lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
    lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
    v,
  );
}

/**
 * Returns food density at world position (0.0 - 1.0).
 * Uses multi-octave noise for interesting variation.
 */
export function foodDensityAt(x: number, y: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = TERRAIN_SCALE;
  let maxAmp = 0;

  for (let i = 0; i < TERRAIN_OCTAVES; i++) {
    value += noise2d(x * frequency, y * frequency) * amplitude;
    maxAmp += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  // Normalize to 0-1
  return (value / maxAmp + 1) * 0.5;
}
