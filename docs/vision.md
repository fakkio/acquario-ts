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

| Capability           | Organelle      | Arrives |
| -------------------- | -------------- | ------- |
| Processing           | Neuron         | v0.2    |
| Movement             | Thruster       | v0.2    |
| Buoyancy             | Float          | v0.2    |
| Photosynthesis       | Chloroplast    | v0.2    |
| Sight                | Eye            | v0.3    |
| Defence              | Carapace       | v0.3    |
| Attack               | Teeth / Spines | v0.3    |
| Advanced respiration | Lung / Gill    | v0.4    |
| Storage              | Vesicle        | v0.4    |
| Sexual reproduction  | Gonad          | v0.5    |
| Egg laying           | Uterus         | v0.5    |

Versions after v0.2 are tentative. v0.2's four types are its **roster**, the set an insertion draws from (ADR-0032).

Organisms can survive with no organelles at all. Organelles are evolutionary optimisations of capabilities every organism already has.

### The minimal organism

Every organism has innate capabilities, even with no organelles. This is the only kind of organism that exists in v0.1.

**Passive exchange.** Resources cross the membrane by diffusion, at a rate proportional to the body's perimeter and to the difference in concentration between inside and outside. One signed law governs oxygen, carbon dioxide and food alike; a negative flux is an organism venting a resource back into the world.

**Passive photosynthesis.** `CO₂ + light → food + O₂`. Carbon fixation, not energy production. Its rate scales with the width the body projects toward the light, i.e. with diameter.

**Passive respiration.** `food + O₂ → energy + CO₂`. The sole source of energy in the simulation. Both reactions are extremely inefficient — that inefficiency is what organelles later improve on.

**Passive movement.** Organisms without thrusters are subject to brownian motion, which lets them drift slowly and encounter one another. From v0.2 gravity weighs organelles only, so a body with none neither sinks nor floats (ADR-0030).

**Passive reproduction.** Every organism can reproduce by mitosis once it holds enough energy and food-mass.

---

## The body

### Shape

In v0.1 every organism is a circle, and a body has a position and nothing else kinematic: motion is overdamped, so there is no velocity to carry between ticks, and a circle with no organelles has no visible orientation to rotate. Rotation and angular velocity arrive in v0.2 with the organelles that make them matter, because organelles have a position relative to the body's centre, and a thruster a direction too.

### Organelles

_(v0.2+ — no organelles exist in v0.1.)_

Each organelle is a circle with a type, a position relative to the body centre, a radius and the parameters its type declares. Orientation is one of those only for a type that uses it: a disc that reads light where it sits is the same at any angle, so in v0.2 only the thruster has one (ADR-0032). Size determines both energy cost and effectiveness: a larger lung holds more gas, a larger thruster produces more thrust, a larger eye sees further.

An organelle runs the passive capability it improves on its own disc, with a better coefficient, so a rate-producing organelle's effectiveness scales with its **radius**, as passive photosynthesis scales with the body's diameter. A chloroplast fixes `kChloro × light × 2·r_c × C_internal(CO₂)`, reading light at its own position in the world rather than at the body's centre. It only fixes carbon: it has no exchange surface of its own, so its ceiling is the CO₂ the body's perimeter lets in, and lifting that ceiling is a gill's job (ADR-0029).

v0.2's roster (ADR-0032):

| Type        | Parameters beyond radius and position       | Organelle density | Ports                    |
| ----------- | ------------------------------------------- | ----------------- | ------------------------ |
| Chloroplast | none                                        | `ρ_w(H) + Δ/2`    | none                     |
| Float       | none                                        | `ρ_w(0) − Δ`      | none                     |
| Thruster    | `orientation`, `drive`                      | weightless        | input `power`            |
| Neuron      | `τ`, `bias`, `threshold`, `dischargeFactor` | weightless        | input `in`, output `out` |

The float does one thing, lift. It has no collapse depth and no port, so its density cannot be regulated.

A neuron is an organelle type like any other, with a position, a size and a place in the layout, though for a neuron they mean only cost and space (ADR-0031). A synapse is not an organelle: it is a relation between an output port and an input port, with no geometry (ADR-0028, ADR-0031).

### Body construction

_(v0.2+.)_ The genome defines organelle layout. When an organism is generated:

1. organelles are created
2. overlaps are detected
3. a relaxation algorithm separates them
4. the minimum enclosing circle is computed
5. the **cytoplasm thickness** gene is added to its radius

The result becomes the body, centred on that circle. With no organelles the circle is empty and the body's radius is the cytoplasm thickness alone, which is v0.1's minimal organism. A mutation producing overlapping organelles must never cause immediate death.

Because the body follows its layout, an organelle's position changes the body's size, and so what a child costs. The relaxation algorithm is left to the milestone that builds it, under one contract the Birth Cost Ceiling depends on: an event that adds `Δd` of diameter or moves an organelle by `d` grows the enclosing radius by at most `Δd + d` (ADR-0028).

### Internal capacity

Storage capacity is the **cytoplasm area**, `bodyArea − Σ organelleArea` — the space left over, a kind of internal circulatory system holding energy, oxygen, carbon dioxide and food. In v0.1 there are no organelles, so it is the whole body.

These stores are independent rather than competing for one shared volume. Each resource has its own cap:

```text
cap(resource) = kCap(resource) × cytoplasmArea
```

Because a cap scales with area, it is really a maximum internal _concentration_, and internal concentrations are taken over the same area: an organelle occupies space that holds no stores, which makes its area a storage cost as well as an energy one (ADR-0029). `cytoplasmThickness > 0` keeps that area strictly positive. Direct competition for a single internal volume is not in v0.2: no storage organelle exists to make it matter.

`kCap` is **1 for CO₂ and O₂** and larger for food. It carries `ρ`'s own dimension, so only the ratio `kCap/ρ` is physical: `ρ` alone fixes the carbon unit, and setting both to 1 was one unit choice plus one silent assertion — that an organism can hold exactly its own body's worth of a diffusible. That assertion is load-bearing at mitosis, where it would force a parent to sit at exactly 100% of its food cap to afford a child, so food is given headroom of its own (ADR-0022). Energy gets `kCapEnergy`, because energy is not a carbon or oxygen quantity and its unit is fixed independently by `β = 1`.

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

That ceiling is a breeding ceiling rather than a starvation one, and it has a closed form. Growth locks carbon into bodies, so the ambient concentration falls as the population rises, and reproduction stops of its own accord once ambient carbon drops below body density (ADR-0022). The calibration method below runs that relation backwards to choose the carbon budget.

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

The same supply-limitation has one consequence the closed form does not carry. Internal concentrations falling with `r` means the mitosis mass gate, which is a threshold on one of them, imposes a **maximum reproductive radius**: above it an organism earns perfectly well and can never afford a child. M5 measures that radius and the income exponent, and gates on them before treating convergence on `r_opt` as evidence of anything (ADR-0025).

Saturating (Michaelis–Menten) kinetics are the fallback if the dynamics turn out stiff; they cost one extra constant per substrate and buy nothing until they are needed.

**Throttle, never spill.** A reaction runs at `min(rate, substrate available, product headroom)`. Spilling a product past its cap would create or destroy carbon and break the invariant on the first tick. Spilling _energy_ would not — energy is not conserved — but respiration is throttled by a full energy store anyway: it is the right physical reading, since nothing burns fuel with nowhere to put the result, and it stops a full organism strip-mining the food pool for nothing.

### Light

Light comes from above and attenuates exponentially with depth:

```text
I(y) = I₀ · e^(−k·y)
```

Organisms nearer the surface receive more of it. In v0.1 attenuation is precomputed into a lookup table indexed by depth, so no transcendental function is evaluated in the simulation loop.

`I₀ = 1`, defining the light unit the same way `ρ = 1` defines the carbon unit. `k = ln(10)/10`, so light falls to a tenth of its surface value at a depth of ten baseline radii: the bright zone is the aquarium's top quarter, which makes the founder effect below a real spatial split rather than a gradient washing over everything equally.

The table samples every `0.1` baseline radii over the aquarium's height and is read with **linear interpolation**. Interpolating costs `+ − × ÷` only, so the arithmetic-only property is kept; reading the nearest entry instead would quantise the gradient into steps wide enough for a lineage to settle on one.

Light is sampled at the **body's centre**, not at its upper edge. The projected-width factor in the photosynthesis rate already carries the body's size, and sampling the edge would hand a large body a second advantage nothing in the model intends.

Because v0.1 has no thrusters and no gravity, depth is not under genetic control. What light produces instead is spatial heterogeneity of income, plus a **positional founder effect**: since children are born tangent to their parents, position is quasi-heritable, and a lineage that happens to sit in the bright zone breeds faster and passes on the good address. Genetic control of depth arrives in v0.2 with buoyancy: organelles denser or lighter than a stratified water column give each body a depth it rests at for free, and thrusters move it away from there at a price (ADR-0030).

This also gives v0.1 two ways to live from a single genome, and only one of them is a way to persist. In the light an organism fixes carbon and can build a child. In the dark it survives on food absorbed passively from the pool — food that corpses put there — but it cannot breed: respiration steadily turns its internal food into CO₂ and nothing turns it back, so a dark body fills with carbon in the wrong chemical form (ADR-0023). Its energy balance admits a band of radii centred well above `r_opt`, so the dark is a habitat of rare large bodies with no lineages in it, populated by emigrants from the light. v0.2's eating is what opens it.

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

Death is evaluated at step 8 and applied at step 11, and what travels between them is **remains**: a frozen record of the organism's position, its three diffusible stores and its body mass. Frozen, because collisions run at step 10, so a condemned organism is still separated and still moves on its final tick — and it died where its energy ran out, not where its neighbours left it. Remains are deposited through a method of their own rather than through `exchange`, since a deposit is always a credit, never scaled and never partial, and the deposit is summed order-independently for the same reason grants are (ADR-0017).

Mortality is a property of the world, not of the milestone: a world is constructed with it on or off. The immortal world is an instrument rather than M2 scaffolding, because ADR-0015 measures `α` in a world where nothing can select, and M5 must be able to measure it again after calibration moves the constants.

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

`α` is **not** one of the world's constants (ADR-0015). Energy comes only from respiration, whose substrate arrives by photosynthesis — proportional to the light at _this_ depth — and by food diffusion — proportional to how rich the pool currently is. So `α` is a field over the aquarium and a function of time, and it is measured rather than declared. M2 reports the population mean; M5 solves `c₀` against the mean over the **bright band**, because selection acts only through reproduction and reproduction happens only in the light (ADR-0023). There is no circularity, because `α` is measured in a fixed population where nothing can select, and the prediction is fixed before the world that tests it exists.

### Organelle costs

_(v0.2+.)_ Every area in a body is paid once, at the rate of whatever occupies it, and each organelle and synapse pays a flat **organelle overhead** (ADR-0029):

```text
maintenance = c₀ + β · cytoplasmArea
            + Σ organelles (c_type + β_type · aᵢ)
            + Σ synapses   c_synapse
```

With no organelles this is v0.1's `c₀ + β·area` exactly. `β_type` says what a type's tissue costs relative to cytoplasm; in v0.2 every type's is `β` (ADR-0032). There is no construction cost at birth: a child's mass is still `ρ · bodyArea`, and everything else an organelle costs it pays per tick.

That combination is what makes the size/number trade-off real. Effectiveness scales with radius, so dividing an organelle's area into `n` pieces raises its output as `√n` at the same area cost, and a split always looks attractive. Two things push back: every piece pays its own overhead, and more circles need a wider enclosing circle, so the body, its cytoplasm and a child's mass grow. The overhead is what bounds the count, and it gives each type a closed-form optimal organelle radius, the same shape as `r_opt`:

```text
r*_type = c_type / k_type
```

Where the balance falls depends on the organelle type — which is exactly the variety worth having — and, for a chloroplast, on depth: its `k` carries the light and the internal CO₂, which falls as fixation nears the CO₂ the body's perimeter lets in, so few large chloroplasts pay near the surface and many small ones in the dark.

A new organelle is born small, so a fixed overhead leaves it in the red until it grows. Insertion must be near-painless, so `c_type` is derived from the insertion size rather than the other way round: an organelle inserted where its type works starts near break-even (`r_new ≈ r*/2`). Only the chloroplast's output is energy, so only it has a closed-form `r*`; the float and the thruster share its overhead, one `c_organelle` for all three (ADR-0032). A neuron's overhead and a synapse's are small, so new network structure is cheap and near-neutral.

Position matters too: a chloroplast reads light where it sits, and an eye near the centre sees almost omnidirectionally, an eye near the rim sees a narrow, specialised cone.

Sublinear effectiveness favours the generalist carrying two substitutable routes over the specialist committed to one. In v0.2 there is no second route to specialise into: every organism respires, and food intake beyond diffusion arrives with eating. So v0.2 observes specialisation rather than paying for it, and the question reopens in v0.3 on the axis chloroplast against food intake (ADR-0029, superseding ADR-0014).

### Activity costs

_(v0.2+.)_ A thruster pays in proportion to the force it produces, `k_thrust × |F|` per tick, not the physical power `F·v`: under Stokes drag, power would make holding depth against gravity at rest free. Neurons pay no activity cost; they evaluate every tick anyway, so their overhead already covers it.

---

## Nervous system

_(v0.2+.)_

### Philosophy

No layered neural networks. The target is evolved recurrent networks whose _topology_ is inspired by liquid state machines, reservoir computing and recurrent neural networks: sparse, recurrent, not organised into layers.

These references concern topology only, not learning. There is no training within an organism's lifetime — no trained readout, no backpropagation. Every network parameter changes solely through mutation between generations, exactly like any other gene.

### Neurons

Neurons are organelles. Updates are synchronous: at each tick every neuron computes its new signal from the _previous_ tick's signals of its sources, which is necessary because a recurrent network has cycles and therefore no valid topological order.

```text
inputSum = bias + Σ (weightᵢ × previousSignal(sourceᵢ))
memory  ← decay · memory + (1 − decay) · inputSum          decay = 1 − 1/τ
signal   = tanh(memory)
if memory ≥ threshold: memory ← memory × dischargeFactor
```

`memory` is a leaky integrator moving _towards_ its input, so a constant input `u` settles at `u` whatever the memory length: time constant and gain are separate (ADR-0031). The genes are:

- **`τ`**, the time constant in ticks: symmetric multiplicative, floored at 1, where the neuron has no memory;
- **`bias`**, additive, born at 0, the centre-crossing point of `tanh`;
- **`threshold`**, additive;
- **`dischargeFactor`**, additive in `[0, 1]`.

A neuron is born with `dischargeFactor = 1`, where firing changes nothing and the neuron is a plain continuous-time recurrent neuron. As the factor falls, the reset strengthens continuously, so every behaviour from "always on" to "accumulate silently, fire, reset" is reachable from one neuron in small steps. A latch needs no discharge at all: a self-synapse of weight above 1 is bistable, and a pulse switches it between its two states.

`tanh` is v0.2's only activation, so signals lie in `[−1, 1]`. Any function added later must share its value 0 and slope 1 at zero (`sin`, a clamped identity), so that switching between them stays near-neutral.

A neuron's size and position carry no meaning beyond its cost, its space and its place in the layout. Tying gain or time constant to radius would make a split change both pieces and lose its exact neutrality, so neurons are left to shrink under their own cost.

### Ports and synapses

Every organelle type declares named **input ports** and **output ports**. A synapse joins an output port to an input port with a weight, and is encoded in the genome. A port takes any number of synapses: an input port receives the weighted sum of its synapses' signals from the previous tick, and each type decides what to do with that sum; an output port carries one signal per tick. Self-synapses are allowed, and so is a synapse straight from a sense to an actuator, a reflex with no neuron between.

In v0.2 a neuron has one input and one output port; a thruster has one input port. A thruster's signal is `clamp(drive + Σ, 0, 1)` and it pushes with that fraction of its maximum force, forward only. With nothing wired to it, it runs at its `drive`, a flagellum at constant thrust.

### Innate senses

The body itself is an endpoint, with one reserved id and output ports only. Those ports are the **innate senses** every organism has, the passive version of what a sensor organelle would improve:

- `energy`, `food`, `O₂`, `CO₂`: each store over its cap, in `[0, 1]`;
- `light`: light at the body's centre, in `[0, 1]`, which in v0.2 is also its depth;
- `up` and `tilt`: `cos θ` and `sin θ` of the angle between the body's axis and the vertical, in `[−1, 1]`.

v0.2 has no sensor organelles; the eye (v0.3) is the first.

### A single network

Organelles and the body share one identity space and one port model: eyes will produce signals, thrusters receive them, neurons do both. A synapse can connect two neurons, a neuron and an organelle, a sense and an organelle, or two organelles, modelling brain and body as a single network.

---

## Sight

_(v0.2+.)_

Eyes observe a vision cone whose shape depends on the eye's position: closer to the rim means narrower and more specialised, closer to the centre means broader coverage and less specialisation. Viewing distance depends on eye size.

Eyes have no concept of predator, prey or mate. They perceive physical characteristics only — principally colour.

### Colour

A body's hue comes from `lineageHue`, a heritable gene with no physiological effect that drifts slightly each generation — a neutral marker locus, the same tool population geneticists use to track descent. On screen, related organisms share a colour, so a clade sweeping the population is visible as a wave of colour and coexisting strategies show as stable patches.

v0.2 keeps it that way. Composition reaches the screen by drawing the organelles inside the body, each in its type's colour (see Interface), not by recolouring the body: the organelles already show what a body is made of, and recolouring would erase the one instrument that shows which lineage is winning. The screen is not an eye, so nothing an organism can perceive is decided here (#50).

`lineageHue` lives in the genome, not in the rendering layer. The moment v0.3 eyes can perceive it, it stops being neutral: mimicry, aposematism and kin recognition all become evolvable, and colour becomes a signal that can lie. What a body shows to an eye — composition-derived colour (green for chloroplasts, red for thrusters, …), `lineageHue`, or both — and how the arbitrary marker reconciles with honest signalling is an open v0.3 decision. The screen's type palette does not bind it.

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

Because the diffusion coefficient goes as `1/r`, large organisms wander slowly and stay near where they were born, while small ones diffuse quickly and average out the light gradient. Large size therefore means _higher variance_ in lifetime light income. It is also a selective pressure on `bodyRadius` that `r_opt` does not carry, since a small body leaves the bright band before it has bred many times, which is why ADR-0025 gates on **tenancy**.

### Gravity and buoyancy

_(v0.2+.)_ Gravity is one more force in the overdamped sum, and it weighs **organelles only**, against water that grows denser towards the floor (ADR-0030):

```text
buoyantWeight = g · Σ organelles (ρ_type − ρ_w(y_i)) · a_i        positive = down
velocity     += buoyantWeight / (6π · r)
```

Each type declares an **organelle density** `ρ_type`, a constant and never a gene, and it is separate from `ρ`, which is carbon per area: a light organelle costs the same carbon at birth as any other area. The cytoplasm is water inside the membrane and neutral at every depth, stores included, so a body with no organelles moves exactly as in v0.1. There is no density gene: a body's density is what its organelles are made of.

A type weighs only when weight is what it does or what it costs (ADR-0032). The float's lift is its function, and the chloroplast's weight is the price of photosynthesis: `ρ_float = ρ_w(0) − Δ` and `ρ_chloro = ρ_w(H) + Δ/2`, with `Δ` the water's span. The thruster and the neuron are weightless like the cytoplasm, so a network or a thruster is never selected for its buoyancy, and a neuron's insertion stays neutral. The sums below run over weighing organelles only.

Because the water is stratified, a body rests where its organelles' mean density meets the water's, `ρ_w(y*) = Σ ρ_type·aᵢ / Σ aᵢ`, held there by a restoring force proportional to its organelle area. Carrying more float against more chloroplast is therefore a continuous, heritable choice of depth that needs no neurons. With the roster's densities a body rests inside the column when chloroplasts make up 40–80% of its weighing area, and in the bright zone only when it carries about as much float as chloroplast. A chloroplast alone sinks its carrier to the floor, where it cannot breed, and a float alone already pays by gathering a wandering body towards the light, so the expected route is float first, then chloroplast. Uniform water would leave only three outcomes, surface, floor or neutral, which is why there is no gravity without stratification.

Each organelle weighs at its own position, so a body whose centre of mass sits below its centre of buoyancy is turned upright: passive gravitaxis, and the vertical half of why organelle placement matters.

`g` is calibrated so that a single float inserted at `r_new` gives a baseline body a scale height equal to the bright band's thickness, and the gradient's span so that bodies of a few organelles find resting depths across the whole column rather than only at the walls. Brownian motion is not retuned: gravity and thrust are calibrated against it.

### Collisions

Overlaps are resolved by **positional separation**: bodies are displaced apart along their normal, split in proportion to `1/area`, with no impulses and no restitution. Corrections accumulate in a buffer and are applied once, so the result does not depend on iteration order.

One pass runs per tick, which makes overlap decay across ticks rather than vanish within one. Two things follow, both measured rather than assumed (ADR-0008). A crowd left alone settles until its bodies are merely touching, asymptotically, so there is no tick on which the overlap reaches zero. And where bodies are piled deep enough to overlap five or six neighbours at once, the summed correction can push one further into a seventh, so the worst overlap in the world climbs for a tick here and there on the way down.

Collisions are not decoration. Light is the only spatially localised resource in v0.1, so volume exclusion is what makes the bright zone finite — and the only way one organism's existence costs another anything.

### Thrusters

_(v0.2+.)_ Each thruster has a position and an orientation, independent of each other. It pushes at its centre along its orientation, contributing to both linear motion and rotation — which is what makes organelle placement matter. A radial thruster pushes the body straight; a tangential one near the rim both turns it and moves it; pure rotation takes a pair of opposed thrusters. Position has no law of its own beyond that lever arm (ADR-0032). Under overdamped physics, a thruster's output maps directly to a speed.

Its maximum force scales with its radius, `F_max = kForce × 2·r`, like every type whose output is a rate. Its input port, `power`, takes a signal that sets the fraction of that force, `clamp(drive + Σ, 0, 1)`, pushing forward only; unwired, it runs at its own `drive` (ADR-0031). `drive` is additive, clamped to `[0, 1]`, and born small but not zero, so a new thruster already does something. A newly inserted thruster points at a uniformly drawn angle. A Split copies `drive` and every incoming synapse to both pieces, each pushing by its own radius, so total force grows by up to ×1.41, and the two pieces can later diverge into finer control. Composition sets the depth a body rests at for free; a thruster holding it anywhere else pays `k_thrust × |F|` every tick it does so.

---

## Environment

### Light

A vertical gradient, strongest at the surface and weakest at depth.

### Water

_(v0.2+.)_ The water's density rises linearly from the surface to the floor, a stratified column rather than a compressed one. It carries nothing and does not move; it only sets where each body's organelles balance (ADR-0030).

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
Strategy gene:
  attempt mitosis when  energy ≥ mitosisEnergyThreshold × cap(energy)

Physical requirement (not genetic, not bypassable), priced on the worst case before any draw:
  energy ≥ mitosisEnergyCost(maxChildArea)
  food   ≥ mitosisMassCost(maxChildArea)
  maxChildArea: the Birth Cost Ceiling
```

The physical requirement is checked **before** the child is drawn, against the most expensive child the mutation law could produce, so the draw that follows never fails for lack of means. v0.1 checked it after the draw and redrew on failure. That is rejection sampling on the child's cost, the **Birth Sieve**: it let only cheaper children through and drove every v0.1 world down to extinction by mechanism rather than by selection (#40, ADR-0027). With the **Worst-Case Birth Gate** the children actually born are an unbiased sample of the mutation law, and what the gate filters is which parents breed.

The ceiling is guaranteed by the mutation law's construction, not found by the parent enumerating every possible mutation. In v0.1 a child's radius is at most `r·(1+δ)`, so `maxChildArea = (1+δ)² × parentArea`, a constant factor. From v0.2 the body follows its organelles' layout and no constant factor is worth pricing, so the ceiling is a closed-form bound read from the parent's own genome (see [Mutations](#mutations), ADR-0028).

The child's body mass is paid out of the parent's internal food store — matter, not just fuel. `childAllocationRatio` then splits only what remains after both costs are paid.

The mass requirement is stricter than it looks, and it is what decides whether a world can reproduce at all. Photosynthesis and respiration are exact inverses on carbon, so an organism's _total_ internal carbon changes only by diffusion and relaxes to the ambient concentration `s`. A parent can therefore hold a same-sized child's mass only where `s ≥ ρ` — a property of the carbon budget, not of any metabolic coefficient (ADR-0022).

Further details:

- the worst-case gate draws nothing; the child's genome is mutated after it passes and _before_ the child's actual area, costs and caps are computed
- `childAllocationRatio` is a single gene shared by all internal resources
- if a child cannot hold its full allocation, it receives up to its own caps and the excess stays with the parent
- the child is born tangent to the parent at a random angle; any residual overlap is resolved by the normal collision system
- each gene mutates with independent probability, so some births are exact clones

### Initial population

At generation 0, N organisms (indicatively 20–50, adjustable) are placed at random positions, each independently mutated from a common, minimal **baseline genome**. From v0.2 the baseline genome still carries no organelles, so the baseline organism is v0.1's minimal organism; founders go through the same mutation law as any birth, so a founder may be born with an organelle, but none is seeded. Not identical clones, not fully random genomes — variance from tick zero for selection to act on. `lineageHue` is the one gene exempt from that common baseline: each founder draws it uniformly over its own range instead of inheriting it, because forty founders each one mutation from a single baseline would be forty near-indistinguishable shades of one colour, and a marker locus that cannot tell them apart is not a marker.

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
Genome = { mitosisEnergyThreshold, childAllocationRatio, lineageHue, cytoplasmThickness, genes: Gene[] }
Gene   = OrganelleGene | SynapseGene
```

The genome is a fixed **header** of organism genes plus a `Gene[]` of structural genes (ADR-0028).

**Organism genes** are the genes an organism has exactly once. They keep v0.1's laws (ADR-0021), carry no id, are aligned by name, and can never be duplicated, deleted or inserted. `cytoplasmThickness` replaces `bodyRadius`: it is the width of cytoplasm around the organelles, so with no organelles it is the whole radius, and it keeps `bodyRadius`'s multiplicative law.

**Structural genes** are the `Gene[]`:

- an `OrganelleGene` has a type (neuron is one), a position in the genome's frame, a radius and the parameters its type declares, orientation among them for a type that uses one;
- a `SynapseGene` has a source `(id, output port)`, a destination `(id, input port)` and a weight.

Each carries an `id`, its **innovation id**: minted once from a monotonic per-world counter when the gene is inserted or split off, and preserved through mutation and inheritance (NEAT-style innovation numbers). Stable ids are what let a gene recognise itself across generations. They are needed immediately, because a synapse references the ids of its endpoints, and they will be needed to align genes during crossover. Aligning by array position breaks as soon as two lineages duplicate genes differently: the competing-conventions problem.

Ids are **identity only**. The counter advances in population order, so an id's value depends on processing order; nothing may therefore sort, iterate, draw or branch on an id's value, and evaluation order is a gene's position in the genome. The body, whose output ports are the innate senses, is the one endpoint that is not a gene; it has a fixed id reserved outside the counter's range (ADR-0031).

There is no activation flag in v0.2. An inactive gene that pays nothing makes reactivation an unbounded jump in a child's cost; one that pays in full is strictly worse than deleting it. The flag's canonical use is crossover, and it returns with crossover if needed.

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

Organism genes mutate as in v0.1, each with its own independent probability. The `Gene[]` does not: a per-gene probability over dozens of synapses would mean a dozen mutations a birth. Instead each birth draws a bounded number of **structural events**, `n ∈ 0…M_max`; each event picks an operator by rate weight, then a target uniformly among the genes that operator can act on. An event with no valid target does nothing and is not redrawn. The rates, `M_max` and the distribution of `n` are the milestone's.

The operators:

- **parameter change**: one parameter of one organelle, by the law its type declares. Types declare their parameters and pick each one's law from a closed menu (symmetric multiplicative, symmetric multiplicative with a floor, additive clamped, wrapping angle), widened only by ADR, so every law's worst case can be read off its declaration. Radius is symmetric multiplicative; position is a Cartesian step of at most `δ_pos` times the organelle's own radius; orientation, where a type declares it, is a wrapping angle.
- **weight change**: a small continuous step on one synapse.
- **insertion**: an organelle of a type drawn uniformly from the roster, born at a small fixed size at a uniform position inside the current body, and at a uniform angle if its type has one; a neuron is such an insertion, born unconnected and so exactly neutral; a synapse from an output port drawn uniformly among all of them to an input port drawn likewise, born with a small weight. New organelles cost very little and can grow over subsequent generations.
- **deletion**: one gene, and in cascade every synapse touching it, as one event.
- **split**: duplication, which divides rather than copies. One organelle becomes two of areas `f·A` and `(1−f)·A`, with `f` drawn from a triangular bell on `[0.2, 0.8]`; incoming synapses are copied to both pieces, outgoing ones divided as `f·w` and `(1−f)·w`. For a neuron that is exactly neutral; for any organelle it conserves area. Synapses are never split on their own.

Excluded: direct transformation of one organelle into another, NEAT's add-node (splitting a synapse with a new neuron, which is not neutral under a synchronous update), and drastic structural mutations.

Every operator is bounded by the **Birth Cost Ceiling**. Area is conserved by a split, but the body is not: two circles need a wider enclosing circle than one of the same area, so splitting an organelle that fills its body nearly doubles the child. No constant factor covers that without sterilising every parent, so the gate prices a bound computed from the parent's own genome:

```text
R_max          = MEC_parent + M_max · maxEventGrowth(genome) + cytoplasmThickness · (1 + δ)
maxEventGrowth = max(split 0.83 · r_max, insertion 2 · r_new, size 2 · δ_size · r_max, position δ_pos · r_max)
maxChildArea   = π · R_max²
```

It holds by construction, from the declared laws and the relaxation contract (see [Body construction](#body-construction)). It is never enforced by rejecting draws that exceed it, because rejecting draws is exactly the Birth Sieve the Worst-Case Birth Gate removes (ADR-0027). A parent carrying one large organelle must hold much more than it will pay, and so breeds later: a known cost of a body that follows its layout (ADR-0028).

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
  7. evaluate mitosis       → worst-case gate, mutate, price, debit the parent, enqueue a pending birth
  8. evaluate death         → freeze remains, enqueue a pending death

PHASE 3 — commit
  9.  apply the delta buffer (proportional scaling if a pool would go negative)
  10. collisions and wall constraints
  11. apply deaths  → return body mass and internal contents to the pools
  12. apply births  → construct each pending child, constrain it to the aquarium, append
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
- a new world on demand, and an auto-restart toggle for starting one whenever the population goes extinct
- a HUD showing tick, seed, population, worst penetration depth (the no-overlap invariant), the three pool levels, total carbon and total oxygen as **relative drift since tick 0** rather than as absolute values — a large number moving in its twelfth digit hides exactly what the conservation invariant is about — cumulative births and deaths, the measured `α` over both the bright band and the whole population, and mean ± σ of each gene

The zero-energy count that M2 shipped belongs to the immortal world, where an aquarium half-parked at zero says the constants are wrong. In a mortal world energy passes through zero to negative and the organism is gone the same tick, so the mortal HUD shows cumulative deaths instead. Cumulative rather than per-tick: `advance` runs up to 240 ticks in one frame, and a per-tick readout loses every death but the last batch's.

Restarting is the **session's** business, never the world's (ADR-0018). A world is one seed from creation to extinction; a session is the sequence of them, each seeded from the last by a PRNG derived from the master seed, so one number reproduces a whole session while the HUD's seed row still identifies the single world on screen.

Rendering encodes state directly: **hue** is `lineageHue`, **brightness** is the energy fraction, **radius** is `bodyRadius`. Dying organisms visibly fade, so starvation waves and boom–bust cycles are readable without reading a single number.

The CSV export this section used to promise is gone. The calibration harness replaced it (ADR-0024): comparing runs offline was the whole justification, and a reproducible command whose output diffs does that better than a file someone remembered to click for.

There is no run persistence: closing the tab loses the run.

### v0.2

The v0.1 view carries over; bodies now have insides (#50).

- **Body.** The cytoplasm is filled in the body's `lineageHue`, less saturated than v0.1's fill, so clade waves stay readable at any zoom. Brightness is still the energy fraction and dims the **whole** organism, organelles included, so dying still reads as fading.
- **Organelles.** Drawn inside the body at their positions, opaque, saturated and with a dark outline, so a green lineage never swallows its chloroplasts. Type colours are the screen's only: **chloroplast** green, **thruster** red, **float** pale white-blue and translucent, like a bubble, **neuron** light grey. Only the thruster has an orientation, so only the thruster is drawn as an oriented shape (a wedge along its thrust), with a mark of how hard it is pushing that tick, proportional to `|F|`; every other type is a disc whose angle is never drawn. Body rotation is visible through the organelles turning with it.
- **Synapses** never appear in the main view: port-to-port wiring is shown only by the inspector.
- **HUD.** The organism genes keep their mean ± σ. Structural genes cannot be averaged by name, so for each roster type the HUD shows the fraction of the population carrying at least one and the mean count per carrier.
- **Selecting and inspecting** an organism ships with the first milestone that gives bodies organelles, and grows with each milestone after it: genome and organelles first, port-to-port wiring with the nervous system. Its layout is each milestone's own.

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
- Canvas2D rendering; start / pause / single step / zoom / pan; HUD with gene statistics
- death by starvation

### Deferred to v0.2+

- organelles (eyes, thrusters, real neurons and synapses, chloroplasts, …)
- spatial fluid simulation
- sight and colour perception
- gravity and buoyancy, weighing organelles against stratified water (ADR-0030)
- sexual reproduction and crossover
- selecting and inspecting an organism
- scavenging as real behaviour
- persistence

---

## Definition of done for v0.1

Two automated invariants and one scientific criterion.

1. **Conservation.** Total carbon and total oxygen hold constant to floating-point tolerance across 100k ticks. This is the single best bug detector the project has: nearly every metabolic bug surfaces first as a leak in these numbers. It also becomes the test that guards the v0.2 fluid solver, whose semi-Lagrangian advection is stable but not mass-conserving.

2. **Determinism.** The same seed yields an identical state hash at tick N, across runs on the same build and engine.

3. **Selection, not drift.** Population means of each gene converge to the same neighbourhood from different seeds and different baseline genomes. The decisive check is `r_opt = 2·c₀/α`, computed from the constants and from the `α` measured over the **bright band** of a selection-free fixed population (ADR-0015, ADR-0023): drift does not converge on a number predicted in advance, only selection does. Its operational form — fifteen runs, the band around the prediction, and the requirement that the runs end closer together than the baseline genomes they started from — is in ADR-0025. When simulation meets the closed-form prediction, v0.1 is correct.

   **Measured, and not met.** All fifteen done-criteria runs went extinct before ever reaching a living population inside the measurement window — there is no `bodyRadius` mean to check against `r_opt` in any of them. v0.1 ships without this criterion satisfied; conservation and determinism both hold, this one does not. Further pursuit is deferred to v0.2 rather than chased inside v0.1's own constants (ADR-0026).

   The cause was found afterwards, and it was a law, not a constant: the Birth Sieve in mitosis (#40). With the Worst-Case Birth Gate every seed persists and `bodyRadius` rises towards `r_opt` for the first time. v0.2's first milestone re-runs these fifteen runs on the gated world as a reported measurement (ADR-0027). The verdict above stays v0.1's.

### Calibration method

Non-dimensionalise rather than guess. Fix `β = 1` (defining the energy unit) and `ρ = 1` (defining the carbon unit), and set the length unit to the baseline radius — three constants eliminated by construction. `kCap` is **not** one of them: it carries `ρ`'s own dimension, so only the ratio `kCap/ρ` is physical and it is a free parameter wearing a unit's clothes (ADR-0022). Then choose the numbers you have intuitions about and derive the rest: the `r_opt` you want to see gives `c₀`, and the population ceiling you want gives the **carbon budget**, still phrased as "enough carbon for K baseline organisms, the remainder dissolved".

`K` stays the input and the ambient concentration falls out of it in closed form, with no iteration, because requiring tick 0 to be at diffusive equilibrium ties the internal stores to the ambient value. With `A = Σ bodyArea` over the generation-0 population and `s` the total ambient carbon concentration:

```text
K · π = A + (A + aquariumArea) · s      →      s = (K·π − A) / (A + aquariumArea)
```

`s` then splits between CO₂ and food. A world that starts CO₂-rich and food-poor opens on carbon fixation in the bright zone, which is the story the closed cycle is there to tell.

Running that relation backwards is how `K` itself is chosen. Reproduction halts once `s` falls to `ρ` (ADR-0022), so the population ceiling is closed-form too, and the carbon budget follows from the ceiling rather than the other way round:

```text
N_max = K/(2·r²) − aquariumArea/(2π·r²)      →      K = 2·r²·N_max + aquariumArea/π
```

Oxygen is an independent knob, since the CO₂ term already carries oxygen of its own: choose the ambient O₂ concentration directly and let the oxygen budget follow.

---

## Definition of done for v0.2

Four standing gates, one feasibility gate and one scientific criterion (ADR-0033).

1. **Standing gates.** Conservation, determinism, **persistence** (the reference world, unprimed, five seeds × 100k ticks, every seed alive; and over committed births a mean log child/parent cost of zero, ADR-0027), and M1's overlap ceiling, which gravity's wall piles put under load (ADR-0030). Every v0.2 milestone holds all four. One is retired or relaxed only by ADR, never silently. A world that persists only after restarts does not count.

2. **Feasibility.** The population's mean generation at the end of a reference run is at least 50. Below that, nothing selective can be told apart from drift, so this gate is checked before the done-criteria runs. Runs get longer first, since that moves no constant. Then the mass side thickens the world (ambient CO₂ share, `K` below the s₀ ≈ 2.5ρ wall), and every such move re-solves `c₀`. `BROWNIAN_FORCE` stays v0.1's.

3. **Selection, not drift.** v0.2 has no closed form for an organelle's frequency, so its control is a **knockout world**: the same world and seed with one roster type's function switched off and its cost kept. A knocked-out float is weightless and gives no lift. A knocked-out chloroplast has `kChloro = 0` and still weighs. Both still pay their overhead and take their area, so mutation, drift and cost are identical in both worlds and only what selection can see differs.

   For the float and for the chloroplast: five seeds, each run in the real world and in that type's knockout, on the final 0.2.0 world. The statistic is the fraction of the population carrying at least one of the type, time-averaged over the last 10% of the run. The criterion passes when the real world is above its knockout in **every** seed pair. An extinct run is a failed run, not an excluded one.

**Reported, not gated**, and fixed before the runs: the order in which floats and chloroplasts rise (floats first, ADR-0032); carriers' resting depth by composition, and the float : chloroplast area ratio against depth; chloroplast radius against `r* = c/k`, and chloroplast count × radius against depth (ADR-0029); neuron and thruster carrier fractions and the count of sense-to-actuator synapses. These live in the calibration harness and its CSV. The HUD's per-type carrier fraction already shows the order live.

`r_opt` is reported once, on M6's gated world, and then retired: once bodies have organelles, income is no longer `α·r`.

---

## Milestones

Each milestone is independently runnable and adds exactly one invariant. The ordering exists so that a broken invariant has one possible cause.

| #   | Branch                        | Ships                                                                                                                                   | Invariant added                                                                           |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| M0  | `feature/simulation-skeleton` | toolchain; fixed-step accumulator with catch-up cap; seeded PRNG and per-organism streams; canvas, pan/zoom, play/pause/step, HUD shell | same seed ⇒ same state hash                                                               |
| M1  | `feature/bodies-and-motion`   | organism circles, Stokes drag and brownian motion, uniform grid, positional separation, walls, `lineageHue` rendering                   | overlap decays to touching, and stays under a ceiling on a live run; correct grid queries |
| M2  | `feature/metabolism`          | `Environment` seam, pools, light LUT, signed diffusion, photosynthesis, respiration, maintenance, caps — **fixed, immortal population** | carbon and oxygen conserved over 100k ticks                                               |
| M3  | `feature/death`               | death by starvation; remains returned to pools; mortality as a world mode; session restart                                              | conservation survives death                                                               |
| M4  | `feature/reproduction`        | genome, mutation, mitosis costs, allocation, tangent birth, baseline population                                                         | conservation survives birth                                                               |
| M5  | `feature/calibration`         | calibration harness; constants solved for target `r_opt`; HUD gene statistics; done-criteria runs                                       | population converges to predicted `r_opt`                                                 |

M2 runs with a fixed, immortal population on purpose: metabolism is where conservation bugs live, and isolating a leak is far easier with `N` pinned. M3 and M4 then each add exactly one new way to move mass.

Immortality in M2 is a **clamp, not an exemption**: maintenance is charged in full and energy simply floors at zero, where an organism sits, still diffusing, able to recover if food drifts its way. Dropping the cost instead would mean M2 never exercises the path M3 and M5 depend on. An organism parked at zero is precisely the one M3 will bury, which is why the count of them is worth a HUD row a milestone early.

From M3 that clamp becomes a **world mode** rather than a milestone's temporary state (ADR-0017). The immortal world outlives M2 because M5 needs it: `α` is measured where nothing can select, and calibration is exactly the milestone that moves the constants `α` would have to be re-measured against. It also keeps M2's 100k-tick conservation gate running in a world with no death code in it at all.

M0 front-loads pan, zoom, pause and step because they are debugging tooling, used in every milestone that follows.

---

Unshaped ideas for later versions live in [`docs/ideas.md`](./ideas.md) rather than here.

---

## Ultimate goal

To observe complex ecosystems emerge spontaneously from extremely simple organisms, without ever programming a behaviour, a species or a strategy directly.
