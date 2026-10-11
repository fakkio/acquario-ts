# Gravity weighs organelles against stratified water

> **Amended by [ADR-0032](./0032-the-v0-2-roster-is-four-types-and-weight-comes-from-function.md).** A type other than the float and the chloroplast is **weightless**, like the cytoplasm, not "inside the water's range": a type weighs only when weight is what it does or what it costs. Resting depth and stiffness are sums over weighing organelles only. The roster fixes `ρ_chloro = ρ_w(H) + Δ/2` and `ρ_float = ρ_w(0) − Δ`.

> **Amended in M8's grill.** The water's span is not a second constant. With ADR-0032's densities written in units of `Δ`, only density differences enter the law: `ρ_w(0)` never appears, `g` and `Δ` appear only as the product `g·Δ`, and the Resting Depth, `y*/H = Σ c_type·aᵢ / Σ aᵢ` with `c_float = −1` and `c_chloro = 3/2`, depends on neither. So `Δ = 1` fixes the organelle-density unit and `ρ_w(0) = 0` its origin, as `ρ = 1` fixes carbon's, and `g` is the one constant calibrated, by the rule below in closed form. The rule for the span is already met by ADR-0032's densities.

v0.2 adds gravity as one more force in the overdamped sum. The water is **stratified**, denser towards the floor, and only **organelles** weigh against it: the cytoplasm is neutral at every depth, so a body with no organelles moves exactly as in v0.1. An organism's depth is set by what its organelles are made of, not by a density gene. There is no gravity without stratification: with uniform water, every body whose weight is not zero ends up against the surface or the floor. Settled in #47. This supersedes ADR-0004 for v0.2 on; v0.1 stays as ADR-0004 describes it.

## The law

```text
Buoyant Weight    W = g · Σ over organelles (ρ_type − ρ_w(y_i)) · a_i        signed, positive = down
velocity         += W / (6π · r)
torque           += Σ over organelles (x_i − x_c) × (ρ_type − ρ_w(y_i)) · a_i · g · ŷ
ρ_w(y)            = ρ_w(0) + (ρ_w(H) − ρ_w(0)) · y / H                       linear, surface to floor
```

- **Weight is on area**, as every world quantity is. In 2D the settling speed goes as `r`, not `r²`. The scale height `L = D/v_s` goes as `1/r²`, since the code's Brownian force already scales with `√r` (`D ∝ 1/r`).
- **Each organelle weighs at its own position**, so a body whose centre of mass sits off its centre of buoyancy feels a torque. That gives passive gravitaxis once bodies rotate: a float above and a heavy organelle below keep a body upright, and a thruster pointed up stays pointed up, with no neurons.
- **The equilibrium is interior and stable.** A body settles where the mean density of its organelles meets the water, `ρ_w(y*) = Σ ρ_type·a_i / Σ a_i`. The restoring force is a spring of stiffness `g · Σ a_i · dρ_w/dy`, so a body with more organelle area is held more tightly and Brownian motion spreads a small one more widely. A linear profile gives the same stiffness at every depth; a step-like pycnocline would pull every equilibrium to one height.
- **Depth is genetic through composition.** How much float area a body carries against how much chloroplast area is a continuous trait, reachable by the existing size and insertion operators, with no neurons.

## Only organelles weigh

**Organelle Density** `ρ_type` is an absolute constant each type declares, next to `k_type`, `c_type` and `β_type` (ADR-0029). It is not a gene parameter: a per-organelle density would be a density gene one level down, and a float's lift already grows with its area, which is a gene. **The cytoplasm is water inside the membrane** and is neutral at every depth, stores included. Energy is not matter, and food, O₂ and CO₂ add no weight in v0.2.

**Weight is separate from carbon.** `ρ` stays carbon per area, and every area still costs `ρ` at birth (ADR-0022, ADR-0029). A light organelle does not hold less carbon. The Birth Cost Ceiling (ADR-0028), a bound on area, is untouched, and the weight is bounded by construction because densities are constants and the water profile is fixed.

Types need densities on both sides of the water. A type denser than the floor's water sinks its carrier to the floor, and so the roster must hold a type lighter than the surface's water whenever it holds a heavy one. The chloroplast is the expected heavy one, because more photosynthesis should cost lift. v0.2 fixes the constraints, and the roster fixes the values (#49):

- `ρ_chloro > ρ_w(H)`, so a body of chloroplasts alone sinks;
- a float type with `ρ_float < ρ_w(0)` and `ρ_w(0) − ρ_float > ρ_chloro − ρ_w(H)`, so that a float lifts more than its own area of chloroplast weighs anywhere in the column;
- the float ships in the same milestone as the chloroplast or earlier;
- every other type starts neutral, `ρ_type` inside the water's range, unless the roster finds a reason.

## Calibration

- **`g`** is chosen so that a baseline body carrying one float inserted at `r_new` has a scale height equal to the Bright Band's thickness. A new float shifts its carrier's distribution upward and does not pin it to the surface. This is ADR-0029's rule that an inserted organelle starts near break-even, applied to lift.
- **The gradient's span** `ρ_w(H) − ρ_w(0)` is chosen so that compositions of a few organelles reach equilibria across the whole column, not only at the walls. Its value is the milestone's.
- **`BROWNIAN_FORCE` does not move.** `g` and `k_thrust` are calibrated against it, and only the ratio matters to them. Lowering it would change the minimal organism's ecology (encounters, founder effect, tenancy) in the milestone meant to leave it alone. If that change is wanted, it is an abundance lever, for the definition of done (#51).

## Considered options

- **A density gene.** No plankton model has one: density is physiology. A composition law makes organelle placement and choice matter for depth, which a gene would bypass.
- **Uniform water.** With static composition only three outcomes exist: surface wall, floor, or neutral. The surface becomes the one attractor, and an interior depth has to wait for neurons and thrusters. Rejected on those grounds.
- **Stratified water with a cytoplasm of fixed density.** More honest physically, but the cytoplasm is then neutral at one depth only. Every minimal organism would be drawn there from the first tick, changing v0.1's world, its `α` and its persistence in the milestone that adds gravity.
- **Food as ballast** (Kromkamp–Walsby, #44, [findings](../research/low-reynolds-buoyancy.md)). The cytoplasm is lighter than water and food is dense, so a fed body sinks, a starved one rises, and each organism tracks the depth where its store is steady. It emerges from existing chemistry, but it changes the minimal organism from generation 0. A parent must hold more food than the neutral level to breed, so it sinks exactly when it is ready. Kept in `docs/ideas.md`.
- **A minimal organism that sinks by default.** ADR-0004's collapse: generation 0 has no organelle to fight it.
- **Weight on a volume proxy (`r³`).** Recovers the real `v_s ∝ r²` at the price of the one volumetric quantity in a flat world.
- **Gravity applied at the body's centre.** No torque, so orientation would depend on thrusters alone and an organelle's vertical position would mean nothing.
- **Photoinhibition** as a counter-pressure against the surface. It changes v0.1's light law, and stratification already gives interior equilibria. Kept in `docs/ideas.md`.

## Consequences

- ADR-0004's "gravity only alongside thrusters" does not carry over. Minimal organisms never sink, so no population can collapse onto the floor, and a heavy organelle only sinks the lineage that carries it: selection, not collapse. **Gravity enters with the first organelle type whose density differs from the water's**, and it does not need to wait for thrusters (#52).
- Holding a depth other than one's equilibrium costs thrust, `k_thrust·|F|` every tick (ADR-0029). Composition sets where a body rests for free, and thrust moves it away from there at a price.
- Bodies whose organelles are denser or lighter than the whole column still pile against the floor or the surface, and piles five or six deep are where ADR-0008 measured overlap climbing. **M1's overlap ceiling becomes a standing gate**, like conservation: the milestone that adds gravity re-measures it under load and may change positional separation to hold it.
- A body with no organelles is v0.1's minimal organism in motion as well as in metabolism, so gravity cannot break persistence (ADR-0027) on its own.
- Glossary: **Buoyant Weight**, **Organelle Density**, **Water Density**; **Brownian Motion** amended.
