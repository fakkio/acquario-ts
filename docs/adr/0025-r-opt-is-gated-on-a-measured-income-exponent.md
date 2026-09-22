# `r_opt` is gated on a measured income exponent and a maximum reproductive radius

`r_opt = 2·c₀/α` rests on energy income being linear in `r`. The mitosis mass gate works against that linearity, and the conflict produces a **maximum reproductive radius** that appears nowhere in the closed form. M5 therefore measures both — the fitted exponent `n` in `income ∝ r^n`, and `r_max` — and gates on them before treating convergence on `r_opt` as meaning anything. If the gates fail, a pre-authorised law change fires: mitosis's mass cost is paid in internal **carbon**, food first and then CO₂, which removes the conflict outright.

## The conflict

Respiration is supply-limited by design (ADR-0015), and that is the whole basis for income being linear in `r`. Both substrates arrive across the perimeter, so the reaction settles at whatever supply delivers, and the internal concentrations **self-adjust downward as the body grows**:

```text
income = Y · kResp · C_food · C_O₂ · bodyArea      ∝ r   requires   C_food · C_O₂ ∝ 1/r
```

The mass gate is a concentration threshold on one of those very quantities: `C_food ≥ ρ` (ADR-0022). So the same mechanism that keeps income linear pushes large bodies below the breeding threshold, and there is a radius above which an organism earns perfectly well and can never afford a child. The available margin is bounded, because `C_food ≤ s` always:

```text
r_max / r_opt   bounded above by roughly s/ρ, and at best by (s/ρ)²
```

Which branch of that range applies depends on how the `1/r` is shared between food and oxygen, and that is not honestly derivable on paper. It is measurable, so it gets measured.

## The gates

All three read off the harness (ADR-0024), on the calibrated world, before the done-criteria runs:

```text
n       ∈ [0.9, 1.15]      income is linear enough for the closed form to be the closed form
r_max   ≥ 2 · r_opt        the population settles against the energy optimum, not against the mass gate
tenancy ≥ 5                a lineage gets several births per stay in the photic band
```

If `r_max` sits near `r_opt`, a population converging on `r_opt` proves nothing: it would be piling up against the mass gate and the agreement would be a coincidence of two unrelated numbers. That is a worse failure than not converging, because it looks like success.

The third gate is geography wearing genetics' clothes, and it took until the fragment session to name. `bodyRadius` sets the brownian step, which goes as `1/r`, so large bodies stay in the photic band and small ones wander out of it and die childless. That is a selective pressure **toward** large radius which `r_opt = 2·c₀/α` knows nothing about, exactly as `r_max` is one against it. **Tenancy** is the ratio of the time an organism spends inside the photic band to its reproductive period: at five or more, a lineage gets enough births per stay that where it sits is not what decides its size. Below that, part of any convergence is the aquarium's shape and has to be reported as such rather than claimed as selection.

ADR-0018 already saw this coming from a different direction — "an early result may be reporting geography rather than genetics" — about the founder archive, three milestones before anything could test it.

## The pre-authorised fallback

Decided now rather than invented under pressure. If the gates fail, **mitosis's mass cost is drawn from internal carbon rather than from food alone**: food first, then CO₂.

This works because the quantity ADR-0022 identified — total internal carbon — relaxes to `s` independently of `r`, of `kResp` and of `kPhoto`. A gate on the sum is therefore r-independent, `r_max` disappears, and the requirement collapses back to `s ≥ ρ` alone.

It is stoichiometrically sound rather than a fudge. Food is pure carbon and CO₂ carries oxygen, so paying mass out of CO₂ must release the O₂ — which is photosynthesis's own balance, `CO₂ → food + O₂`, run without light. It reuses that path and its throttle rules unchanged, so a parent whose O₂ store is full simply cannot convert that tick and the birth waits, exactly as ADR-0003's throttle-never-spill rule already requires. Both invariants stay exact: carbon is carbon, and the oxygen the CO₂ carried is accounted for rather than dropped.

**It amends ADR-0019.** That ADR says `mitosisMassCost` "is not a choice", and that is true of the **amount** — death must return precisely what birth took, or the ledger breaks at the first birth. It is not true of the **store** the amount comes out of, and the ADR conflates the two.

## Why `K_RESP` must not fall

Recorded because it is the obvious-looking move and it is backwards. Lowering `K_RESP` does let food pile up, which is superficially what the mass gate wants. It also pushes respiration out of the supply-limited regime, and supply-limitation is the _only_ reason income is linear in `r`. Below the crossover the income law turns quadratic, `reproductiveRate(r) ∝ (k − β)·r² − c₀` has no interior optimum, and `r_opt` stops existing at all. `K_RESP` stays at 1.

`K_PHOTO` is the lever instead, and it is genuinely under-set: `0.03` was hand-computed in M2 against a world with no births in it. It has two opposed jobs — lifting `C_food` toward `s` so the gate is reachable, without flattening its r-dependence so far that income bends toward `r²` — which is why it is swept against the two gates rather than derived against a target.

## `r_opt`, and what it is not sensitive to

`r_opt = 1.5` baseline radii: above the founding spread of `[1/1.4, 1.4]` so the climb is several σ and cannot be mistaken for drift, and small enough to leave every M1 length calibration intact.

`MITOSIS_ENERGY_COST` does **not** enter it. It is a constant multiplier on the child's cost, and it cancels out of `d/dr[(α·r − c₀ − β·r²)/(M·π·r²)]`. So it sets the _pace_ of reproduction and nothing about where `bodyRadius` lands, and it can be tuned purely for how often a birth happens on screen.

## ADR-0011's criterion, in operational form

"Population means converge to the same neighbourhood from different seeds and different baseline genomes" needs a number. It becomes:

- **5 seeds × 3 baseline genomes = 15 runs**, 100k ticks each. The three baselines straddle the target: one below (`r = 1.0`, today's `BASELINE_GENOME`), one at it, one **above** (`r = 2.5`). The one above is the sharpest, because drift has no reason to walk downhill.
- The statistic is the population mean of `bodyRadius`, **time-averaged over the last 10k ticks**, not read at a single tick where whoever happened to be born moves it.
- **Accuracy:** every run within ±15% of the predicted `r_opt` — about one founding σ.
- **Convergence:** the spread of the run means is **smaller than the spread of the baselines they started from**. This is the gate drift cannot fake, and it is why varying the baseline matters more than varying the seed.
- **An extinct run is a failed run, not an excluded one.** Excluding it would let a calibration pass by killing off the worlds that disagreed.

`mitosisEnergyThreshold` and `childAllocationRatio` are reported and not gated: they have no closed-form prediction, so "they converged" is an observation worth recording and not a criterion to hang v0.1 on. `lineageHue` is a neutral marker and had better _not_ converge.

Running the criterion as written requires the baseline genome to become a construction parameter — `WorldOptions.baselineGenome`, arriving the same way `mortality` and `fertility` did. Today it is a module constant and there is no way to vary it.

## Considered options

**Assume linearity and skip the measurement.** What `vision.md` currently does. It is not wrong so much as unattributable: a world where the mass gate binds near `r_opt` would pass the done-criterion for the wrong reason and nobody would find out.

**Apply the carbon-cost law change immediately,** before measuring. Rejected as premature under the milestone's own constants-first posture: we do not yet know the window is too narrow, and changing a law before the measurement is the tuning-drift failure wearing different clothes. Pre-authorising it is the compromise — the decision exists in advance, and only the trigger is left to the instrument.

**Correct the closed form** to account for sub-linear income. Honest, and it costs v0.1 the one-line prediction ADR-0011 made the entire definition of done out of.

**Widen the ±15% band** if the runs come in just outside it. Named here so it is recognisable as a refusal rather than a judgement call later: the band is fixed before the runs, and a miss is a result.

## Consequences

- Three numbers the harness must produce that nothing currently computes: the fitted income exponent, `r_max`, and tenancy.
- `WorldOptions` gains `baselineGenome`, defaulting to `BASELINE_GENOME`.
- ADR-0019 is amended on the store, not the amount; if the fallback fires, `mitosisMassCost`'s documentation there is corrected rather than left contradicting the code.
- Three new glossary terms: **Calibration Harness**, **Done-Criteria Run** and **Tenancy**.
- M5 ends with a **verdict**, and "did not converge" is a publishable result that spawns the next milestone rather than a reason to move a band.
