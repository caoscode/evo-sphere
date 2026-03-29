# EvoSphere Simulation Documentation

EvoSphere is a real-time artificial life simulation where autonomous organisms evolve, compete, cooperate, and build civilizations. All complexity emerges from simple local rules — no central coordination exists.

---

## Table of Contents

- [Mental Model](#mental-model)
- [High-Level Overview](#high-level-overview)
- [Simulation Loop](#simulation-loop)
- [Systems Breakdown](#systems-breakdown)
  - [Organisms](#organisms)
  - [Evolution & Mutation](#evolution--mutation)
  - [Societies](#societies)
  - [Territory](#territory)
  - [Conflict](#conflict)
  - [Infrastructure](#infrastructure)
  - [Food](#food)
- [Parameters & Tuning](#parameters--tuning)
- [Emergent Behavior Guide](#emergent-behavior-guide)

---

## Mental Model

> Think of the system as an ant colony simulator crossed with a strategy game — except nobody is playing. Each organism is a tiny autonomous agent with heritable traits that determine how fast it moves, how far it sees, how aggressive it is, and whether it prefers joining groups. When enough social organisms cluster together, a society spontaneously forms, claims territory, assigns roles, builds structures, and develops a collective personality. Societies rise and fall based on the traits of their members, the resources they control, and the conflicts they face. Evolution happens through reproduction with mutation — organisms that survive long enough to reproduce pass on (slightly altered) versions of their traits. Over hundreds of generations, the population adapts to its environment: efficient foragers dominate in scarce conditions, aggressive hunters thrive when prey is abundant, and social organisms flourish when cooperation pays off.

---

## High-Level Overview

### The World

A continuous 2D space (1200 x 800 units) where organisms move freely. Food spawns based on terrain-generated density maps (Perlin noise), creating natural "fertile" and "barren" regions.

### The Five Core Systems

```
┌─────────────┐     form/join      ┌─────────────┐     claim      ┌─────────────┐
│  Organisms   │ ───────────────── │  Societies   │ ────────────── │  Territory   │
│  (agents)    │                    │  (groups)    │                │  (land)      │
└──────┬───────┘                    └──────┬───────┘                └──────┬───────┘
       │ eat                               │ build                        │ contest
       ▼                                   ▼                              ▼
┌─────────────┐                    ┌─────────────┐                ┌─────────────┐
│    Food      │ ◄──── produce ─── │Infrastructure│                │   Conflict   │
│  (energy)    │                    │ (structures) │                │  (fighting)  │
└─────────────┘                    └─────────────┘                └─────────────┘
```

**Organisms** are the fundamental agents. They forage, hunt, flee, and reproduce. Their traits determine behavior.

**Societies** form when 3+ socially-inclined organisms stay near each other long enough. Societies assign roles, pool resources, and develop strategies.

**Territory** is a grid overlay where societies project influence from their members and structures. Ownership is determined by who has the strongest local presence.

**Infrastructure** consists of structures (homes, storage, farms) that societies build to gain economic and territorial advantages.

**Conflict** arises at territory borders where rival societies' members clash, and through predation between individual organisms.

**Food** is the energy source that drives everything. It spawns naturally from the terrain, is produced by farms, and occasionally surges in concentrated bursts.

---

## Simulation Loop

Every tick, the simulation executes these steps in exact order:

### Step 1: Build Spatial Indices

Two spatial hash grids (80-unit cells) are constructed — one for food, one for organisms. These enable efficient neighbor queries without checking every pair.

### Step 2: Update Each Organism

For every living organism:

1. Detect threats (aggressive, stronger organisms nearby)
2. Choose behavior state (see [Decision-Making](#decision-making-priority))
3. Execute movement based on state
4. Consume energy (metabolism + trait costs)
5. Eat food if touching it
6. Hunt prey if in contact and stronger
7. Reproduce if energy exceeds threshold
8. Die if energy reaches zero

Dead organisms and eaten food are tracked for removal.

### Step 3: Remove Dead & Eaten

Dead organisms and consumed food are removed using swap-and-pop deletion (efficient array removal without reindexing).

### Step 4: Add Offspring

New organisms from reproduction are added to the world (up to population cap of 500).

### Step 5: Apply Density Pressure

Organisms in crowded areas (8+ neighbors within 60 units) lose extra energy. Same-society neighbors cost half as much, encouraging group living but punishing overcrowding.

### Step 6: Update Societies

- Form new societies from clusters of compatible organisms
- Process join/leave events
- Reassign roles every 20 ticks
- Update personality and strategy every 20 ticks
- Run cooperation mechanics (energy pooling, centroid attraction)
- Check for collapse or fragmentation

### Step 7: Update Territory (Every 10 Ticks)

- Recalculate influence from all members and structures
- Determine cell ownership (highest influence above threshold)
- Identify contested zones and borders
- Update each society's territory statistics

### Step 8: Process Border Conflicts

Defender and attacker organisms near enemy borders engage in attrition-based combat, damaging each other's energy.

### Step 9: Update Infrastructure

- Builders contribute progress to incomplete structures
- Completed farms produce food
- All structures slowly decay; orphaned structures decay 5x faster
- Attackers damage enemy structures

### Step 10: Spawn Food

Normal spawning (~0.8 food/tick) based on terrain density. Food is suppressed (50% rejection) in active war zones.

### Step 11: Food Surge Check

Every 500-1500 ticks, a concentrated food burst spawns (30-80 items at 1.5x energy in a 150-unit radius).

### Step 12: Rescue Spawn

If population drops below 10, 5 new organisms spawn near the population center to prevent extinction.

### Step 13: Advance Tick Counter

---

## Systems Breakdown

### Organisms

Each organism is an autonomous agent with position, velocity, energy, age, and a set of heritable traits.

#### Core Traits

| Trait                      | Range  | What It Does                                                           |
| -------------------------- | ------ | ---------------------------------------------------------------------- |
| **Speed**                  | 0.3–8  | Movement velocity. Faster = more ground covered, but costs more energy |
| **Vision**                 | 10–200 | How far the organism can sense food, threats, and allies               |
| **Metabolism**             | 0.05–2 | Base energy cost per tick. Low = efficient, high = expensive           |
| **Reproduction Threshold** | 30–200 | Energy needed to reproduce. Low = breeds fast, high = breeds rarely    |
| **Aggression**             | 0–1    | Tendency to hunt. Above 0.5, the organism becomes a predator           |
| **Awareness**              | 0–1    | Threat detection sensitivity. Modifies effective vision range          |
| **Efficiency**             | 0–1    | How much energy is extracted from food. Also affects building speed    |
| **Risk Tolerance**         | 0–1    | Willingness to stay near threats. Below 0.7, organism will flee        |
| **Social Affinity**        | 0–1    | Desire to join societies. Above 0.3, organism can form/join groups     |

#### Abilities

Each organism can hold up to 2 special abilities, inherited and occasionally mutated (3% chance per slot):

| Ability          | Effect                                            | Cooldown  | Duration | Cost     |
| ---------------- | ------------------------------------------------- | --------- | -------- | -------- |
| **Burst Speed**  | 2x speed when fleeing or hunting                  | 120 ticks | 10 ticks | 8 energy |
| **Energy Drain** | Steal up to 2 energy/tick from nearby organisms   | 60 ticks  | 15 ticks | 5 energy |
| **Camouflage**   | 60% harder for others to detect                   | 200 ticks | 50 ticks | 3 energy |
| **Area Sense**   | Always-active awareness of food cluster direction | None      | Passive  | None     |
| **Repro Spike**  | Reduces reproduction threshold to 60%             | 500 ticks | 1 tick   | None     |

#### Energy Metabolism

Every tick, an organism pays an energy cost:

```
cost = (metabolism + speed × 0.15 + vision × 0.01 + aggression × 0.05 + awareness × 0.02)
       × energyCostMultiplier
       × homeCostMultiplier
```

- **Home bonus**: 5% cost reduction when within 60 units of a home structure
- **Enemy territory penalty**: -0.1 energy/tick when standing on another society's land

This creates fundamental tradeoffs: a fast, far-sighted, aggressive organism is powerful but expensive to maintain. A slow, efficient organism survives longer but covers less ground.

#### Decision-Making (Priority)

The organism evaluates its situation each tick and enters the highest-priority applicable state:

```
Priority 1: FLEEING      — Threat detected and risk tolerance < 0.7
Priority 2: Role duties   — DEFENDING, PATROLLING, INVADING, BUILDING, or GATHERING
Priority 3: HUNTING       — Aggressive and weaker prey visible
Priority 4: FEEDING       — Directly on top of food
Priority 5: COOPERATING   — In a society with no specific role task
Priority 6: FORAGING      — Default (seek food or wander)
```

#### Behavior States in Detail

| State           | Movement                              | Speed Modifier        | Goal                             |
| --------------- | ------------------------------------- | --------------------- | -------------------------------- |
| **FORAGING**    | Toward nearest food, or random wander | 1.0x                  | Find food                        |
| **HUNTING**     | Chase weakest nearby organism         | 1.0x                  | Kill prey for energy             |
| **FLEEING**     | Away from threat                      | 1.2x                  | Survive                          |
| **FEEDING**     | Nearly stopped                        | 0.3x                  | Stay on food                     |
| **GATHERING**   | Same as foraging                      | 1.0x                  | Farm food, deposit to storage    |
| **BUILDING**    | Toward build site                     | 0.8x (0.2x near site) | Construct/repair structures      |
| **DEFENDING**   | Toward threat/centroid midpoint       | 1.1x                  | Protect society territory        |
| **PATROLLING**  | Along society borders                 | 0.9x                  | Monitor territory edges          |
| **INVADING**    | Toward enemy territory                | 1.1x                  | Expand society control           |
| **COOPERATING** | Gentle drift toward centroid          | 0.3x                  | Stay with group, forage casually |

#### Predation

When a hunting organism contacts prey (within 8 units):

- The hunter must have significantly more energy than the target
- Required energy ratio: 1.0x baseline
  - +30% if target's society has 2+ defenders nearby
  - +20% if target is in its own territory
- On a successful kill, the hunter gains **50% of the target's energy**

---

### Evolution & Mutation

#### Reproduction

When an organism's energy exceeds its reproduction threshold:

1. Parent gives 50% of its energy to the offspring
2. Offspring spawns within 10 units at a random angle
3. Each trait is independently mutated

#### Trait Mutation

```
new_value = parent_value × (1 + random(-1, 1) × mutationRate)
```

With the default mutation rate of 0.15, each trait can shift up to ±15% per generation. The result is clamped to the trait's valid range.

#### Ability Mutation

Each ability slot has a 3% chance per reproduction to be replaced with a random different ability.

#### Selection Pressures

Evolution is not directed — it emerges from differential survival:

| Pressure           | Favors                                   | Penalizes                                                             |
| ------------------ | ---------------------------------------- | --------------------------------------------------------------------- |
| Food scarcity      | Low metabolism, high efficiency          | High speed, high vision (expensive)                                   |
| Food abundance     | Fast reproduction, high speed            | Over-efficiency (wastes reproductive potential)                       |
| High predation     | High awareness, high vision, burst speed | Low risk tolerance organisms die less, but high aggression propagates |
| Crowding           | Social affinity, society membership      | Lone organisms (full density pressure)                                |
| Territory conflict | Aggression, defenders                    | Passive organisms in contested zones                                  |

---

### Societies

#### Formation

A society forms when **3 or more organisms** meet all conditions:

- Each has `socialAffinity > 0.3`
- All are within **120 units** of each other
- They remain near each other for **15 consecutive ticks**
- Pairwise **trait compatibility > 0.25**

Trait compatibility measures how similar two organisms are across speed, efficiency, aggression, and awareness (normalized and combined via Euclidean distance).

#### Joining an Existing Society

An independent organism can join if:

- Within 120 units of the society's centroid
- Society has fewer than 30 members
- Stays near for 10 ticks
- Average trait compatibility with members >= 0.25

#### Leaving

Members leave when:

- **Energy starvation**: Energy drops below 20% of the society average (30% if society is declining)
- **Wandered too far**: More than 200 units from centroid for 30+ ticks
- **War zone refugee**: 1% chance per tick while in contested territory

Leaving triggers a 50-tick independence cooldown before the organism can join or form another society.

#### Roles

Every 20 ticks, the society assigns roles based on its current strategy. Each role has a target percentage of the membership:

| Strategy        | Attackers | Defenders | Builders | Farmers   |
| --------------- | --------- | --------- | -------- | --------- |
| **Attack**      | 30%       | 15%       | 10%      | Remainder |
| **Defend**      | 0%        | 35%       | 15%      | Remainder |
| **Expand**      | 15%       | 15%       | 30%      | Remainder |
| **Consolidate** | 5%        | 15%       | 15%      | Remainder |

Organisms are scored for each role based on their traits:

- **Farmer**: High efficiency, low aggression, moderate awareness
- **Builder**: High efficiency, low speed, high social affinity
- **Defender**: Moderate aggression, high awareness, high risk tolerance
- **Attacker**: High aggression, high speed, high risk tolerance
- **Leader** (1 per society): High vision, high awareness, high relative energy

#### Personality

Every 20 ticks, the society computes four personality axes (0–1 scale) from its members' average traits:

- **Aggression**: Average member aggression (attackers weighted 1.5x, leader 2x)
- **Defensiveness**: Awareness, inverse risk tolerance, defender ratio
- **Expansiveness**: Speed, territory growth rate, social affinity, membership ratio
- **Economic Focus**: Farmer ratio, efficiency, shared pool wealth

#### Strategy Selection

If the society is in survival mode (territory below 50% of peak AND shared pool below 50 energy):

- Strategy locks to **Consolidate**

Otherwise, the highest personality axis determines strategy:

- Aggression → **Attack**
- Defensiveness → **Defend**
- Expansiveness → **Expand**
- Economic Focus → **Consolidate**

#### Cooperation Mechanics

**Energy Pooling** (every tick):

- Members with energy above 60% of average contribute 2% of excess to the shared pool
- Members below 40% of average can draw up to 1 energy from the pool

**Golden Age** (rising society, stability > 0.7, 10+ members):

- All members get a +10% metabolism bonus (productivity boost)

**Decline Penalty** (falling society, stability < 0.5):

- All members suffer a -5% metabolism penalty (attrition)

**Centroid Attraction**: All members receive a subtle 5% steering bias toward the group center, keeping the society cohesive.

**Leader Directives**: The leader can set a directive that steers members:

- **Rally**: 15% bias toward a rally point
- **Target**: Attackers get 20% bias, others 5% toward target
- **Scatter**: 10% centrifugal force (spread out)
- **Idle**: No directive (default)

**Social Alarm**: When a defender enters FLEEING state, nearby low-awareness members (< 0.4) are spooked into fleeing too — panic spreads through the group.

#### Stability

Stability score (0–1) is computed from five weighted factors:

| Factor            | Weight | What It Measures                                         |
| ----------------- | ------ | -------------------------------------------------------- |
| Resource penalty  | 25%    | How depleted the shared pool is (vs 100 energy baseline) |
| Territory penalty | 25%    | Current territory vs peak territory                      |
| Member penalty    | 20%    | Current members vs peak members                          |
| Variance penalty  | 15%    | Energy inequality among members                          |
| Overextension     | 15%    | Too much territory per member                            |

#### Collapse & Fragmentation

**Dissolution** (immediate): If living members fall below 3, the society dissolves. Stored energy in structures is dropped as food.

**Collapse**: If stability stays below 0.3 for 50+ ticks (and society age > 200 ticks):

- **6+ members**: The society fragments into two daughter societies. Members split by spatial clustering. Shared pool divides proportionally. Personality mutates slightly (±0–20% per axis). Structures go to the nearest fragment.
- **Fewer than 6 members**: The society dissolves entirely.

---

### Territory

#### The Grid

The world is divided into a grid of **40-unit cells**. Each cell tracks:

- **Influence**: How much presence each society has (per-society Float32Array)
- **Owner**: Which society controls the cell (highest influence above threshold)
- **Contest Level**: How challenged the ownership is (ratio of second-strongest to strongest influence)

The territory grid updates **every 10 ticks**.

#### Influence Projection

Each society member stamps influence onto nearby cells:

```
influence(distance) = base × max(0, 1 - distance × 0.15)
```

- **Base per member**: 1.0 (reduced by up to 50% if society is overextended)
- **Radius**: 5 cells (200 units)
- **Distance metric**: Chebyshev (square neighborhoods)

Structures project stronger, wider influence:

| Structure | Influence Base | Radius              |
| --------- | -------------- | ------------------- |
| Home      | 3.0            | 7 cells (280 units) |
| Storage   | 2.0            | 7 cells (280 units) |
| Farm      | 2.5            | 7 cells (280 units) |

#### Ownership

A cell is claimed by the society with the highest influence, provided that influence exceeds **0.3** (the claim threshold).

#### Contested Zones

A cell is contested when the second-strongest influence is at least **60%** of the strongest. Contested cells experience:

- Reduced food spawning (50% rejection)
- Border skirmishes between rival members
- Increased chance of society members fleeing

#### Borders

A cell is a border cell if it is owned by one society but is adjacent (4-connected) to a cell owned by a different society or to an unowned cell.

#### Expansion and Invasion Targets

- **Expansion targets**: Unclaimed or contested cells adjacent to own territory, ranked by food density
- **Invasion targets**: Enemy-owned cells adjacent to own territory, ranked by contest level (most contested first)

---

### Conflict

#### Border Skirmishes

When a defender or attacker organism is within **60 units** of an enemy in contested or enemy territory:

```
damage = 0.5 × opponent.aggression
```

Modifiers:

- Defending in own territory: **-20% damage taken**
- Attacking in enemy territory: **-10% damage taken** (slight attacker advantage)

#### Structure Warfare

- Attackers within 30 units of an enemy structure deal **2 damage/tick**
- High-aggression organisms (> 0.6) in contact deal **1 damage/tick**
- When a structure is destroyed, 20% of its stored energy goes to the attacking society's pool
- Storage energy is dropped as food (1 food item per 25 energy)

#### Rivalries

Societies track hostility toward other societies (0–1 scale):

- **Grows** by +0.02 when defenders/attackers occupy enemy territory, +0.01 per contested cell
- **Decays** by -0.005 per tick naturally
- High rivalry influences strategy selection and invasion targeting

---

### Infrastructure

Societies can build three types of structures (max 100 structures globally):

#### Home

- **Cost**: 30 energy from shared pool
- **Limit**: 1 per society
- **Effect**: All organisms within 60 units pay 5% less energy per tick
- **Territorial influence**: 3.0 base, 280-unit radius
- **Build priority**: First structure a society builds

#### Storage

- **Cost**: 40 energy from shared pool
- **Limit**: 3 per society
- **Capacity**: 500 energy
- **Effect**: Farmers deposit 15% of food they eat into the nearest storage (within 40 units). Overflow goes to the shared pool.
- **Placement**: Near centroid normally; toward borders if under territorial pressure
- **Territorial influence**: 2.0 base, 280-unit radius

#### Farm

- **Cost**: 60 energy from shared pool
- **Limit**: 3 per society
- **Effect**: Produces food at a rate dependent on maturity and nearby farmers
- **Maturity**: Ramps from 50% to 100% efficiency over 200 ticks
- **Production rate**: `0.5 + 0.5 × maturity + 0.1 × nearbyFarmers` (max 1.2 food/tick, capped at 3 farmer bonus)
- **Placement**: High food density locations or expansion targets
- **Territorial influence**: 2.5 base, 280-unit radius

#### Building Process

1. Every 50 ticks, one society can initiate construction (if no incomplete structures exist and shared pool >= 50% of cost)
2. **Build priority**: Home first, then Storage (if shared pool > 100), then Farm
3. Builders within 10 units of the site contribute progress proportional to their efficiency (costs 0.3 energy per contribution)
4. Progress reaches 1.0 to complete the structure

#### Decay

All structures lose 0.02 health/tick. Orphaned structures (no owning society) decay at 5x rate (0.10/tick). Builders can repair structures below 80% health.

---

### Food

#### Terrain-Based Distribution

Food density is determined by 3-octave Perlin noise, creating natural fertile and barren regions. Food spawning respects this density map — more food appears in "green" zones.

#### Normal Spawning

~0.8 food items spawn per tick (configurable), placed near the current population bounds. Each spawn attempt uses the terrain density as a probability gate.

**War zone suppression**: 50% of food spawns are rejected in highly contested territory cells.

#### Food Surges

Every 500–1500 ticks (random interval), a concentrated food burst occurs:

- **Amount**: 30–80 food items
- **Energy**: 1.5x normal (75 energy instead of 50)
- **Radius**: 150 units from a random point near the population

Surges create sudden abundance that can trigger reproduction booms, territory shifts, and society formation.

#### Consumption

An organism eats food when within **6 units** of it. Energy gained = food energy × organism's efficiency trait.

Farmer organisms deposit 15% of consumed food energy into the nearest storage structure (if within 40 units).

---

## Parameters & Tuning

### World & Population

| Parameter         | Default    | Range | Effect of Increasing                            |
| ----------------- | ---------- | ----- | ----------------------------------------------- |
| World Size        | 1200 × 800 | Fixed | —                                               |
| Initial Organisms | 30         | —     | Faster society formation, quicker stabilization |
| Max Organisms     | 500        | —     | Higher ceiling for population booms             |
| Initial Food      | 100        | —     | Easier early survival                           |
| Max Food          | 400        | —     | More available energy at any time               |
| Max Structures    | 100        | —     | More infrastructure, stronger territories       |

### Energy & Metabolism

| Parameter              | Default  | Range   | Effect of Increasing                                |
| ---------------------- | -------- | ------- | --------------------------------------------------- |
| Food Spawn Rate        | 0.8/tick | 0–5     | More food → larger populations → more societies     |
| Food Energy            | 50       | —       | Each food item sustains longer                      |
| Energy Cost Multiplier | 1.0      | 0.2–3.0 | Higher → faster starvation → selects for efficiency |
| Speed Cost Factor      | 0.15     | —       | Makes speed more expensive                          |
| Vision Cost Factor     | 0.01     | —       | Vision is cheap — slight penalty for large vision   |
| Aggression Cost Factor | 0.05     | —       | Aggression has moderate cost                        |
| Awareness Cost Factor  | 0.02     | —       | Awareness is nearly free                            |

### Evolution

| Parameter               | Default | Effect of Increasing                                       |
| ----------------------- | ------- | ---------------------------------------------------------- |
| Mutation Rate           | 0.15    | Faster trait drift, more diversity, less lineage stability |
| Ability Mutation Chance | 3%      | More ability diversity per generation                      |

### Society

| Parameter             | Default   | Effect of Increasing                                           |
| --------------------- | --------- | -------------------------------------------------------------- |
| Formation Radius      | 120 units | Easier to form societies (organisms don't need to be as close) |
| Min Society Size      | 3         | Harder to form (need more compatible organisms)                |
| Max Society Size      | 30        | Larger societies, more complex dynamics                        |
| Formation Ticks       | 15        | Slower society formation (must stay together longer)           |
| Join Ticks            | 10        | Slower joining                                                 |
| Leave Distance        | 200 units | Members can wander farther before being ejected                |
| Independence Cooldown | 50 ticks  | Longer gap between leaving and rejoining                       |

### Territory

| Parameter               | Default  | Effect of Increasing                            |
| ----------------------- | -------- | ----------------------------------------------- |
| Cell Size               | 40 units | Coarser territory resolution                    |
| Update Interval         | 10 ticks | Less frequent recalculation, better performance |
| Influence Decay Rate    | 0.15     | Softer borders, less territory per member       |
| Claim Threshold         | 0.3      | Harder to claim (need more influence)           |
| Contest Ratio           | 0.6      | Cells become contested more easily              |
| Border Skirmish Range   | 60 units | Wider conflict zones                            |
| Enemy Territory Penalty | 0.1/tick | Higher cost to trespass                         |

### Density Pressure

| Parameter             | Default             | Effect of Increasing                                 |
| --------------------- | ------------------- | ---------------------------------------------------- |
| Pressure Radius       | 60 units            | Crowding felt over wider area                        |
| Neighbor Threshold    | 8                   | More tolerance for crowding before pressure kicks in |
| Pressure Cost         | 0.3/tick per excess | Harsher crowding penalty                             |
| Same-Society Discount | 50%                 | —                                                    |

### Stability & Collapse

| Parameter                    | Default   | Effect of Increasing                     |
| ---------------------------- | --------- | ---------------------------------------- |
| Collapse Stability Threshold | 0.3       | Societies must be more stable to survive |
| Collapse Timer               | 50 ticks  | More tolerance for instability           |
| Collapse Min Age             | 200 ticks | Young societies get more grace period    |

---

## Emergent Behavior Guide

### Population Boom-Bust Cycles

**Pattern**: Population surges to near max, then crashes.

**Cause**: Abundant food → rapid reproduction → overshoot carrying capacity → density pressure + food depletion → mass starvation → population crash → food recovers → cycle repeats.

**What to watch**: The cycle period depends on food spawn rate and metabolism costs. Higher food rates produce bigger booms. Higher energy costs produce sharper busts.

### Trait Specialization Over Generations

**Pattern**: The population's average traits shift over time toward "optimal" values for the current conditions.

**Cause**: Organisms with better-adapted traits survive longer, reproduce more, and pass on (slightly mutated) versions of those traits.

**Common outcomes**:

- In scarce food environments: low metabolism and low speed dominate (energy conservation)
- In abundant food environments: high speed and low reproduction threshold dominate (territory coverage and fast breeding)
- In high-predation environments: high awareness and vision increase; population often splits into hunters and evaders

### Society Formation Waves

**Pattern**: Multiple societies form nearly simultaneously after a period of independent wandering.

**Cause**: Food surges concentrate organisms. Proximity + time + social affinity passes the formation threshold for multiple groups at once.

**What to watch**: Societies tend to form in fertile terrain regions where food spawns attract organisms.

### Rise and Fall of Civilizations

**Pattern**: A society grows, builds infrastructure, claims territory, then either stabilizes or collapses.

**Typical lifecycle**:

1. **Formation**: 3+ organisms cluster → society forms
2. **Growth**: Members join, roles assigned, first structures built
3. **Expansion**: Territory grows, farms produce food, golden age bonus kicks in
4. **Peak**: Large territory, multiple structures, high stability
5. **Decline** (one of):
   - Overextension (too much territory per member)
   - Resource drain (shared pool depleted by too many dependents)
   - Conflict attrition (border wars sap energy)
   - Member loss (members leave or die faster than new ones join)
6. **Collapse or Fragmentation**: If stability stays below 0.3 for 50 ticks, the society either splits into two daughter societies or dissolves entirely

### Territorial Arms Races

**Pattern**: Two adjacent societies repeatedly contest the same border cells.

**Cause**: Both societies project influence into the gap between them. As one builds structures or gains members near the border, it pushes influence forward. The rival responds by shifting defenders and attackers to that border.

**What to watch**: Contest levels rise, food spawning drops in the war zone, border members take attrition damage. The war often ends when one side's stability collapses.

### Infrastructure Cascades

**Pattern**: A society with a farm produces more food → attracts/sustains more members → builds more structures → claims more territory → builds more farms → positive feedback loop.

**Limiting factor**: Overextension. Territory grows faster than membership, reducing per-cell influence until the borders become contested and fall.

### Predator-Prey Dynamics

**Pattern**: Aggressive hunters proliferate when prey is abundant, then decline as prey populations crash.

**Cause**: High-aggression organisms gain energy from kills (50% of prey energy), allowing rapid reproduction. But as prey populations fall, hunters starve. The surviving prey population has higher awareness and vision (selected by predation pressure), making hunting harder.

### Society Fragmentation Chains

**Pattern**: A large society fragments, and the daughter societies fragment again shortly after.

**Cause**: Fragmentation splits the shared pool and territory. If neither fragment inherits enough members or resources to stabilize, both hit the collapse threshold again. This cascading fragmentation can rapidly break a 20-member society into several small, short-lived groups.

### Niche Differentiation

**Pattern**: Neighboring societies develop different strategies and trait profiles.

**Cause**: Each society's personality is computed from its members' traits. Through mutation and differential survival at the borders, members of rival societies experience different selection pressures. One society may become aggressive (red/orange hue, high aggression) while its neighbor becomes defensive (blue/cyan, high awareness). This differentiation stabilizes borders by reducing direct competition.
