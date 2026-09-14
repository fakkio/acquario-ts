# AcquarioTS — Vision

AcquarioTS is a 2D artificial-life simulation in which autonomous organisms evolve over time through natural selection.

The goal is not to build predefined species, but to observe the spontaneous emergence of:

- different morphologies
- metabolic strategies
- nervous systems
- predation behaviours
- cooperation
- reproductive strategies

Every organism is described by a genome defining its structure, organelles and nervous system.

This document describes **what AcquarioTS is**. The reasoning behind each contested decision — and the alternatives rejected — lives in [`docs/adr/`](./adr/). Vocabulary is defined in [`CONTEXT.md`](../CONTEXT.md).

---

## Core principles

### Everything is an organelle

Every advanced capability is implemented as an organelle.

| Capability           | Organelle      |
| -------------------- | -------------- |
| Sight                | Eye            |
| Processing           | Neuron         |
| Movement             | Thruster       |
| Photosynthesis       | Chloroplast    |
| Advanced respiration | Lung / Gill    |
| Sexual reproduction  | Gonad          |
| Egg laying           | Uterus         |
| Defence              | Carapace       |
| Attack               | Teeth / Spines |
| Storage              | Vesicle        |

Organisms can survive with no organelles at all. Organelles are evolutionary optimisations of capabilities every organism already has.

### The minimal organism

Every organism has innate capabilities, even with no organelles. This is the only kind of organism that exists in v0.1.

**Passive exchange.** Resources cross the membrane by diffusion, at a rate proportional to the body's perimeter and to the difference in concentration between inside and outside. One signed law governs oxygen, carbon dioxide and food alike; a negative flux is an organism venting a resource back into the world.

**Passive photosynthesis.** `CO₂ + light → food + O₂`. Carbon fixation, not energy production. Its rate scales with the width the body projects toward the light, i.e. with diameter.

**Passive respiration.** `food + O₂ → energy + CO₂`. The sole source of energy in the simulation. Both reactions are extremely inefficient — that inefficiency is what organelles later improve on.

**Passive movement.** Organisms without thrusters are subject to brownian motion, which lets them drift slowly and encounter one another.

**Passive reproduction.** Every organism can reproduce by mitosis once it holds enough energy and food-mass.

---

## The body

### Shape

In v0.1 every organism is a circle, and a body has a position and nothing else kinematic: motion is overdamped, so there is no velocity to carry between ticks, and a circle with no organelles has no visible orientation to rotate. Rotation and angular velocity arrive in v0.2 with the organelles that make them matter, because organelles have an orientation and a position relative to the body's centre.

### Organelles

_(v0.2+ — no organelles exist in v0.1.)_

Each organelle is a circle with a type, a position relative to the body centre, a radius, an orientation and type-specific parameters. Size determines both energy cost and effectiveness: a larger lung holds more gas, a larger thruster produces more thrust, a larger eye sees further.

### Body construction

_(v0.2+.)_ The genome defines organelle layout. When an organism is generated:

1. organelles are created
2. overlaps are detected
3. a relaxation algorithm separates them
4. the minimum enclosing circle is computed
5. a safety margin is added

The result becomes the body. A mutation producing overlapping organelles must never cause immediate death.

### Internal capacity

Storage capacity is `bodyArea − Σ organelleArea` — the space left over, a kind of internal circulatory system holding energy, oxygen, carbon dioxide and food.

In v0.1 these stores are independent rather than competing for one shared volume. Each resource has its own cap:

```text
cap(resource) = kCap(resource) × bodyArea
```

Because a cap scales with area, it is really a maximum internal _concentration_. Direct competition for a single internal volume is deferred to a later version.

`kCap` is **1 for the three diffusibles** — that is the choice defining the concentration unit, and it means a cap binds only when the world outside is richer than the organism can be. Energy gets a coefficient of its own, `kCapEnergy`, because energy is not a carbon or oxygen quantity and its unit is fixed independently by `β = 1`. One coefficient shared across all four would be a coincidence of notation, not a shared physical constant.

---

## Metabolism

Four resources exist: **energy**, **oxygen (O₂)**, **carbon dioxide (CO₂)** and **food**.

Food is the currency of **matter** — bodies are built from it, and it is modelled as pure carbon. Energy is the currency of **work** — spent on existing, maintaining a body and reproducing.

### The carbon ledger

The world is closed. Matter is neither created nor destroyed; the only thing entering the system from outside is light.

Two quantities are exactly conserved, and both are asserted continuously as invariants:

```text
carbon  = pool.food + pool.CO₂
        + Σ organism.food + Σ organism.CO₂
        + Σ organism.bodyMass

oxygen  = pool.O₂ + pool.CO₂
        + Σ organism.O₂ + Σ organism.CO₂
```

Both reactions balance on both counts, with 1:1 stoichiometry:

```text
photosynthesis:  CO₂ + light → food + O₂      carbon: CO₂ → food     oxygen: CO₂ → O₂
respiration:     food + O₂   → energy + CO₂   carbon: food → CO₂     oxygen: O₂  → CO₂
```

Energy is deliberately **not** conserved: it enters as light, is fixed by photosynthesis, released by respiration, and dissipated by living and by dying.

Because carbon is finite, the population has a hard ceiling set by the world rather than by any tuning constant, and total extinction is a genuinely possible outcome — neither guaranteed nor artificially prevented.

### Reaction rates

Both reactions follow **mass action** on internal concentrations, each multiplied by the geometric factor its physics implies:

```text
photosynthesis = kPhoto × light(y) × diameter × C_internal(CO₂)
respiration    = kResp  × C_internal(food) × C_internal(O₂) × bodyArea
```

Three things follow, and all three are load-bearing.

Low oxygen throttles respiration continuously, with no suffocation rule written anywhere — the promise ADR-0003 makes, kept by the rate law rather than by a special case.

Every operation is `+ − × ÷`, so ADR-0007's consequence that v0.1's inner loop evaluates no transcendental survives the arrival of metabolism.

And energy income comes out **linear in `r` on its own**, which is the assumption `r_opt = 2·c₀/α` rests on. Respiration's capacity scales with area while its supply scales with perimeter and with diameter, so capacity outgrows supply and the internal concentrations self-adjust downward until consumption matches what is arriving. Respiration is therefore supply-limited in the regime the simulation runs in, and income settles at `α·r`. A flat capacity law would instead put a second knee in the income curve, and `r_opt` would stop being the closed form.

Saturating (Michaelis–Menten) kinetics are the fallback if the dynamics turn out stiff; they cost one extra constant per substrate and buy nothing until they are needed.

**Throttle, never spill.** A reaction runs at `min(rate, substrate available, product headroom)`. Spilling a product past its cap would create or destroy carbon and break the invariant on the first tick. Spilling _energy_ would not — energy is not conserved — but respiration is throttled by a full energy store anyway: it is the right physical reading, since nothing burns fuel with nowhere to put the result, and it stops a full organism strip-mining the food pool for nothing.

### Light

Light comes from above and attenuates exponentially with depth:

```text
I(y) = I₀ · e^(−k·y)
```

Organisms nearer the surface receive more of it. In v0.1 attenuation is precomputed into a lookup table indexed by depth, so no transcendental function is evaluated in the simulation loop.

`I₀ = 1`, defining the light unit the same way `kCap = 1` defines the concentration unit. `k = ln(10)/10`, so light falls to a tenth of its surface value at a depth of ten baseline radii: the photic zone is the aquarium's top quarter, which makes the founder effect below a real spatial split rather than a gradient washing over everything equally.

The table samples every `0.1` baseline radii over the aquarium's height and is read with **linear interpolation**. Interpolating costs `+ − × ÷` only, so the arithmetic-only property is kept; reading the nearest entry instead would quantise the gradient into steps wide enough for a lineage to settle on one.

Light is sampled at the **body's centre**, not at its upper edge. The projected-width factor in the photosynthesis rate already carries the body's size, and sampling the edge would hand a large body a second advantage nothing in the model intends.

Because v0.1 has no thrusters and no gravity, depth is not under genetic control. What light produces instead is spatial heterogeneity of income, plus a **positional founder effect**: since children are born tangent to their parents, position is quasi-heritable, and a lineage that happens to sit in the photic zone breeds faster and passes on the good address. Genetic control of depth arrives in v0.2 together with thrusters and buoyancy.

This also gives v0.1 two viable strategies from a single genome: organisms in the light fix carbon, while organisms in the dark subsist on food absorbed passively from the pool — food that corpses put there.

### Resource pools

O₂, CO₂ and food are three global, well-mixed pools with no spatial variation — a zero-dimensional approximation of the spatial fluid simulation planned for v0.2+.

The pools start at finite values and never receive external injections. They exchange matter only with each other and with organisms.

Organisms never touch a pool directly. They talk to an `Environment` whose signature already takes a position:

```ts
interface Environment {
  concentration(resource: Diffusible, pos: Vec2): number;
  light(pos: Vec2): number;
  // returns the amount ACTUALLY exchanged, which may be less than requested
  exchange(resource: Diffusible, pos: Vec2, amount: number): number;
}
```

`Diffusible` is `Resource` minus `energy` — the three that cross a membrane and have a pool. `Environment` is typed against it rather than against `Resource`, so "energy is never exchanged with the world" is a fact the compiler enforces.

In v0.1 the implementation ignores `pos` everywhere except `light`. In v0.2 a fluid-field implementation replaces it without any metabolic code changing.

`Environment` is everything the metabolism sees, and it is deliberately unable to write to the world. The tick holds a wider handle over the same object — adding the settlement between the sub-passes below, and the commit — so that an organism cannot mutate a pool for the same reason the render layer gets `OrganismView` rather than `Organism`.

Exchange is synchronous and double-buffered, and it settles in **two sub-passes** (ADR-0016). In the first, every organism registers the flux it wants and writes nothing. Between them, the scaling factor for each pool is computed: if total demand for a resource would drive its pool negative, all draws on that resource are scaled proportionally. In the second, every organism is handed its granted amount and runs its reactions against that number. The delta buffer applied at the end of the tick therefore holds grants, already scaled, not requests.

Two passes rather than one because the scaling factor is a function of total demand, so it does not exist until everyone has asked — and an organism that spends an inflow larger than the one it turns out to receive ends the tick holding a negative store, which is carbon minted from nothing.

```text
C_external(r) = pool[r] / worldArea
C_internal(r) = internal[r] / bodyArea
flux(r)       = kDiffusion × perimeter × (C_external(r) − C_internal(r)) × dt
```

Two consequences worth naming: an organism whose photosynthesis has filled it above ambient will passively **leak food back to the pool**, a free selective pressure against hoarding; and oxygen starvation needs no special rule, since it simply throttles respiration until the organism starves.

### Death and decomposition

The only cause of death in v0.1 is **energy reaching zero**. There is no ageing and no separate asphyxiation rule — in a closed carbon system the population regulates itself, because immortal organisms lock up carbon, CO₂ falls, photosynthesis throttles, and the weakest starve and return their mass.

On death:

- internal O₂, CO₂ and food return to their pools
- accumulated energy is dissipated
- body mass is converted instantly into food, in exactly the amount paid for it at birth

### Predation

_(v0.2+.)_ Organisms will be able to obtain energy by eating other organisms. This requires dedicated organelles and behaviour.

### Scavenging

_(v0.2+.)_ Corpses will persist as entities releasing organic matter that can be consumed. In v0.1 this is simplified to instant conversion to food on death; a corpse only becomes worth modelling once something exists that can interact with it.

---

## Energy costs

Organisms spend energy to exist, to maintain organelles, to process information, to move and to reproduce.

### Existence cost

A flat, size-independent cost per unit time, paid by every organism simply for being one:

```text
existenceCost = c₀
```

This is basal metabolism — maintaining ion gradients, repairing damage, keeping a membrane intact — and it is what makes a minimum viable body size exist.

### Body cost

A cost proportional to body area, which limits unchecked growth:

```text
bodyCost = β · area ∝ β · r²
```

### Optimal radius

Every intake channel scales with perimeter, so energy income is linear in `r`, while costs are flat plus quadratic. A child costs in proportion to its area, so:

```text
reproductiveRate(r) ∝ (α·r − c₀ − β·r²) / r²  =  α/r − c₀/r² − β

r_opt = 2·c₀ / α
```

The `c₀/r²` term is what prevents a race to zero: without a flat cost, smaller is always fitter without bound, and body radius collapses to the numerical floor. With it, there is a genuine interior optimum.

`r_opt` is a **design input**: pick the radius organisms should converge on, then derive `c₀ = α·r_opt/2`. The baseline genome deliberately starts below `r_opt`, so the first thing a run shows is the population climbing toward a value predicted on paper.

`α` is **not** one of the world's constants (ADR-0015). Energy comes only from respiration, whose substrate arrives by photosynthesis — proportional to the light at _this_ depth — and by food diffusion — proportional to how rich the pool currently is. So `α` is a field over the aquarium and a function of time, and it is measured rather than declared. M2 reports the population mean; M5 solves `c₀` against that measurement. There is no circularity, because `α` is measured in a world with a fixed immortal population where nothing can select, and the prediction is fixed before the world that tests it exists.

### Organelle costs

_(v0.2+.)_ Each organelle pays a **flat overhead plus an area-scaled cost**, with sublinear effectiveness. That combination is what makes the size/number trade-off real: many small organelles pay many fixed overheads, while one large organelle pays a single overhead but suffers diminishing returns. Where the balance falls depends on the organelle type — which is exactly the variety worth having.

Position matters too: an eye near the centre sees almost omnidirectionally, an eye near the rim sees a narrow, specialised cone.

Sublinear effectiveness has a known tension with the goal of producers and consumers diverging: at equal area it favours the generalist carrying both pathways over the specialist committed to one. Sublinearity stands; the incentive that rewards specialisation is an open v0.2 question — see ADR-0014.

---

## Nervous system

_(v0.2+.)_

### Philosophy

No layered neural networks. The target is evolved recurrent networks whose _topology_ is inspired by liquid state machines, reservoir computing and recurrent neural networks: sparse, recurrent, not organised into layers.

These references concern topology only, not learning. There is no training within an organism's lifetime — no trained readout, no backpropagation. Every network parameter changes solely through mutation between generations, exactly like any other gene.

### Neurons

Neurons are organelles. Updates are synchronous: at each tick every neuron computes its new output from the _previous_ tick's outputs of its source neurons, which is necessary because a recurrent network has cycles and therefore no valid topological order.

```text
inputSum   = bias + Σ (weightᵢ × previousOutput(sourceᵢ))
memory_t+1 = decay × memory_t + inputSum
fired      = memory_t+1 ≥ threshold
output_t+1 = activation(memory_t+1)
if fired: memory_t+1 = memory_t+1 × dischargeFactor
```

`decay`, `bias`, `threshold`, `dischargeFactor` and the choice of `activation` (from a small evolvable set: tanh, sigmoid, sin, step, …) are all genes. `memory` is the leaky integrator giving a neuron persistence across ticks. `threshold` and `dischargeFactor` enable integrate-and-fire behaviour: a neuron can accumulate silently for many ticks then discharge at once, or integrate continuously without ever firing.

### Synapses

Synapses are encoded in the genome, each with a source, a destination and a weight.

### A single network

Organelles can have inputs and outputs: eyes produce sensory signals, thrusters receive control signals, lungs receive activation signals, neurons do both. Organelles and neurons share one identity space, so a synapse can connect two neurons, a neuron and an organelle, or two organelles — modelling brain and body as a single network.

---

## Sight

_(v0.2+.)_

Eyes observe a vision cone whose shape depends on the eye's position: closer to the rim means narrower and more specialised, closer to the centre means broader coverage and less specialisation. Viewing distance depends on eye size.

Eyes have no concept of predator, prey or mate. They perceive physical characteristics only — principally colour.

### Colour

From v0.2, colour derives from body composition: green for chloroplasts, red for muscle, blue for lungs, yellow for eyes. Organisms can use it to recognise similar individuals, potential mates and potential prey.

In v0.1 a body's hue comes instead from `lineageHue`, a heritable gene with no physiological effect that drifts slightly each generation — a neutral marker locus, the same tool population geneticists use to track descent. On screen, related organisms share a colour, so a clade sweeping the population is visible as a wave of colour and coexisting strategies show as stable patches.

`lineageHue` lives in the genome, not in the rendering layer. The moment v0.2 eyes can perceive it, it stops being neutral: mimicry, aposematism and kin recognition all become evolvable, and colour becomes a signal that can lie. How that reconciles with composition-derived colour is an open v0.2 decision.

---

## Movement

### Physics

At the scale being modelled — microorganisms in water — inertia is irrelevant. Motion is **overdamped**: velocity is proportional to force rather than to its derivative, with drag following Stokes' law.

```text
drag      ∝ radius
velocity   = totalForce / drag
position  += velocity × dt
```

In v0.1 the only force is brownian, and bodies have no rotation: a circle with no organelles has no visible orientation, so rotation arrives in v0.2 together with the organelles whose placement makes it matter. It will follow the same law, with rotational drag.

The tick is the simulation's own unit of time, so every world quantity is expressed per tick and `dt` is 1 by construction. The formulas in this document carry `× dt` to show which quantities are rates; the code leaves it out, because multiplying by one is not a computation. How many milliseconds a tick stands for is the render loop's business, and never enters a world quantity.

A consequence worth stating: an organism that stops pushing stops immediately. There is no coasting, and inertial gliding can never become an evolvable strategy.

Because the diffusion coefficient goes as `1/r`, large organisms wander slowly and stay near where they were born, while small ones diffuse quickly and average out the light gradient. Large size therefore means _higher variance_ in lifetime light income.

### Collisions

Overlaps are resolved by **positional separation**: bodies are displaced apart along their normal, split in proportion to `1/area`, with no impulses and no restitution. Corrections accumulate in a buffer and are applied once, so the result does not depend on iteration order.

One pass runs per tick, which makes overlap decay across ticks rather than vanish within one. Two things follow, both measured rather than assumed (ADR-0008). A crowd left alone settles until its bodies are merely touching, asymptotically, so there is no tick on which the overlap reaches zero. And where bodies are piled deep enough to overlap five or six neighbours at once, the summed correction can push one further into a seventh, so the worst overlap in the world climbs for a tick here and there on the way down.

Collisions are not decoration. Light is the only spatially localised resource in v0.1, so volume exclusion is what makes the photic zone finite — and the only way one organism's existence costs another anything.

### Thrusters

_(v0.2+.)_ Each thruster has a position and an orientation. When activated it generates a force along its own direction, contributing to both linear motion and rotation — which is what makes organelle placement matter. Under overdamped physics, a thruster's output maps directly to a speed.

---

## Environment

### Light

A vertical gradient, strongest at the surface and weakest at depth.

### Fluids

**v0.1**: no spatial fluid grid. O₂, CO₂ and food are global well-mixed pools.

**v0.2+**: O₂ and CO₂ become spatial fields simulated with a simple fluid solver, following _Real-Time Fluid Dynamics for Games_ (Jos Stam) and _Fluid Simulation for Dummies_ (Mike Ash).

### Boundaries

The world is finite and bounded by hard walls. No toroidal wraparound and no infinite space: a fixed-size collision grid is simpler, and the aquarium metaphor needs a real surface and a real floor for the light gradient to mean anything.

Calibrated at M1 to 60 × 40 baseline body radii, landscape so the light gradient has somewhere to run from surface to floor, and sized so a generation-0 population reads as a sparse culture under a microscope: crowded enough that bodies meet, open enough that a lineage has somewhere to spread into. Every length in the simulation is written as a multiple of the baseline radius and never in pixels.

---

## Reproduction

### Mitosis

Available to every organism. The model is **budding**, not a literal split: the parent does not shrink.

Reproduction has a hard physical requirement and a genetic strategy gate:

```text
Physical requirement (not genetic, not bypassable):
  energy ≥ mitosisEnergyCost(childArea)
  food   ≥ mitosisMassCost(childArea)

Strategy gene:
  attempt mitosis when  energy ≥ mitosisEnergyThreshold × cap(energy)
```

The child's body mass is paid out of the parent's internal food store — matter, not just fuel. `childAllocationRatio` then splits only what remains after both costs are paid.

Further details:

- the child's genome is mutated _before_ its area, costs and caps are computed
- `childAllocationRatio` is a single gene shared by all internal resources
- if a child cannot hold its full allocation, it receives up to its own caps and the excess stays with the parent
- the child is born tangent to the parent at a random angle; any residual overlap is resolved by the normal collision system
- each gene mutates with independent probability, so some births are exact clones

### Initial population

At generation 0, N organisms (indicatively 20–50, adjustable) are placed at random positions, each independently mutated from a common, minimal **baseline genome**. Not identical clones, not fully random genomes — variance from tick zero for selection to act on.

Each organism's initial internal resources are set so that tick 0 is already **diffusive equilibrium**: the three diffusibles start at exactly the ambient concentration, so nothing crosses a membrane until metabolism moves it. A run therefore opens on the thing worth watching rather than on a filling transient.

Energy is the exception, because it neither diffuses nor has an ambient value to match. It starts at **half its cap**, so a run reads immediately as charging or discharging instead of beginning pinned to an extreme.

### Sexual reproduction

_(v0.2+.)_ Requires dedicated organelles. Possible strategies include direct fertilisation, gamete release, egg laying, internal gestation and seeds. Crossover will be defined together with the final genome structure.

---

## Genome

### v0.1

The v0.1 genome is a minimal organism-level record, not yet the structural `Gene[]`:

| Gene                     | Range    | Mutation                 | Role                                          |
| ------------------------ | -------- | ------------------------ | --------------------------------------------- |
| `bodyRadius`             | > 0      | multiplicative           | body size                                     |
| `mitosisEnergyThreshold` | `[0, 1]` | additive, clamped        | fraction of energy cap before reproducing     |
| `childAllocationRatio`   | `[0, 1]` | additive, clamped        | share of remaining resources given to a child |
| `lineageHue`             | `[0, 1)` | additive drift, wrapping | neutral visual marker                         |

Both reproduction genes are dimensionless ratios. Making them fractions rather than absolute amounts is what keeps them independent of `bodyRadius` and makes sterile lineages impossible.

Every other world coefficient — reaction efficiencies, caps, metabolic constants — is a global law of the simulation, not a gene.

The three functional genes give a real strategic axis to watch: a low threshold means breeding early and thin, a high one means hoarding and breeding fat.

### v0.2+

```text
Gene[]
```

Each gene is a discriminated union — `OrganelleGene | NeuronGene | SynapseGene` — with a type-specific payload plus common fields:

- `id`: a stable historical identifier, assigned once from a monotonic global counter and preserved through mutation, duplication and inheritance (NEAT-style innovation numbers)
- `active`: an activation flag

Stable ids are what let a gene recognise itself across generations. They are needed immediately, because a synapse references the ids of its source and destination — which may be neurons or organelles — and they will be needed to align genes during crossover. Aligning by array position breaks as soon as two lineages duplicate genes differently: the competing-conventions problem.

---

## Mutations

### Goal

Mutations must be resilient. Most should be neutral, slightly negative or slightly positive. Catastrophic ones should be rare.

### v0.1

- `bodyRadius` mutates multiplicatively
- `mitosisEnergyThreshold` and `childAllocationRatio` mutate additively and are clamped to `[0, 1]`
- `lineageHue` drifts additively and wraps
- each gene mutates with independent probability, so some births do not mutate at all

### v0.2+

The full mutation space, applicable once the structural genome exists:

- **parameter changes** — size, position, orientation, type-specific parameters
- **synaptic weight changes** — small continuous variations
- **duplication** — of organelles, neurons and genes; considered one of the principal sources of complexity
- **deletion** — removal of existing genes
- **activation / deactivation** — genes can exist in an inactive state, letting evolution experiment with new structures at no immediate cost

Excluded initially: direct transformation of one organelle into another, and drastic structural mutations.

New organelles are born very small, cost very little, and can grow over subsequent generations.

---

## Simulation

### Tick

Simulation and rendering are separate; simulation speed does not depend on frame rate.

v0.1 runs on the main thread with a fixed-step accumulator decoupled from `requestAnimationFrame`. World quantities are expressed as rates over time and multiplied by `dt`, never per frame. If rendering falls behind, the accumulator processes multiple fixed ticks, with a catch-up cap so a pathologically long frame cannot trigger a recovery storm.

### Tick pipeline

The tick has three phases — read, resolve, commit — so that the world is mutated exactly once, at a single well-defined point.

```text
PHASE 1 — read
  1. sample concentrations and light → read-only snapshot for the whole tick

PHASE 2 — per organism, in index order (no writes to the world)
  2a. request exchange      → register the wanted flux; write nothing
      — settle              → per-pool scaling factor from total demand
  2b. receive the grant     → accumulate grants into the delta buffer
  3. photosynthesis         CO₂ + light → food + O₂        (internal state only)
  4. respiration            food + O₂ → energy + CO₂       (internal state only)
  5. maintenance            energy −= (c₀ + β·area) × dt
  6. brownian motion        draw a direction, position += force / drag
  7. evaluate mitosis       → enqueue a pending birth
  8. evaluate death         → enqueue a pending death

PHASE 3 — commit
  9.  apply the delta buffer (proportional scaling if a pool would go negative)
  10. collisions and wall constraints
  11. apply deaths  → return body mass and internal contents to the pools
  12. apply births  → mutate the genome, pay the costs, append to the population
  13. tick++
```

Steps 3–5 write only to the organism they are running for, so the metabolic core is order-independent by construction and unit-testable against a single organism and a snapshot, with no world required. They are no longer purely _internal_, though: they read the grant the world computed collectively in the settlement, which is what makes caps and floors exact rather than argued.

Steps 3 and 4 are **chained**, not merely ordered: respiration reads the food photosynthesis has just produced, so an illuminated organism closes the whole cycle within one tick and the net is `light → energy`, which is what a plant actually does. The price is that the order of those two steps is a law of the world rather than a matter of presentation, and reordering them changes behaviour.

Newborns are appended at step 12 and are therefore **inert for their first tick** — the current iteration never sees them, which rules out half-initialised organisms metabolising and birth cascades within one tick.

Deaths are applied at step 11, before births at step 12, deliberately: a corpse's carbon lands in the pool for the _next_ tick's diffusion. Every carbon transfer within a tick is one-directional, which makes the conservation assertion checkable at exactly one point — the end of step 13.

In v0.2 the missing steps (eyes, neurons, active organelles, thrust) slot in between steps 5 and 6.

### Determinism

A single master seed drives all randomness, split into independent streams:

```text
masterSeed
  ├── global stream    → initial placement, baseline genomes
  └── per organism     → its own PRNG state (uint32)
        at birth: child.rngState = parent.rng.next()
```

An organism's random sequence depends only on its own lineage — not on population size, not on array position, not on unrelated world code. Reordering the population changes nothing, a single lineage can be replayed in isolation to debug it, and changing world-level code does not shift any organism's stream.

The guarantee is **same seed + same build + same engine ⇒ identical run**. Bit-identical results across JavaScript engines are not promised: `Math.exp`, `Math.pow`, `Math.sin` and `tanh` are implementation-defined to the last ulp, and in a chaotic system that diverges. Light attenuation is precomputed into a lookup table partly for this reason, so v0.1's inner loop uses arithmetic only.

### Collision detection

A **uniform grid** (spatial hash), rebuilt from scratch every tick.

---

## Interface

### v0.1

A fullscreen Canvas2D view with:

- start, pause, and single-tick step while paused
- zoom and pan
- a HUD showing tick, seed, population, worst penetration depth (the no-overlap invariant), the three pool levels, total carbon and total oxygen as **relative drift since tick 0** rather than as absolute values — a large number moving in its twelfth digit hides exactly what the conservation invariant is about — the count of organisms sitting at zero energy, the measured `α`, and mean ± σ of each gene
- CSV export of that time series

Rendering encodes state directly: **hue** is `lineageHue`, **brightness** is the energy fraction, **radius** is `bodyRadius`. Dying organisms visibly fade, so starvation waves and boom–bust cycles are readable without opening the CSV.

CSV export is the one deliberate exception to having no persistence. It stores observations, not simulation state, so there is no schema to version — and it is the only way to compare runs offline.

There is no run persistence: closing the tab loses the run.

### Future

Selecting an organism will show its organelles, resources, age, statistics and neural network. Possible additions: picture-in-picture, a genealogical tree, synapse visualisation.

---

## v0.1 scope and stack

**Platform.** A pure client-side browser application: no server, no backend, no multiplayer. A run lives entirely in one tab.

**Rendering.** Canvas2D. A WebGPU migration is planned later, for rendering and/or compute (collision detection, fluid dynamics). Current architectural decisions keep that migration in mind without letting it complicate v0.1.

**Data structures.** OOP (`Organism` / `Organelle` classes), not SoA typed-array layouts. A deliberate choice: simpler to write now, at the cost of a larger rewrite of hot-path data when WebGPU arrives and flat buffers are needed.

**Threading.** Main thread, not a Web Worker. OOP objects do not cross a worker boundary well — class instances are not structured-cloneable — so a worker would mean serialising state every tick just to stay in sync. To be revisited only if profiling shows a real bottleneck, at which point OOP would be revisited too.

**Toolchain.** npm, Vite, Vitest, TypeScript in strict mode, ESLint + Prettier.

**Testing.** TDD (red–green–refactor) for pure, deterministic simulation logic: metabolism, mutation and genome, spatial grid queries, the neuron update rule. No TDD for the rendering layer or the `requestAnimationFrame` loop — those are verified by running the app.

**Persistence.** None. To be revisited once the data formats settle beyond v0.1; adding it now would mean versioning a schema that is still moving.

**Scale.** No population target. Build it, profile it, and let the current stack find its own natural limit. Needing to exceed that limit is the trigger for reconsidering WebGPU — not an a-priori prediction.

### In scope

The minimal organism, built end to end, with no organelles:

- circular body with brownian motion under overdamped physics
- passive photosynthesis and respiration, with three closed global pools
- flat existence cost plus area-scaled body cost
- mitosis with mutation via seeded PRNG; four-gene genome
- initial population mutated from a common baseline genome
- uniform-grid collision detection with positional separation, hard walls
- Canvas2D rendering; start / pause / single step / zoom / pan; HUD and CSV export
- death by starvation

### Deferred to v0.2+

- organelles (eyes, thrusters, real neurons and synapses, chloroplasts, …)
- spatial fluid simulation
- sight and colour perception
- gravity and buoyancy, alongside thrusters
- sexual reproduction and crossover
- selecting and inspecting an organism
- scavenging as real behaviour
- persistence

---

## Definition of done for v0.1

Two automated invariants and one scientific criterion.

1. **Conservation.** Total carbon and total oxygen hold constant to floating-point tolerance across 100k ticks. This is the single best bug detector the project has: nearly every metabolic bug surfaces first as a leak in these numbers. It also becomes the test that guards the v0.2 fluid solver, whose semi-Lagrangian advection is stable but not mass-conserving.

2. **Determinism.** The same seed yields an identical state hash at tick N, across runs on the same build and engine.

3. **Selection, not drift.** Population means of each gene converge to the same neighbourhood from different seeds and different baseline genomes. The decisive check is `r_opt = 2·c₀/α`, computed from the constants and from the `α` measured in M2's selection-free world (ADR-0015): drift does not converge on a number predicted in advance, only selection does. When simulation meets the closed-form prediction, v0.1 is correct.

### Calibration method

Non-dimensionalise rather than guess. Fix `kCap = 1` (defining the concentration unit), `β = 1` (defining the energy unit) and `ρ = 1` (carbon per unit area), and set the length unit to the baseline radius — three constants eliminated by construction. Choose the `r_opt` you want to see and derive `c₀` from it. Express the initial pools as a **carbon budget** phrased as "enough carbon for K baseline organisms, the remainder dissolved", so the number being tuned is an ecological one you have intuitions about.

`K` stays the input and the ambient concentration falls out of it in closed form, with no iteration, because requiring tick 0 to be at diffusive equilibrium ties the internal stores to the ambient value. With `A = Σ bodyArea` over the generation-0 population and `s` the total ambient carbon concentration:

```text
K · π = A + (A + aquariumArea) · s      →      s = (K·π − A) / (A + aquariumArea)
```

`s` then splits between CO₂ and food. A world that starts CO₂-rich and food-poor opens on carbon fixation in the photic zone, which is the story the closed cycle is there to tell.

Oxygen is an independent knob, since the CO₂ term already carries oxygen of its own: choose the ambient O₂ concentration directly and let the oxygen budget follow.

---

## Milestones

Each milestone is independently runnable and adds exactly one invariant. The ordering exists so that a broken invariant has one possible cause.

| #   | Branch                        | Ships                                                                                                                                   | Invariant added                                                                           |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| M0  | `feature/simulation-skeleton` | toolchain; fixed-step accumulator with catch-up cap; seeded PRNG and per-organism streams; canvas, pan/zoom, play/pause/step, HUD shell | same seed ⇒ same state hash                                                               |
| M1  | `feature/bodies-and-motion`   | organism circles, Stokes drag and brownian motion, uniform grid, positional separation, walls, `lineageHue` rendering                   | overlap decays to touching, and stays under a ceiling on a live run; correct grid queries |
| M2  | `feature/metabolism`          | `Environment` seam, pools, light LUT, signed diffusion, photosynthesis, respiration, maintenance, caps — **fixed, immortal population** | carbon and oxygen conserved over 100k ticks                                               |
| M3  | `feature/death`               | death by starvation; mass and contents returned to pools                                                                                | conservation survives death                                                               |
| M4  | `feature/reproduction`        | genome, mutation, mitosis costs, allocation, tangent birth, baseline population                                                         | conservation survives birth                                                               |
| M5  | `feature/calibration`         | HUD statistics, CSV export, constants solved for target `r_opt`, done-criteria runs                                                     | population converges to predicted `r_opt`                                                 |

M2 runs with a fixed, immortal population on purpose: metabolism is where conservation bugs live, and isolating a leak is far easier with `N` pinned. M3 and M4 then each add exactly one new way to move mass.

Immortality in M2 is a **clamp, not an exemption**: maintenance is charged in full and energy simply floors at zero, where an organism sits, still diffusing, able to recover if food drifts its way. Dropping the cost instead would mean M2 never exercises the path M3 and M5 depend on. An organism parked at zero is precisely the one M3 will bury, which is why the count of them is worth a HUD row a milestone early.

M0 front-loads pan, zoom, pause and step because they are debugging tooling, used in every milestone that follows.

---

## Future directions

- growth during life
- embryonic development
- organelle damage
- organelles created or destroyed during life
- more complex reproduction
- asynchronous organelle simulation
- full genealogy
- manual genome editor
- user-designed organisms
- richer metabolic systems
- new organelle types
- advanced brain visualisation

---

## Ultimate goal

To observe complex ecosystems emerge spontaneously from extremely simple organisms, without ever programming a behaviour, a species or a strategy directly.
