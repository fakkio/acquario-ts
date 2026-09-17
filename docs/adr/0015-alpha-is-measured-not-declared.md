# `α` is measured, not declared

The energy income coefficient `α` in `r_opt = 2·c₀/α` is a **measured property of a running world**, not a constant of the simulation. M2 ships a population-mean readout of it; M5 solves `c₀` against that measurement rather than against a number picked in advance.

## Why

ADR-0009 derives the optimal radius from income being linear in `r`: `reproductiveRate(r) ∝ α/r − c₀/r² − β`, and ADR-0011 makes convergence on `r_opt = 2·c₀/α` the decisive done-criterion, computed "on paper from the constants". Both read as though `α` were one of those constants. It is not, and M2 is the milestone where that becomes concrete.

Energy has exactly one source: respiration. Respiration's substrate arrives by two routes, and both are functions of where an organism is rather than of the world's constants:

```text
photosynthetic income ∝ light(y)                 — depends on depth
diffusive food income ∝ C_external(food)         — depends on how rich the pool currently is
```

Light attenuates exponentially with depth (ADR-0004), so an organism in the photic zone and one on the floor have different `α` in the same tick. The food pool is closed and its concentration moves over the run as carbon cycles between pools, bodies and internal stores (ADR-0001), so the same organism has a different `α` at tick 1000 and at tick 50000. `α` is a field over the aquarium and a function of time, and the population mean is a summary of it.

## Considered options

**Declare `α` nominally** — fix it as a design constant describing a baseline organism at a stated depth with the pools at their initial concentrations, derive `c₀` from that, and accept that `r_opt` predicts the optimum for an idealised organism rather than for the population. Cheapest, and not wrong so much as quietly weaker: the done-criterion would then be checking convergence against a number that describes a world the simulation never actually occupies, and any disagreement would be unattributable — a failure of selection and a badly chosen nominal `α` look identical.

**Derive `α` analytically at M5** — solve the steady-state pool concentrations in closed form and integrate income over the light gradient. Possible, and it is an extra unknown solved at the one milestone that can least afford one: M5 already owes the HUD statistics, the CSV export, the constant solving and the done-criteria runs.

## The circularity, and why there is none

Measuring `α` from a run and then testing convergence against a prediction derived from that measurement looks circular. It is not, because the two runs are different worlds.

`α` is measured in **M2's world: a fixed, immortal population with no reproduction and no selection**. Nothing in that world can move a gene, so the measurement records the environment's income and nothing about fitness. The prediction `r_opt = 2·c₀/α` is then computed from it **before** the M4/M5 world exists, and the run that tests it is one where bodies are born, mutate and die. ADR-0011's requirement — that the number be fixed in advance, so drift cannot be mistaken for selection — is satisfied, and the fact that the number is read off an instrument rather than off paper changes nothing about when it is fixed.

## Consequences

- M2 gains a readout of mean energy income per unit radius, computed as `respirationEnergy / bodyRadius` per organism and averaged over the population, **excluding organisms whose respiration was throttled by a full energy store** in that tick — those measure their own tank, not the income available to them. Organisms at zero energy stay in: they are genuinely poor, and that is part of what the mean has to say.
- Smoothing belongs to the App layer. A moving average in the world would be state crossing tick boundaries, which means it would have to enter `hashState` for the sake of one HUD row.
- The single mean is enough for M2's purpose, which is confirming the constants are of the right order. It is **not** enough for M5's, so M5's CSV export carries `α` binned by depth: a population mean over a vertical gradient is an average of two different ecologies.
- ADR-0011 is amended in one word: the done-criterion converges on the `r_opt` predicted by the **measured** `α`. Everything else about it stands, including that the prediction precedes the run that tests it.
