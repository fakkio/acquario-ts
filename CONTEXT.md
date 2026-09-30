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
A specialised structure inside a body that provides a capability the minimal organism lacks. None exist in v0.1. From v0.2 a neuron is an organelle; a synapse is not. Each type declares its **Ports**.
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
The complete heritable description of an organism. In v0.1 a flat record of four genes — `bodyRadius`, `mitosisEnergyThreshold`, `childAllocationRatio`, `lineageHue` — held by the organism and fixed for its life; from v0.2 a fixed header of **Organism Genes** plus a `Gene[]` of structural genes.
_Avoid_: DNA (in code — fine in prose), chromosome

**Mutation**:
The change a genome undergoes when it is copied at birth. Applied to the child, drawn from the parent's own stream, before the child's area, costs and caps are computed — never to a living organism, whose genome is fixed for its life. Each **Organism Gene** mutates with its own independent probability; from v0.2 the `Gene[]` instead takes a bounded number of structural events per birth, each one operator applied to one gene. Some births are exact clones.
_Avoid_: variation, drift (that is what `lineageHue` does), evolution

**Gene**:
One heritable, independently mutable field of the genome.
_Avoid_: trait, allele, parameter

**Organism Gene**:
A gene the organism has exactly once, held in the genome's fixed header rather than in its `Gene[]`: `mitosisEnergyThreshold`, `childAllocationRatio`, `lineageHue`, and the body-size gene (`bodyRadius` in v0.1, **Cytoplasm Thickness** from v0.2). Never duplicated, deleted or inserted; carries no **Innovation Id**, since it is aligned by name.
_Avoid_: trait, header field, global gene

**Innovation Id**:
The stable identifier of a gene in the `Gene[]`, minted once from a monotonic per-world counter when the gene is inserted or split off, and preserved through mutation and inheritance. Identity only: ids are compared for equality and nothing else, so nothing sorts, iterates, draws or branches on an id's value, and evaluation order is the gene's position in the genome. That rule is what keeps a counter advanced in population order from leaking into behaviour.
_Avoid_: gene id, innovation number, uid

**Structural Gene**:
From v0.2, an element of the genome's `Gene[]`: an **Organelle Gene** or a **Synapse Gene**, carrying an **Innovation Id**. What insertion, deletion and **Split** act on; **Organism Genes** are never structural.
_Avoid_: gene (alone, when the distinction matters), module gene, body gene

**Organelle Gene**:
The structural gene describing one organelle: its type, position, radius, orientation and the parameters its type declares. A neuron is an organelle type, so a neuron is an organelle gene too.
_Avoid_: organ gene, part gene, neuron gene (as a separate kind)

**Synapse Gene**:
The structural gene describing one **Synapse**: a source output **Port**, a destination input **Port** and a weight. The one structural gene with no geometry, a relation rather than an object.
_Avoid_: connection gene, edge, link

**Split**:
The v0.2 duplication operator, which divides rather than copies: one organelle becomes two whose areas sum to the original's, incoming synapses copied to both, outgoing ones divided between them. Exactly neutral for a neuron, area-conserving for any organelle.
_Avoid_: duplication (in prose it is fine; the operator is a split), copy, fission, clone

**Body Radius**:
The radius of an organism's circular body. A gene in v0.1, the only one mutating multiplicatively. From v0.2 derived: the minimum enclosing circle of the body's relaxed organelles plus the **Cytoplasm Thickness**, which is the whole radius of a body with no organelles.
_Avoid_: size, scale

**Cytoplasm Thickness**:
From v0.2, the **Organism Gene** giving the width of cytoplasm around a body's organelles: body radius is the organelles' minimum enclosing circle plus this. With no organelles it is the whole body radius, so it inherits v0.1's `bodyRadius` and its multiplicative law.
_Avoid_: margin, cytoplasm radius, body radius (that is derived)

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
An amount divided by the area holding it — `pool ÷ aquariumArea` outside, `internal ÷ bodyArea` inside (from v0.2, `internal ÷` **Cytoplasm Area**, which is the body area when there are no organelles). The only quantity the two sides of a membrane can be compared in.
_Avoid_: density, level

**Cap**:
The maximum amount of a resource an organism can hold: `kCap(resource) × bodyArea` (from v0.2 `× cytoplasmArea`, see **Cytoplasm Area**), i.e. a maximum internal concentration. One per resource, never a shared volume. Only `kCap/ρ` is physical, since `ρ` alone carries the carbon unit (ADR-0022).
_Avoid_: capacity, limit, storage

**Existence Cost**:
The flat, size-independent energy an organism pays per unit time simply for being an organism. What makes a minimum viable body size exist.
_Avoid_: base cost, overhead, upkeep

**Body Cost**:
The energy an organism pays per unit time in proportion to its body area, `β·area`. From v0.2 charged on the **Cytoplasm Area** only: each organelle pays for its own area at its type's rate (ADR-0029).
_Avoid_: area cost, maintenance (that is both costs together, not this half)

**Maintenance**:
The whole energy an organism pays per unit time simply to keep being one: existence cost plus body cost, `c₀ + β·area`. From v0.2 also every organelle's **Organelle Overhead** and area cost and every synapse's overhead, each area paid once at its occupant's rate; **Thrust Cost** is not part of it. The name of the tick's fifth step, and of the total — never of any term alone.
_Avoid_: upkeep, basal cost, body cost (that is one of its two terms)

**Cytoplasm Area**:
From v0.2, the part of a body not occupied by organelles: `bodyArea − Σ organelleArea`, strictly positive because **Cytoplasm Thickness** is. What holds the stores, so caps and internal concentrations are taken over it, and what the body cost is charged on.
_Avoid_: free area, internal capacity, storage area

**Organelle Overhead**:
The flat energy each organelle pays per unit time for existing, whatever its size, declared per type; a synapse pays a small one of its own. Paid per piece, it is the only thing that bounds how many pieces a body divides its organelle area into, and it sets each type's optimal organelle radius `c_type / k_type` (ADR-0029).
_Avoid_: organelle upkeep, per-capability cost, existence cost (that is the organism's)

**Thrust Cost**:
The energy a thruster pays per tick in proportion to the magnitude of the force it produces, `k_thrust × |F|`, so pushing against gravity while standing still costs. The one activity cost in v0.2.
_Avoid_: movement cost, power, work

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

**Worst-Case Birth Gate**:
The law that a parent attempts **Mitosis** only when it can already pay for the most expensive child its **Mutation** law could produce, so the draw that follows never fails for lack of means. What makes the children actually born an unbiased sample of the mutation law.
_Avoid_: affordability check, mass gate (that is the physical requirement alone), birth check

**Birth Cost Ceiling**:
The bound, guaranteed by the **Mutation** law itself rather than enforced by rejecting draws, on how much more a child can cost than its parent. The margin the **Worst-Case Birth Gate** prices. A constant factor in v0.1; from v0.2 a closed-form bound read from the parent's own genome, because a body that follows its organelles' layout has no constant factor worth pricing (ADR-0028).
_Avoid_: max child cost, growth cap, mutation cap

**Birth Sieve**:
The defect the **Worst-Case Birth Gate** removes: drawing a child's mutation, rejecting it when the parent cannot pay, and redrawing later, which filters births towards cheaper children than the mutation law proposes and pushes a lineage downhill by mechanism rather than by selection (#40).
_Avoid_: size drift, shrinkage, race to small (those are its symptom)

**Persistence**:
An unprimed world's population surviving to the end of a run across every seed. A gate every milestone from v0.2's first on holds, like conservation; a milestone that breaks it retires or relaxes it by ADR, never silently.
_Avoid_: survival (that is one organism's), viability, stability

**Brownian Motion**:
The random force applied to every organism, and the only source of movement in v0.1. From v0.2 joined by **Buoyant Weight** and thrust, and the scale both are calibrated against.
_Avoid_: drift, jitter, wander, random walk

**Buoyant Weight**:
From v0.2, the vertical force gravity puts on a body: over its organelles only, each one's area times the difference between its **Organelle Density** and the **Water Density** where it sits, applied at the organelle's own position so it also turns the body. Zero for a body with no organelles, at any depth. It vanishes where the organelles' mean density meets the water's, which is the depth a body rests at without thrust (ADR-0030).
_Avoid_: gravity (that is the field), mass, buoyancy (alone), sinking force

**Organelle Density**:
The mass per area an organelle type declares, a constant of the type and never a gene, compared against the **Water Density** to give its share of **Buoyant Weight**. Separate from `ρ`, which is carbon per area: a light organelle costs the same carbon at birth as any other area.
_Avoid_: density (alone), ρ (that is carbon), weight, buoyancy

**Water Density**:
From v0.2, the aquarium's water profile, rising linearly from the surface to the floor so that composition alone gives a body an interior resting depth. The cytoplasm is water inside the membrane, so it is neutral at every depth and only organelles are weighed against this.
_Avoid_: stratification (that is the fact that it varies), pycnocline, medium density

**Positional Separation**:
Collision resolution that displaces overlapping bodies apart along their normal, without impulses or restitution.
_Avoid_: collision response, bounce, impulse resolution

**Uniform Grid**:
The spatial index rebuilt each tick, bucketing organisms by cell index for neighbour queries.
_Avoid_: spatial hash, quadtree, broadphase

### Nervous system

**Neuron**:
From v0.2, the organelle type that computes: one input **Port** it integrates over time and one output Port carrying the result. Its size and position mean only cost and space.
_Avoid_: node, unit, cell

**Synapse**:
A weighted connection from an output **Port** to an input Port, carrying a **Signal** from one tick to the next. Described by a **Synapse Gene**; not an organelle, and with no geometry.
_Avoid_: connection, edge, link, wire

**Signal**:
The value an output **Port** carries on one tick: in `[−1, 1]` from a neuron, in `[0, 1]` or `[−1, 1]` from an **Innate Sense**.
_Avoid_: activation (that is the function), output (that is the port), impulse, spike

**Port**:
A named place on an organelle, or on the body, where synapses attach: an input port receives the weighted sum of its synapses, an output port emits one **Signal** per tick. Each type declares its own; a port takes any number of synapses.
_Avoid_: pin, channel, socket, input/output (alone)

**Innate Sense**:
An output **Port** of the body itself, present in every organism at no cost: a store over its cap, the light at the body's centre, or which way the body's axis points. The passive version of what a sensor organelle would improve.
_Avoid_: sensor (reserved for sensor organelles, v0.3+), input neuron, perception

**Actuator**:
An organelle whose input **Port** turns a **Signal** into an effect on the world. In v0.2 only the thruster.
_Avoid_: motor, effector, output neuron

**Drive**:
The signal an **Actuator** acts on when nothing is wired to it, and the offset its wired inputs add to. A thruster with no synapses pushes at its drive.
_Avoid_: bias (that is the neuron's), baseline, idle level

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
