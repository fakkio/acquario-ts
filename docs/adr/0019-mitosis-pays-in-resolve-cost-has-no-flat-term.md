# Mitosis pays in the resolve phase, and its energy cost has no flat term

Step 7 mutates a child's genome, prices it, debits the parent and enqueues a **pending birth** — the mirror of `death.ts`'s remains. Step 12 constructs the child, constrains it to the aquarium and appends it. The parent pays _now_, in the resolve phase, not later when the child is actually constructed.

## Why the parent pays at step 7, not at step 12

`docs/vision.md`'s tick pipeline, before this ticket, wrote step 12 as "mutate the genome, pay the costs, append" — but the physical requirement `energy ≥ mitosisEnergyCost(childArea)` needs the _mutated_ genome to know `childArea` at all, so pricing has to happen no later than mutation does. One of the two has to move, and moving payment earlier rather than mutation later is what avoids a same-tick double-spend.

The pipeline is fixed: mitosis at step 7, death at step 8, remains deposited at step 11, births applied at step 12. If the parent paid at step 12 instead, an organism could be condemned at step 8, have its entire contents returned to the pools at step 11, and then pay for a child at step 12 out of stores the world had already taken back — carbon minted from nothing, and not an edge case: it is exactly what a population under pressure does. Paying at step 7 means the debit lands on the parent's own fields before step 8 ever reads its energy, so a condemned parent's remains already reflect what it gave away.

Two alternatives were considered and rejected. **Dropping a birth whose parent was condemned** needs a second predicate that has to agree with `evaluateDeaths` forever — precisely what ADR-0017 refused when it derived survivors from the condemned list rather than re-evaluating `energy <= 0` a second time. **Moving death evaluation ahead of mitosis** reorders a pipeline three ADRs (0006, 0016, 0017) already lean on.

## A pending birth is the mirror of remains

A frozen record — genome, the four stores, position, the child's own stream — carried from step 7 to step 12, the same shape `Remains` gives a dying organism's contribution between step 8 and step 11. Matter in flight lives in that record the same way dead matter lives in `Remains`, and `totalCarbon` at step 13 sees all of it: nothing is created or lost between a parent's debit and a child's construction, only relocated.

`appendBirths(population, births) => population` is a pure function, mirroring `depositRemains(pools, remains) => pools` — testable against no world at all, and, like the deposit, the place where step 12's other job lives: constraining a newborn to the aquarium. Births land after step 10's separation and wall clamp have already run for everyone else this tick, so without that call a newborn could end its birth tick outside the walls; nothing in the physics would crash (`lightAt` clamps depth, `cellIndexAt` clamps out-of-range bodies to the nearest edge cell), so this is a choice about the invariant — no organism is ever outside the aquarium at the end of any tick — rather than a bug fix.

## Reproducing can starve you, and that is intended

The energy cost is charged before step 8 reads `energy <= 0`. An organism that breeds at exactly its threshold and then cannot cover its own maintenance dies on its birth tick: its remains are deposited, its child is alive. That is a real selective pressure on `mitosisEnergyThreshold` — a lineage that breeds too eagerly pays for it with its own life — rather than a defect to design around.

## The cost shape: `mitosisMassCost` is forced, `mitosisEnergyCost` has no flat term

```text
mitosisMassCost   = ρ × childArea                     (paid from food)
mitosisEnergyCost = MITOSIS_ENERGY_COST × childArea   (paid from energy)
```

`mitosisMassCost` is not a choice. `bodyMass(organism) = ρ × bodyArea(organism)`, and death returns exactly that amount to the pool (ADR-0017); any other number for the mass a child costs its parent breaks the ledger the moment the first child is born. Matter, not fuel — the distinction the two currencies exist to make (`docs/vision.md`).

**ADR-0025's fallback was tried at #36 and declined, on principle rather than on the numbers.** ADR-0025 pre-authorises drawing the remainder of `mitosisMassCost` from CO₂ when food alone falls short, releasing the O₂ it carried. It worked, and cleared `r_max` with room to spare — but it breaks a symmetry every other resource in `childAllocationRatio`'s own split keeps: a parent hands its child the _same_ resource it gives up, food for food, oxygen for oxygen, CO₂ for CO₂. Converting CO₂ into mass at the exact moment of birth is a cross-type exception to that rule, for food alone, and the calibrated world does not need it: `AMBIENT_CO2_SHARE`'s own move already clears the mass gate on food alone, with a thinner margin than the fallback would have given but a real one (see `AMBIENT_CO2_SHARE`'s own comment in `constants.ts`). Recorded here so the fallback is not proposed again without knowing it was tried.

`mitosisEnergyCost` is a genuine design choice, and the choice made is **strictly proportional to area, with no flat term**. Maintenance (`c₀ + β·area`, ADR-0009) has a flat term on purpose — it is what creates a minimum viable body size. Mitosis deliberately does not, and the asymmetry is load-bearing rather than an oversight: `r_opt = 2·c₀/α` is derived from `reproductiveRate(r) ∝ (α·r − c₀ − β·r²) / r²`, and the `/ r²` _is_ the assumption that a child costs in proportion to its area. A flat term in the mitosis cost would put a second knee in that curve, `r_opt` would stop being a closed form, and M5 would lose its entire done-criterion over a cost this ticket controls.

`MITOSIS_ENERGY_COST ≈ 100` is provisional, marked for M5 like the rest of `constants.ts`'s table.

## The draw order is a law of the world

1. **The threshold gate**, `energy ≥ mitosisEnergyThreshold × cap(energy)`, with no draws at all — an organism that never breeds draws exactly the numbers it drew before this ticket existed.
2. **Derive the child's stream**, before mutating. The child's seed is then a function of the parent's state at birth and of nothing else; adding a fifth gene later, or retuning a δ, does not reseed every lineage in the world. `createPopulation` already derives before drawing, for the same reason.
3. **Mutate the genome**, gene by gene in `mutateGenome`'s own fixed declaration order, drawn from the _parent's_ stream (the one `deriveChildStream` just advanced past the derivation draw) — not the freshly derived child stream, which the child keeps untouched by its own birth.
4. **Price and pay.** If a physical requirement fails, the draws from 2 and 3 are already spent and the child is discarded — no rollback, and harmless, because ADR-0007 scopes the consequence to the parent's own lineage.
5. **The tangent angle, last, and only on a committed birth**, so the rejection-sampling loop's variable draw count never runs on the failed path.

`drawUnitVector` (formerly `drawDirection`, private to `motion.ts`) moves to `rng.ts`: a seeded random unit vector is that module's business, and brownian motion using one was incidental. Mitosis's tangent-angle draw is its second caller.

## Considered options

**Pricing off the parent's own (unmutated) area** instead of the child's. Rejected: `bodyMass`/conservation would then disagree with what the child's own cap and derived mass actually are the moment `bodyRadius` mutates, which is every birth that fires that gene.

**A flat term in `mitosisEnergyCost`**, matching maintenance's shape. Rejected above — it costs M5 its closed form.

**Rolling back the parent's draws on a rejected birth.** Rejected: it would make an organism's own RNG sequence depend on whether a birth it _attempted_ happened to succeed, which is state a stream consumer has no way to know in advance, and ADR-0007 already accepts variable draw counts (brownian motion's rejection loop) as long as the consequence stays scoped to one lineage.

## Consequences

- `evaluateMitosis(organism) => PendingBirth | null` is per-organism, resolve-phase, writing only to that organism — exactly like `applyRespiration` and `applyBrownianMotion` — which is what keeps the phase order-independent by construction, unlike `evaluateDeaths`, which partitions the whole population.
- A parent buds at most one child per tick, by construction: the function returns one value, never a list.
- `childAllocationRatio` splits what remains **after both costs**, across all four resources including energy, capped at the child's own caps (computed from its mutated area via a new `capForRadius`, since no `Organism` for the child exists yet to hand the ordinary `capFor`); whatever the child cannot hold simply stays subtracted from nothing extra — the parent's debit is exactly the granted amount.
- **A calibration gap, worth recording rather than quietly working around.** With `ρ = K_CAP = 1`, `mitosisMassCost` for a same-sized child is _exactly_ that child's own food cap — a parent needs close to its entire food store to afford one birth. M2's respiration is deliberately supply-limited (ADR-0015), so food is consumed near the rate it arrives rather than piling up: measured directly, the richest organism in a 100k-tick immortal, infertile run never holds more than about 6% of its food cap. Under the milestone's current, pre-M5 constants, natural reproduction essentially never fires — not a defect in this ticket's code, since the only levers M4 owns (`MITOSIS_ENERGY_COST`, `BASELINE_GENOME.mitosisEnergyThreshold`) are both on the energy side of the ledger, and neither touches the food side. The M4 acceptance gate (`reproduction.long.test.ts`) primes generation 0's food and energy stores to demonstrate the mechanism works end to end; recalibrating the constants that would let it happen unaided is M5's job, per the ticket's own "Out of Scope: Calibration" note.
