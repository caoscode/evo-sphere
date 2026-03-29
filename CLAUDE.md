# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EvoSphere is a real-time evolutionary artificial life simulation built with React 19 + TypeScript + HTML5 Canvas 2D. Organisms with heritable traits evolve, compete, hunt, reproduce, and form societies with territory, infrastructure, and collective strategies. All complexity emerges from simple local rules — no central coordination.

## Commands

- `vp install` — install dependencies (run after pulling changes)
- `vp dev` — start dev server
- `vp build` — production build (`tsc -b && vp build`)
- `vp check` — run format, lint, and TypeScript type checks
- `vp test` — run tests
- `vp lint` — lint only
- `vp fmt` — format only

Always use `vp` (Vite+ CLI), never pnpm/npm/yarn directly. Do not install vitest, oxlint, or oxfmt directly — they are bundled with Vite+. Import from `vite-plus` (e.g., `import { defineConfig } from 'vite-plus'`) and `vite-plus/test` for test utilities.

## Architecture

### Data Flow

```
Input (Mouse/Keyboard) → Camera + Selection
  → Simulation Step (world.ts::step())
  → Render to Canvas (renderer.ts::draw())
  → Display at 60 FPS
```

### State Management

React refs (not state) hold all simulation data to avoid re-renders during the game loop. `App.tsx` creates refs for world, config, camera, and passes them to `SimulationCanvas` and `ControlPanel`.

### Simulation Core (`src/simulation/`)

- **`types.ts`** — All core data structures: `Organism`, `Food`, `Society`, `Structure`, `TerritoryGrid`, `WorldState`, `SimConfig`
- **`world.ts`** — Main simulation loop (`step()`): updates organisms, societies, territory, structures, food spawning, border conflicts, density pressure
- **`organism.ts`** — Individual organism behavior: state machine (FORAGING/HUNTING/FLEEING/FEEDING/GATHERING/BUILDING/DEFENDING/COOPERATING/PATROLLING/INVADING), trait mutation on reproduction, energy metabolism with trait-based costs
- **`society.ts`** — Society formation (3+ nearby organisms with high socialAffinity), role assignment (farmer/builder/defender/attacker/leader), strategy/personality dynamics, collapse mechanics
- **`territory.ts`** — Influence-based territory grid (40px cells), ownership claims, contested zones, border skirmishes
- **`infrastructure.ts`** — Structure system (home/storage/farm), build decisions, farm food production with maturity
- **`abilities.ts`** — 5 special abilities (burstSpeed, energyDrain, camouflage, areaSense, reproSpike) with cooldowns/costs
- **`food.ts`** — Food spawning, terrain-based distribution, food surge events
- **`spatial-grid.ts`** — Hash-based spatial indexing (80px cells, Cantor pairing) for O(1) neighbor queries
- **`terrain.ts`** — Multi-octave noise for deterministic food density maps
- **`config.ts`** — All simulation constants and trait ranges

### Rendering (`src/rendering/`)

- **`renderer.ts`** — Main draw function, layered back-to-front: background → terrain heatmap → territory → grid → connections → structures → banners → food → organisms
- **`camera.ts`** — Pan (drag), zoom (wheel, 0.05×–10×), viewport culling
- **`visual-encoding.ts`** — Maps traits to visuals: metabolism→hue, energy→radius, aggression→spikes, behavior state→outline color, role→icon
- **`society-renderer.ts`** — Society connections, banners, structure rendering
- **`territory-renderer.ts`** — Territory influence overlay with society colors

### Components (`src/components/`)

- **`SimulationCanvas.tsx`** — Game loop (step + draw), canvas input handling, keyboard shortcuts (Space=pause, R=reset, I=inject food)
- **`ControlPanel.tsx`** — UI controls: pause/reset, sliders for spawn rate/energy cost/mutation rate/speed, save/load state
- **`StatsDisplay.tsx`** — Real-time metrics: population, food, societies, average traits

### Key Design Patterns

- **Swap-and-pop deletion** for dead organisms (avoids expensive array splices)
- **Evolutionary tradeoffs** via energy cost model: `cost = metabolism + speed×0.15 + vision×0.01 + aggression×0.05 + awareness×0.02`
- **Emergent society behavior** from individual trait thresholds — no explicit coordination logic
- **Influence-based territory** instead of hard boundaries for gradual expansion/conflict

## Remember

Update the @docs/SIMULATION.md, @README.md and @CLAUDE.md with relevant information when the project changes.

<!--VITE PLUS START-->

## Vite+ Toolchain Reference

This project uses Vite+, a unified toolchain wrapping Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task via the `vp` CLI.

### Common Pitfalls

- **Never use the package manager directly** — use `vp add`, `vp remove`, etc.
- **Never run `vp vitest` or `vp oxlint`** — use `vp test` and `vp lint`
- **Built-in commands override scripts** — use `vp run <script>` for custom scripts sharing names with built-in commands
- **Do not install vitest/oxlint/oxfmt/tsdown** — they're bundled with Vite+
- **Use `vp dlx`** instead of npx/pnpm dlx
- **Import from `vite-plus`** not `vite` or `vitest` — e.g., `import { defineConfig } from 'vite-plus'`, `import { expect, test, vi } from 'vite-plus/test'`
- **Type-aware linting** works via `vp lint --type-aware` without extra installs

### CI Integration

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

### Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started
- [ ] Run `vp check` and `vp test` to validate changes
<!--VITE PLUS END-->
