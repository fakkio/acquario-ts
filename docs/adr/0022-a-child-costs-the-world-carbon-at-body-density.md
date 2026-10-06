# A child is affordable only where dissolved carbon reaches body density

> **Amended by [ADR-0035](./0035-only-the-energy-store-has-a-hard-cap.md).** No reaction reads a diffusible's cap any more, so food's coefficient above `ρ` no longer buys the mass gate anything: the gate is a floor on the store, never a ceiling. The relaxation of internal carbon to `s` stands unchanged, and it is now also what bounds a diffusible store.

Mitosis's mass cost is a **concentration** threshold in disguise, and no metabolic constant can move it. A parent can afford a same-sized child only in a world whose ambient carbon concentration `s` is at least the body density `ρ`. `CARBON_BUDGET_BASELINE_ORGANISMS` therefore rises from M2's provisional 200 to a value chosen against the population ceiling it implies, and `K_CAP` stops being described as a unit: only `kCap/ρ` is physical, and food gets a cap of its own above `ρ`.

## Why

ADR-0019 recorded a "calibration gap" — that with `ρ = K_CAP = 1` a parent needs close to its entire food store to afford one birth, and measured runs never see more than about 6% of that store. Issue #31 then found the gap was not a tuning miss: 40 founders, 39 dead by tick 11k, zero births ever, and food plateauing at 12% of cap by tick 5000.

It is not a tuning miss because it is not reachable by tuning. The two reactions are exact inverses on carbon:

```text
photosynthesis:  CO₂ → food        respiration:  food → CO₂
```

Neither changes an organism's **total** internal carbon. Only diffusion does, and summing ADR-0003's signed law over the two carbon-bearing diffusibles gives a single relaxation:

```text
d(C_food + C_CO₂)/dt = kDiffusion × perimeter × (s − C_food − C_CO₂)
```

Internal total carbon concentration relaxes to `s`, the ambient total, with time constant `r / (2·kDiffusion)` and **independently of `kPhoto`, `kResp` and `RESPIRATION_ENERGY_YIELD`**. So `C_food ≤ s` always, approached only as internal CO₂ goes to zero — which is also where photosynthesis stops, since it is mass action on internal CO₂.

Mitosis requires `food ≥ ρ × childArea`, which for a child near its parent's size is `C_food ≥ ρ`. Combining:

```text
reproduction at the parent's own size is possible  ⟺  s ≥ ρ
```

`K_PHOTO` and `K_RESP` do not appear. Raising photosynthesis an order of magnitude buys nothing, because it only converts carbon the organism already holds.

## What `s ≥ ρ` costs, and what it buys

`s` follows in closed form from the carbon budget, exactly as `vision.md`'s calibration method derives it:

```text
s/ρ = (K·π − A) / (aquariumArea + A)
```

At M2's `K = 200` this is `0.199` — a factor of five short, which is the measured 6-12% of a food cap, seen from the other side. The break-even is `K ≈ 847`, and `847` is a knife-edge: `C_food` reaches `ρ` only in the limit where photosynthesis has already stopped.

The consequence worth naming, because it is not the one this ADR was drafted expecting: **the carbon ledger goes on setting the population ceiling**, and now does so in closed form. Growth locks carbon into bodies, `s` falls, and reproduction halts of its own accord when `s` crosses `ρ`:

```text
N_max = K/(2r²) − aquariumArea/(2π r²)        at r_opt = 1.5:  N_max = K/4.5 − 170
```

`vision.md`'s claim that "the population has a hard ceiling set by the world rather than by any tuning constant" therefore stands unamended; it gains a formula. Volume exclusion does **not** take over: at `K = 1500` the ceiling is about 163 bodies where the aquarium would physically pack about 340.

This makes `K` the same kind of constant `c₀` already is. Choose the population ceiling the world should have, and `K` follows:

```text
K = 2r²·N_max + aquariumArea/π
```

An ecological number with an intuition attached, which is what ADR-0001 asked the carbon budget to be in the first place.

## `K_CAP` is a ratio, not a unit

`ρ` has dimension carbon-per-area. `kCap` has dimension carbon-per-area. They are the same dimension, so fixing both to 1 is **one** unit choice plus **one** physical assertion: that an organism's maximum internal store of a diffusible equals exactly the carbon in its own body. `vision.md`'s calibration method lists "Fix `kCap = 1` (defining the concentration unit) … and `ρ = 1`" as two constants eliminated by construction. It is one, and the other was a free parameter wearing a unit's clothes.

It becomes binding the moment `s > ρ`. With `kCap(food) = ρ` a parent must sit at exactly 100% of its food cap to afford a birth, which collides with ADR-0003's throttle-never-spill rule at precisely the tick it matters. Food therefore gets its own coefficient, above `ρ`; CO₂ and O₂ keep theirs at 1, because raising them would move the internal carbon budget for no reader.

## Considered options

**Lower `ρ`.** The obvious lever, and it does nothing: `s` is proportional to `ρ` through the budget, so `s/ρ` is invariant and the ratio that matters never moves. `ρ = 1` really is a pure unit choice, which is worth recording because it looks like the first thing to try.

**Raise `K_PHOTO` by an order of magnitude.** What this ADR was originally drafted to do, before the internal-carbon relaxation above was worked out. Photosynthesis cannot lift total internal carbon at all; it can only trade internal CO₂ for internal food. It stays a genuine lever on _how close_ `C_food` gets to `s` (ADR-0025), but not on the ceiling.

**Shrink the aquarium.** `s` rises as `aquariumArea` falls, and reaching `s ≥ ρ` at `K = 200` needs an area near 500 — a 22×22 tank with no room for a light gradient to run down. It also contradicts the whole point of M1's calibration.

**Change the law: a child born at a fraction of the parent's radius.** At `s/ρ = 0.199` the largest affordable child is about `0.45` of the parent, and with no growth during life the population would collapse to the smallest viable body and `r_opt` would stop meaning anything. Not a knob; a different simulation. A narrower law change stays available and is recorded in ADR-0025 as a pre-authorised fallback.

## Consequences

- `CARBON_BUDGET_BASELINE_ORGANISMS` is derived from a chosen population ceiling, not picked. It joins `EXISTENCE_COST` as a constant the calibration method **solves for** rather than sweeps.
- `K_CAP` becomes per-resource: food above `ρ`, CO₂ and O₂ at 1. `RHO` alone carries the carbon unit.
- `vision.md`'s calibration-method paragraph is corrected: three constants are eliminated by construction, not four, and `kCap/ρ` is named as the free ratio it is.
- ADR-0019's "`mitosisMassCost` is not a choice" stands for the **amount** — death must return exactly what birth took — but not for the **store** it is drawn from. ADR-0025 takes that up.
- The charging time constant `r / (2·kDiffusion)` is now load-bearing: it is how long a parent takes to reach the gate, and therefore sets the reproductive period. `K_DIFFUSION` stays out of M5's sweep for that reason — moving it rescales every other measurement in the run.
- A world below `s = ρ` is not broken, it is **sterile by physics**. That is worth keeping reachable: the fixed-population world ADR-0015 measures `α` in has no reason to be fertile anyway.
