# Organelles cost per piece, work by their radius, and v0.2 observes specialisation

An organelle's effectiveness is the passive capability's own geometry with a better coefficient, so it scales with the organelle's **radius**. Every area in a body is paid once, at the rate of whatever occupies it. Each organelle pays a flat **Organelle Overhead**, which is the only thing that bounds how many pieces a body splits into. Thrust is priced per unit of force, so hovering costs. ADR-0014's specialisation question is **observed, not answered**, in v0.2, because v0.2 has no second route to food to specialise between. This supersedes ADR-0014. Settled in #46.

## Effectiveness is the passive law applied to the organelle

"Organelles are evolutionary optimisations of capabilities every organism already has." A rate-producing organelle therefore runs the passive law on its own disc, with its own coefficient:

```text
chloroplast:  kChloro × light(organelle's world position) × 2·r_c × C_cytoplasm(CO₂)
```

Passive photosynthesis already scales with the body's diameter. A chloroplast does the same on its own diameter, so its effectiveness grows as `a^½` in area. Nobody declared that as a curve: it is the passive law's geometry, and it holds for every type whose output is a rate. Types differ in their coefficient, not their exponent. The radius is the gene, so no `sqrt` enters the loop.

Light is read at each organelle's own position, which is v0.1's rule ("sample at the centre of the disc that photosynthesises") applied to each disc. Position and rotation therefore matter from the first milestone with chloroplasts, with no positional law of their own. Once fluid fields exist, anything an organelle reads from the world will be read at its cell for the same reason.

A chloroplast only fixes carbon. It has no membrane of its own facing the water, since giving it one would make it half a gill. Its ceiling is the CO₂ the body's perimeter lets in. With v0.1's constants a body fixes at ~66% of that ceiling at the surface and ~16% ten radii down, whatever its size, since both terms grow with `r`. So a chloroplast is worth up to +50% at the surface and up to ×6 in the dark. That ceiling is a second sublinearity, emergent and shared by all of a body's chloroplasts. The gill, the organelle that lifts it, stays in v0.4.

## Every area is paid once

```text
maintenance = c₀
            + β · cytoplasmArea                       cytoplasmArea = bodyArea − Σ aᵢ
            + Σ over organelles (c_type + β_type · aᵢ)
            + Σ over synapses   c_synapse
            + thrust cost
```

The body is its organelles' enclosing circle plus cytoplasm, so organelle area is already inside `bodyArea`. Adding a per-type area term on top would pay for the same area twice. Decomposing the body instead lets `β_type` say what an organelle's tissue costs relative to cytoplasm, above or below it. With no organelles this is v0.1's `c₀ + β·area` exactly.

**Caps and internal concentrations are taken over the cytoplasm area**, not the body. Organelles take space that holds no stores, which makes their area a storage cost as well as an energy one, as `vision.md` has always said. Diffusion and reactions use the same denominator, so the two stay consistent. `cytoplasmThickness > 0` keeps that area strictly positive. Stores stay **separate per resource**. A single shared volume is ruled out of v0.2: no storage organelle exists to make it matter.

There is **no construction cost at birth**. Birth mass is `ρ · bodyArea` as before, so ADR-0028's Birth Cost Ceiling, a bound on area, is untouched. Everything else an organelle costs, it pays per tick.

## The overhead is per piece, and it is the whole size/number trade-off

Effectiveness scales with `Σ rᵢ`. Split a fixed area `A` into `n` pieces and the output grows as `√n`, while the area cost stays the same. Only two things push back:

- **the overhead**, paid `n` times;
- **packing loss**: two circles need a wider enclosing circle than one of the same area, so the body, its cytoplasm and a child's mass all grow.

Packing loss tends to a constant density as pieces multiply, so it does not bound `n`. The overhead does, and it gives each type a closed-form optimal radius, the same shape as `r_opt = 2·c₀/α`:

```text
net output per unit area  (2·k·r − c) / (π·r²)   is maximal at   r* = c_type / k_type
```

A per-capability overhead would make duplication free and the optimum one infinitely divided organelle, so the overhead has to be per piece. For the chloroplast, `k` carries `light × C_cytoplasm(CO₂)`, which falls as fixation nears the CO₂ ceiling. So `r*` grows near the surface (few, large chloroplasts) and shrinks in the dark (many, small ones). Size against number therefore varies with depth, and nothing wrote that in by hand.

**Insertion must be near-painless.** A fixed overhead puts an organelle born at `r_new` in the red until it grows. The milestone chooses `r_new` first and derives `c_type` from it, so that an inserted organelle is near break-even where its type works (`r_new ≈ r*/2`). A neuron's overhead is small, since new structure must be cheap and near-neutral (#45). A synapse pays a small flat overhead and no area, so networks do not grow by drift for free.

## Thrust is priced per unit of force

```text
thrust cost = k_thrust × |F|    per tick
```

The physical power under Stokes drag is `F·v`. It makes holding depth against gravity at `v ≈ 0` free, so hovering would cost nothing and buoyancy by composition (#44) would have no active rival. Pricing force instead, the way Framsticks prices muscle static work, charges hovering and makes distance cost `ζ` per unit regardless of speed. Neurons pay no activity cost: they evaluate every tick anyway, so a per-evaluation cost would only be an overhead under another name.

## Specialisation is observed, not paid for

ADR-0014 asked what makes a producer out-compete a generalist. The prior-art research (#43) corrects its axis. Every organism respires, so respiration combines multiplicatively with any food route, and the literature's trade-off is between substitutable routes: **chloroplast against food intake**. v0.2 has no food intake beyond passive diffusion (eating is v0.3), and the dark does not breed (ADR-0023). So there is no second route to specialise into, and a per-capability overhead would only be a surcharge on the first chloroplast that deepens the insertion valley.

v0.2 takes **do nothing and observe**. The ecological option comes for free, since the closed carbon ledger already makes the pools depletable (ADR-0001), and no law is written for it. The question reopens in v0.3, on the corrected axis, when eating gives it a second route.

v0.2 reports two measurements, neither a gate:

- **chloroplast radius against `r* = c/k`**, with `k` measured the way `α` is: a closed-form prediction for the trade-off v0.2 actually has;
- **the joint distribution of chloroplast count and radius against depth**, to see whether lineages settle on few large or many small, and where.

Whether either becomes a gate is v0.2's definition of done to decide (#51).

## Considered options

- **A free exponent `τ` per type.** A curve declared by hand, where the passive geometry already gives one.
- **Effectiveness linear in area, sublinearity only from shared supply.** Two small organelles then equal one large, and the overhead always favours a single giant one. ADR-0014 rejected that collapse of the design space.
- **An area term added on top of the body's.** Pays for the same area twice, and leaves `β_type` meaning nothing a reader can picture.
- **An overhead that grows with `r` up to a knee, or a membrane cost ∝ perimeter.** Both make insertion painless by making duplication free below the knee, which breaks the size/number trade-off.
- **A chloroplast with its own exchange surface.** It is a gill fused into a chloroplast: it lifts the respiration ceiling too, and with it the supply-limited regime that makes income linear in `r`.
- **A gill in v0.2.** Useful now even with well-mixed pools, and synergistic with the chloroplast. Kept in v0.4 so the linear income is not broken while everything else is being calibrated.
- **Power `F·v` for thrust.** Makes hovering free.

## Consequences

- A body is no longer charged `β·bodyArea` alone. Maintenance, caps and concentrations all read the cytoplasm area. A body with no organelles is v0.1's unchanged.
- Every organelle type declares `k_type`, `c_type` and `β_type` next to its parameters. #49 fills them in per type, including whether orientation matters and whether a gill joins after all.
- #47 inherits a priced alternative to buoyancy: holding depth by thrust costs `k_thrust·|F|` every tick.
- #48 inherits a small neuron overhead and a synapse overhead, and no activity cost.
- #51 inherits two reported observables and ADR-0014's bimodality question deferred to v0.3.
- Glossary: **Organelle Overhead**, **Cytoplasm Area**, **Thrust Cost**; **Maintenance**, **Body Cost**, **Cap** and **Concentration** amended.
