# v0.2 is done when a knockout world loses the organelle the real world keeps

v0.2's definition of done is four standing gates, one feasibility gate on abundance, and one scientific criterion. The scientific criterion is a **paired knockout**. Each world is run twice on the same seed: once as it is, and once as a **Knockout World**, where one organelle type keeps its cost and loses its function. Selection, not drift, means that type is carried more often in the real world than in its knockout. This reverses ADR-0011's rejection of a null model, because v0.2 has no closed form for the null model to be weaker than. Settled in #51.

## Why a null model now

ADR-0011 dropped a `selectionDisabled` control because `r_opt = 2·c₀/α` was strictly stronger: a null model only shows that _something_ differs, while the closed form says where the population lands. v0.2's question is whether float and chloroplast frequencies rise **because of what those organelles do**. No closed form predicts an organelle frequency. It hangs on the insertion rate, the deletion rate, the split law and the cost law at once. So a null model is the strongest control on offer.

A knockout that turns the type off entirely would be the wrong null. It would remove the type's overhead, its area, its storage cost and its share of the bounded structural events. A frequency gap could then be the cost, not the function. The rule is **function off, cost on**:

- **Float knockout**: the float is weightless, as neurons and thrusters are (ADR-0032). It gives no lift and still pays its overhead and takes its area.
- **Chloroplast knockout**: `kChloro = 0`. It fixes no carbon and still weighs, pays its overhead and takes its area.

Mutation, drift and cost are then identical in both worlds, and only what selection can see differs. Every other type stays as it is, so the chloroplast's knockout still has working floats.

## The definition of done

1. **Standing gates**, held by every v0.2 milestone and retired only by ADR: conservation, determinism, **Persistence** at both levels (ADR-0027), and M1's overlap ceiling (ADR-0030). No founder archive and no restarts: a world that persists only after several restarts is not persistent.
2. **Feasibility**: the population's mean **Generation** at the end of a reference run is at least **50**. Below that, the knockout cannot tell the two worlds apart, so this gate comes before the done-criteria runs. The levers, in order: longer runs, which move no constant; then the mass side (ambient CO₂ share, `K` below the s₀ ≈ 2.5ρ wall), re-solving `c₀`. `BROWNIAN_FORCE` stays v0.1's.
3. **Selection, not drift**, on the final 0.2.0 world as the invariant of the last milestone:
   - for the **float** and the **chloroplast**, five seeds, each run in the real world and in that type's Knockout World;
   - the statistic is the **fraction of the population carrying at least one** of the type, time-averaged over the last 10% of the run;
   - **pass** when the real world is above its knockout in **every** seed pair;
   - an extinct run is a failed run, not an excluded one (ADR-0025).

## Reported, not gated

Fixed before the runs, so a miss is a result and not a reason to move a band:

- the **order** in which floats and chloroplasts rise (ADR-0032 predicts floats first);
- the **resting-depth distribution** of carriers by composition, and the float : chloroplast area ratio against depth;
- chloroplast radius against **`r* = c/k`**, and chloroplast count × radius against depth (ADR-0029);
- neuron and thruster carrier fractions, and the count of sense-to-actuator synapses, against a knockout where one is cheap.

The nervous system gets no gate. v0.2 is "Depth becomes genetic", and depth goes through composition. A neuron is neutral by construction when inserted, and a thin world gives a useful network little chance to emerge. Its correctness is TDD's job.

`r_opt` is reported in M6 on the gated world (ADR-0027) and then **retired**. Once bodies have organelles, income is no longer `α·r`. `r*` is its heir as a report.

Depth readouts live in the calibration harness and its CSV, not the HUD. The HUD's per-type carrier fraction already shows the order live.

## Considered options

- **Float-before-chloroplast order as the gate.** It is a prediction made on paper, the spirit of ADR-0011, but a fragile one: a different order would be a finding, not a bug.
- **`r* = c/k` as the gate**, the direct heir of `r_opt`. `k` moves with depth and CO₂ supply, and in a world of ~45 organisms the readout is too noisy to hang a version on.
- **Depth concentrating in the Bright Zone as the gate.** Geography can produce it, the failure ADR-0025's tenancy was written about.
- **A knockout that removes the type entirely.** It confounds function with cost.
- **"Four seed pairs out of five", or the mean over pairs.** A softer band chosen before the runs is still a softer band. The strict form is the one that cannot be argued down afterwards.
- **The selection gate as a standing gate from the milestone that ships the float.** Ten long runs per type are too expensive to repeat in every milestone.
- **A gate on the nervous system.** Left as a report, as argued above.
- **Environmental cycles as an abundance lever**: a Bright Zone that slowly narrows and widens again, killing those that cannot follow and returning their carbon. It would add turnover and give the nervous system and storage a use. It also moves the window `α` is measured through (ADR-0015, ADR-0023), and it adds a world law that no measurement has asked for. Kept in `docs/ideas.md`.

## Consequences

- `WorldOptions` gains a knockout option naming one roster type, arriving the way `mortality`, `fertility` and `baselineGenome` did.
- The calibration harness's v0.2 job is these numbers: mean Generation, carrier fractions per world, resting depth, `r*`. It stays an instrument; the gates live in the long suite (ADR-0024).
- The v0.2 milestone table's last row carries the selection criterion, and the feasibility gate sits before it.
- Glossary: **Knockout World**; **Done-Criteria Run** amended to cover v0.2.
