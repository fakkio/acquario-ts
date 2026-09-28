# A parent breeds only when it can pay for the worst-case child

v0.1 did not die of its ecology. It died of the order of three lines in `evaluateMitosis`: draw the child's mutation, check the parent can pay for it, and on failure try again next tick with a fresh draw. That is rejection sampling on the child's cost, and it is the **Birth Sieve**. v0.2's first milestone replaces it with the **Worst-Case Birth Gate**: a parent attempts mitosis only when it can already pay for the most expensive child its mutation law could produce, so the draw that follows never fails for lack of means. **Persistence** becomes a gate every later milestone holds.

## What #40 measured

Five seeds, 100k ticks, unprimed ([`experiment/v0-1-extinction`](https://github.com/fakkio/acquario-ts/tree/experiment/v0-1-extinction/experiments/v0-1-extinction)):

- Ambient food sits below `ρ`, and internal `C_food` stays at 0.65–0.77 `ρ` all run. Almost no body can afford a same-sized child, so the mass requirement rejects most draws, and it rejects the large ones first. On every committed birth: **≈100% of children smaller than their parent, 0% larger, mean child/parent radius 0.94.** Each generation is about 6% smaller by mechanism, not by selection, until the population crosses the smallest viable radius and dies.
- Removing the sieve is sufficient for persistence. Freezing `bodyRadius` survives 5/5. Pricing the worst-case child before the draw survives 5/5 **and** `bodyRadius` rises, 0.90 → 1.18 towards `r_opt = 1.5`: the first v0.1 world whose radius moves by selection.
- ADR-0025's **Tenancy** does not predict survival. Levers pushing it to 6–14 still went extinct; the two populations whose radius held or rose had the lowest tenancy measured (0.35, 0.60). #36 measured tenancy through the sieve.
- Metabolic levers only delay the collapse, and confining organisms to the light freezes the population rather than curing it.

## The law

```text
strategy gate (genetic):   energy ≥ mitosisEnergyThreshold × cap(energy)          no draws
worst-case gate (physical): energy ≥ mitosisEnergyCost(maxChildArea)
                            food   ≥ mitosisMassCost(maxChildArea)                 no draws
then:                       derive the child's stream, mutate, pay                  cannot fail
```

`maxChildArea` is the parent's cost scaled by the **Birth Cost Ceiling** `(1 + γ)`. The ceiling is a property the mutation law **guarantees by construction**, not a maximum the parent computes over every possible mutation. In v0.1 it falls out of the multiplicative radius law: a child's radius is at most `r·(1+δ)`, so `γ = (1+δ)² − 1`.

In v0.2 it becomes a requirement on the structural genome's operators (#42). Whatever mutations exist, a child can cost at most `(1+γ)` times its parent: new organelles are born at a small fixed size, a duplication cannot copy a large organelle for free, and a birth carries a bounded number of mutations. The ceiling is **never enforced by rejecting draws that exceed it**, since that would reintroduce the sieve from the other side.

With both gates passed before any draw, the children actually born are an unbiased sample of the mutation law. What the gate filters is **which parents breed**, and it filters them on their own state.

## Persistence is a gate

It holds at two levels:

- **Long suite.** The milestone's reference world (its baseline genome, its laws, its constants), unprimed, five seeds, 100k ticks: every seed ends with a living population. Held by every milestone from v0.2's first on, like conservation.
- **Unit level.** Over committed births, the mean log ratio of child cost to parent cost is zero within tolerance. Survival alone is a weak gate: `K_PHOTO = 0.06` survived 5/5 _inside_ the sieve at `r ≈ 0.12`. The bias test is the one that catches a sieve reintroduced by a future operator.

A milestone that cannot hold persistence changes its baseline genome or constants until it does, or retires or relaxes the gate **by ADR**. It never fails silently. A world that persists only after several restarts is the founder archive's business, which is outside v0.2.

## Abundance is not this decision's

The gated world persists but is thin: about 45 organisms and 6 births per organism per 100k ticks. Two follow-up sweeps on the same branch settled where abundance comes from:

- **No energy lever thickens it.** `K_PHOTO`, respiration yield and `c₀` all lengthen lives (17k → 27–74k ticks) and _lower_ the generation rate. A chloroplast is "more food per unit of light", so organelles cannot earn abundance either.
- **Only mass does.** A lower ambient CO₂ share (more of the same carbon dissolved as food) takes the population to 89 and 122 and triples the generation rate. The carbon budget `K` thickens it further, up to a viability wall near `s₀ ≈ 2.5 ρ` under the committed caps. ADR-0022's carbon ceiling is not what binds: every surviving world leaves 60–80% of it unused, and the population settles where ambient food sits near `ρ`.
- Every such move shifts `α`, so `c₀` must be solved again. In richer worlds the radius falls, in the direction `r_opt = 2c₀/α` predicts for a larger `α`; the readout is too noisy to call it a confirmation.

How thick v0.2's world must be depends on what v0.2 has to observe, so it is chosen against v0.2's definition of done, not here. The first milestone ships the law alone: one invariant, one cause. It costs no recalibration, because `α` is measured in an infertile population the gate never touches.

## `r_opt`, one more time

With the sieve gone, v0.1's closed form is testable for the first time. The first milestone re-runs ADR-0025's done-criteria runs on the gated world as a **reported** measurement, not a gate. The organelles make `r_opt` obsolete within a few milestones, and v0.2 should not be tied to it.

## Considered options

**Draw once, hold the child until affordable.** It adds state that crosses tick boundaries, and it is still biased: an expensive draw more often never gets born, and it sterilises its parent while it waits.

**Always price the child at the parent's size, returning the difference to the pools.** Untested, and it reopens ADR-0019's settled amount.

**Freeze `bodyRadius`.** It works in v0.1, but v0.2's body is built from organelles and cannot be frozen.

**Pull a metabolic lever instead.** Measured: it delays the collapse, and with the gate in place it thins the world further.

**Let v0.2's organelles, thrusters and depth control earn survival.** The sieve acts on any heritable trait that raises a child's cost, organelles included. Confinement measured depth-holding without the fix and found a frozen crowd, not a living one.

**Fix persistence and abundance in the same milestone.** It breaks the one-invariant discipline, and the constant it would move has no target until the definition of done names one.

## Consequences

- **ADR-0019 is amended in its draw order.** A physical gate on the worst case, with no draws, now sits between steps 1 and 2. Step 4's "if a physical requirement fails, the draws are spent and the child is discarded" becomes unreachable by construction. The paying stays where it was.
- **ADR-0025's tenancy gate is not carried into v0.2.** What replaces the calibration harness's gates is left to v0.2's definition of done.
- **ADR-0026's verdict stands as v0.1's verdict.** Its "no lever was left to pull" was true of constants. The cause was a law.
- **The structural genome (#42) inherits a requirement:** its mutation operators must guarantee a Birth Cost Ceiling.
- The v0.2 map's standing constraint on survivability levers is superseded: the world thickens only on the mass side, and any such move re-solves `c₀`.
- Four glossary terms: **Worst-Case Birth Gate**, **Birth Cost Ceiling**, **Birth Sieve**, **Persistence**.
