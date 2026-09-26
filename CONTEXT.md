# AcquarioTS

A 2D artificial-life simulation in which autonomous organisms evolve by natural selection inside a closed aquarium. Nothing about morphology, metabolism or behaviour is designed — it is expected to emerge.

The full design lives in [`docs/vision.md`](./docs/vision.md); decisions and their rationale live in [`docs/adr/`](./docs/adr/).

## Language

Code, documentation, ADRs and commit messages are written in English, using the terms defined below.

The dev-log in [`docs/devlog/`](./docs/devlog/) is the one deliberate exception: it is written in Italian. It is public-facing prose about the project rather than documentation of it, so it follows its audience rather than the codebase. Its English domain terms stay in English — an _organism_ is not a _creatura_. Multi-word terms are the one case that gets a natural Italian rendering instead of being dropped in as a bare English label (an unglossed idiom): **Bright Zone**/**Bright Band** read as _zona luminosa_/_banda luminosa_.

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

**Generation**:
An organism's distance, in mitosis events, from generation 0 — the founding population that is placed rather than bred. A property of an individual, not a cohort: reproduction is continuous, so organisms many generations apart are alive at the same time.
_Avoid_: age (that is time lived), cohort, epoch, round

**Population**:
Every organism alive in a world at a given moment, taken as one collection. Never a count — that is the population's size — and never a kind: one population holds many lineages.
_Avoid_: colony, swarm, agents, creatures

### Genetics

**Genome**:
The complete heritable description of an organism. In v0.1 a flat record of four genes — `bodyRadius`, `mitosisEnergyThreshold`, `childAllocationRatio`, `lineageHue` — held by the organism and fixed for its life; from v0.2 a `Gene[]`.
_Avoid_: DNA (in code — fine in prose), chromosome

**Mutation**:
The change a genome undergoes when it is copied at birth. Applied to the child, drawn from the parent's own stream, before the child's area, costs and caps are computed — never to a living organism, whose genome is fixed for its life. Each gene mutates with its own independent probability, so some births are exact clones.
_Avoid_: variation, drift (that is what `lineageHue` does), evolution

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
The gene, in `[0, 1]`, giving the fraction of the parent's _remaining_ internal resources handed to a child after the mitosis costs are paid.
_Avoid_: split ratio, inheritance ratio

**Lineage Hue**:
A heritable gene in `[0, 1)` with no physiological effect, drifting slightly at each birth and wrapping, rendered as the body's hue. A neutral marker used to make descent visible. The one gene generation 0 does not take from the baseline genome: founders draw it across the whole range, because forty founders a single mutation apart would be forty shades of one colour, and a marker that cannot tell them apart is not a marker.
_Avoid_: colour gene, tag, marker (alone)

**Baseline Genome**:
The single minimal genome the generation-0 population is independently mutated from; a _baseline organism_ is one carrying it. It fixes the three functional genes only: `lineageHue` is drawn rather than inherited at generation 0. Its body radius is the baseline radius, and it sits deliberately below the optimal radius, so a run's first visible story is the population climbing toward one.
_Avoid_: seed genome, ancestor, template

**Generation 0**:
The population a world is created with: placed, never bred. It comes from one of two places, and which one is a construction option like mortality and fertility — a baseline genome every founder is independently mutated from, or an explicit list of founders. The first is the world the app runs and the done-criteria runs vary; the second is the world the calibration harness builds.
_Avoid_: gen zero, first generation, seed population, initial population (fine in prose)

**Founder**:
A generation-0 organism. Named as a record — a position and a whole genome, nothing drawn and nothing mutated — it is what the calibration harness places when it needs a ladder of radii wider than one generation of mutation would ever give it.
_Avoid_: ancestor, progenitor, seed organism, parent (that is a role in one birth)

**Baseline Radius**:
The simulation's length unit, and the body radius the baseline genome carries. It is 1 by definition rather than by tuning: every other length — the aquarium's dimensions, the generation-0 radius spread, the optimal radius — is written as a multiple of it (ADR-0009).
_Avoid_: unit radius, reference radius, default size, r₀, pixel

### Metabolism

**Resource**:
One of the four quantities an organism holds internally: `energy`, `oxygen`, `carbonDioxide`, `food`.
_Avoid_: substance, material, nutrient

**Diffusible**:
A `Resource` other than `energy`: one of the three that crosses the membrane and has a pool. What `Environment` is typed against, so a metabolic routine cannot ask the world to exchange energy.
_Avoid_: exchangeable resource, pool resource

**Food**:
Fixed carbon. The currency of _matter_ — bodies are built from it, and it is modelled as pure carbon.
_Avoid_: biomass, nutrient, organic matter, sugar

**Energy**:
The currency of _work_ — paid for existing, maintaining a body and reproducing. Produced only by respiration, never conserved.
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
An amount divided by the area holding it — `pool ÷ aquariumArea` outside, `internal ÷ bodyArea` inside. The only quantity the two sides of a membrane can be compared in.
_Avoid_: density, level

**Cap**:
The maximum amount of a resource an organism can hold: `kCap(resource) × bodyArea`, i.e. a maximum internal concentration. Only `kCap/ρ` is physical, since `ρ` alone carries the carbon unit (ADR-0022).
_Avoid_: capacity, limit, storage

**Existence Cost**:
The flat, size-independent energy an organism pays per unit time simply for being an organism. What makes a minimum viable body size exist.
_Avoid_: base cost, overhead, upkeep

**Body Cost**:
The energy an organism pays per unit time in proportion to its body area.
_Avoid_: area cost, maintenance (that is both costs together, not this half)

**Maintenance**:
The whole energy an organism pays per unit time simply to keep being one: existence cost plus body cost, `c₀ + β·area`. The name of the tick's fifth step, and of the total — never of either half alone.
_Avoid_: upkeep, basal cost, body cost (that is one of its two terms)

**Optimal Radius**:
The body radius maximising reproductive rate, `r_opt = 2·c₀/α`, computable in closed form from the world's constants. The prediction v0.1 is validated against.
_Avoid_: ideal size, target radius

**Energy Income Coefficient**:
`α`, the energy an organism earns per tick per unit of its body radius: the slope of the income line, and what `c₀` is solved against. A field over the aquarium and a function of time, so it is measured over the **Bright Band** in a **Fixed Population** rather than declared (ADR-0015, ADR-0023).
_Avoid_: income rate, efficiency, alpha (alone, in prose)

### World

**World**:
One complete simulation run: an aquarium, its pools, its population, and the clock and random streams that advance them. What a seed determines and a state hash identifies.
_Avoid_: universe, scene, game state, simulation (as a noun for the state), aquarium (that is the space inside it)

**Session**:
Every world run back to back in one tab, each seeded from the one before. Not a world — a world is one seed from creation to extinction; a session is the sequence of them. Purely an App-layer concept: nothing in `src/world/` knows it exists.
_Avoid_: run (that is one world), game, instance, playthrough

**Immortal World**:
A world constructed with `mortality: "off"`: maintenance still charges in full, but energy floors at zero instead of passing through it, and nothing dies. Mortality is `"on"` by default from M3 on; a world is not "immortal" or "mortal" as a permanent identity, only as the mode it was constructed in. No longer sufficient on its own as ADR-0015's instrument once a population can grow — see **Fixed Population**.
_Avoid_: safe mode, dead world (backwards), M2 world (it outlives that milestone)

**Fertility**:
Whether a world's organisms reproduce, `"on"` or `"off"`, chosen at construction like mortality and independent of it (ADR-0020). Off is not sterility as a trait: no organism in such a world evaluates mitosis at all. `"on"` by default from M4 on.
_Avoid_: reproduction mode, breeding, sterile

**Fixed Population**:
A world constructed with both mortality and fertility off: nothing dies and nothing is born, so the population that was placed is the population that remains. ADR-0015's real instrument, where `α` is measured free of any selection — **Immortal World** alone stopped being sufficient for that the moment mitosis could grow the population.
_Avoid_: static world, frozen world, immortal world (that is only half of it)

**Aquarium**:
The finite, hard-walled region a world's organisms live in: a width, a height, a surface along the top edge and a floor along the bottom, with no wraparound. The area every external concentration is measured over, and the extent the light gradient runs down.
_Avoid_: tank, arena, canvas, box, world (that is the whole run)

**Environment**:
The interface through which organisms read concentrations and light and exchange resources. Position-aware by signature; positionally uniform in v0.1.
_Avoid_: world (that is the whole run), aquarium (that is the space), medium, ambient

**Pool**:
A global, well-mixed reservoir of one resource. v0.1 has three: oxygen, carbon dioxide, food.
_Avoid_: reservoir, tank, store

**Carbon Budget**:
The total carbon in the world, fixed at initialisation and conserved thereafter. Sets the carrying capacity, expressed as "enough carbon for K baseline organisms".
_Avoid_: mass budget, total mass

**Bright Zone**:
The region near the surface where light is strong enough for photosynthesis to matter.
_Avoid_: surface layer, light zone, photic zone (old name; still the term in ADR-0004 through ADR-0025)

**Bright Band**:
The depth range `α` is measured over, fixed in advance by a light threshold rather than derived from where breeding turns out to happen. Narrower and sharper than the **Bright Zone**, which stays the informal ecological region.
_Avoid_: bright zone (that is the region, not the measurement window), light band, depth bin, photic band (old name; still the term in ADR-0004 through ADR-0025)

**Tick**:
One fixed-length step of simulated time. Decoupled from rendering frames.
_Avoid_: frame, step (reserve "step" for the manual single-tick control), update

**Snapshot**:
The read-only view of environment concentrations and light taken at the start of a tick, from which every organism reads.
_Avoid_: state copy, buffer (alone)

**Delta Buffer**:
The accumulated, not-yet-applied exchange _grants_ of every organism in the current tick, committed once at the end. It holds what the world has already agreed to hand over, scaled down if a pool could not meet the demand — never the raw requests, which are settled and discarded halfway through the tick.
_Avoid_: pending changes, queue, accumulator (that is the loop's time accumulator), requests (they do not survive to the commit)

**Remains**:
The frozen record of what a dying organism returns to the pools: its position, its three diffusible stores and its body mass. Exists within one tick, between step 8 and step 11. Not a corpse — a corpse is v0.2's persistent entity, which M3 deliberately does not have.
_Avoid_: corpse (reserved), body, carcass, dead organism

**Pending Birth**:
The frozen record of a child between step 7 and step 12: its genome, its four stores, its position and its own stream. The mirror of **Remains** — matter already taken from a parent and not yet given to a population — which is what keeps the carbon ledger balanced at the end of a tick in which something was born.
_Avoid_: pending organism, child (that is the organism once it exists), egg (reserved for v0.2), birth event

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

### Calibration

**Calibration Harness**:
The headless script that constructs worlds, runs them and reports the numbers M5's constants are chosen against. An instrument and never a gate: it asserts nothing, and the gates live in the long suite (ADR-0024).
_Avoid_: benchmark, tuner, calibration test, sweep (that is one of its runs)

**Done-Criteria Run**:
One of the fifteen runs, five seeds by three baseline genomes, whose gene means decide whether v0.1 met ADR-0011's criteria. An extinct one is a failed one, never an excluded one.
_Avoid_: acceptance run, validation run, final run, convergence test

**Tenancy**:
The ratio of the time an organism spends inside the **Bright Band** to its reproductive period: how many births a lineage gets per stay in the light. Low tenancy means a gene mean is reporting geography rather than genetics (ADR-0025).
_Avoid_: residence time (that is only the numerator), dwell time, bright time
