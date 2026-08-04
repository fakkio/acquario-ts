# AcquarioTS

A 2D artificial-life simulation in which autonomous organisms evolve by natural selection inside a closed aquarium. Nothing about morphology, metabolism or behaviour is designed — it is expected to emerge.

The full design lives in [`docs/vision.md`](./docs/vision.md); decisions and their rationale live in [`docs/adr/`](./docs/adr/).

## Language

Code, documentation, ADRs and commit messages are written in English, using the terms defined below.

### Life

**Organism**:
An autonomous individual: a circular body carrying a genome, internal resource stores and its own PRNG state.
_Avoid_: creature, agent, cell, entity

**Organelle**:
A specialised structure inside a body that provides a capability the minimal organism lacks. None exist in v0.1.
_Avoid_: organ, module, part

**Minimal Organism**:
An organism with no organelles, surviving on innate passive capabilities alone. The only kind of organism in v0.1.
_Avoid_: base organism, default organism

**Lineage**:
An organism and all its descendants. Tracked visually through `lineageHue`.
_Avoid_: species, clade, family

### Genetics

**Genome**:
The complete heritable description of an organism. In v0.1 a flat record of four fields; from v0.2 a `Gene[]`.
_Avoid_: DNA (in code — fine in prose), chromosome

**Gene**:
One heritable, independently mutable field of the genome.
_Avoid_: trait, allele, parameter

**Body Radius**:
The gene setting an organism's circular body size. The only multiplicatively mutating gene.
_Avoid_: size, scale

**Mitosis Energy Threshold**:
The gene, in `[0, 1]`, giving the fraction of its energy cap an organism must reach before attempting to reproduce.
_Avoid_: reproduction threshold, breeding energy

**Child Allocation Ratio**:
The gene, in `[0, 1]`, giving the fraction of the parent's *remaining* internal resources handed to a child after the mitosis costs are paid.
_Avoid_: split ratio, inheritance ratio

**Lineage Hue**:
A heritable gene with no physiological effect, drifting slightly each generation, rendered as the body's hue. A neutral marker used to make descent visible.
_Avoid_: colour gene, tag, marker (alone)

**Baseline Genome**:
The single minimal genome that the generation-0 population is independently mutated from.
_Avoid_: seed genome, ancestor, template

### Metabolism

**Resource**:
One of the four quantities an organism holds internally: `energy`, `oxygen`, `carbonDioxide`, `food`.
_Avoid_: substance, material, nutrient

**Food**:
Fixed carbon. The currency of *matter* — bodies are built from it, and it is modelled as pure carbon.
_Avoid_: biomass, nutrient, organic matter, sugar

**Energy**:
The currency of *work* — paid for existing, maintaining a body and reproducing. Produced only by respiration, never conserved.
_Avoid_: ATP, fuel, calories

**Photosynthesis**:
The passive reaction fixing carbon: `CO₂ + light → food + O₂`. Produces no energy.
_Avoid_: carbon fixation (as a separate term), light reaction

**Respiration**:
The passive reaction releasing energy: `food + O₂ → energy + CO₂`. The only source of energy in the simulation.
_Avoid_: digestion, metabolism (as a synonym), burning

**Passive Exchange**:
Signed diffusion of a resource across the membrane, proportional to perimeter and to the concentration difference between organism and environment.
_Avoid_: absorption, uptake, intake, osmosis

**Concentration**:
An amount divided by the area holding it — `pool ÷ worldArea` outside, `internal ÷ bodyArea` inside. The only quantity the two sides of a membrane can be compared in.
_Avoid_: density, level

**Cap**:
The maximum amount of a resource an organism can hold: `kCap × bodyArea`, i.e. a maximum internal concentration.
_Avoid_: capacity, limit, storage

**Existence Cost**:
The flat, size-independent energy an organism pays per unit time simply for being an organism. What makes a minimum viable body size exist.
_Avoid_: base cost, overhead, upkeep

**Body Cost**:
The energy an organism pays per unit time in proportion to its body area.
_Avoid_: maintenance (ambiguous), area cost

**Optimal Radius**:
The body radius maximising reproductive rate, `r_opt = 2·c₀/α`, computable in closed form from the world's constants. The prediction v0.1 is validated against.
_Avoid_: ideal size, target radius

### World

**Environment**:
The interface through which organisms read concentrations and light and exchange resources. Position-aware by signature; positionally uniform in v0.1.
_Avoid_: world (that is the container), medium, ambient

**Pool**:
A global, well-mixed reservoir of one resource. v0.1 has three: oxygen, carbon dioxide, food.
_Avoid_: reservoir, tank, store

**Carbon Budget**:
The total carbon in the world, fixed at initialisation and conserved thereafter. Sets the carrying capacity, expressed as "enough carbon for K baseline organisms".
_Avoid_: mass budget, total mass

**Photic Zone**:
The region near the surface where light is strong enough for photosynthesis to matter.
_Avoid_: surface layer, light zone

**Tick**:
One fixed-length step of simulated time. Decoupled from rendering frames.
_Avoid_: frame, step (reserve "step" for the manual single-tick control), update

**Snapshot**:
The read-only view of environment concentrations and light taken at the start of a tick, from which every organism reads.
_Avoid_: state copy, buffer (alone)

**Delta Buffer**:
The accumulated, not-yet-applied exchange requests of every organism in the current tick, committed once at the end.
_Avoid_: pending changes, queue, accumulator (that is the loop's time accumulator)

### Reproduction and motion

**Mitosis**:
Asexual reproduction by budding: the parent pays energy and food-mass, the child is created tangent to it, and the parent does not shrink.
_Avoid_: division, split, cloning, fission

**Brownian Motion**:
The random force applied to every organism, and the only source of movement in v0.1.
_Avoid_: drift, jitter, wander, random walk

**Positional Separation**:
Collision resolution that displaces overlapping bodies apart along their normal, without impulses or restitution.
_Avoid_: collision response, bounce, impulse resolution

**Uniform Grid**:
The spatial index rebuilt each tick, bucketing organisms by cell index for neighbour queries.
_Avoid_: spatial hash, quadtree, broadphase