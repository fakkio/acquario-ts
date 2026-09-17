# Death returns remains to the pools, and mortality is a world mode

An organism dies when its energy reaches zero or below, evaluated at step 8 and applied at step 11. Death is not an exemption bolted onto M2's clamp: **mortality is a mode a world is constructed in**, `createWorld(seed, { mortality: "on" | "off" })`, defaulting to `"on"` from M3. The dying organism's contribution to the world is frozen at step 8 into **remains** — a value carrying its position, its three diffusible stores and its body mass — and deposited at step 11 through a position-carrying method of its own, never through `exchange`.

## Why mortality is a mode rather than the end of immortality

M2 pinned its population by flooring energy at zero on one line of `applyMaintenance`. The obvious M3 move is to delete that line. It is the wrong move, and the reason is ADR-0015.

`α` is measured, not declared, and the no-circularity argument rests entirely on _where_ it is measured: "a fixed, immortal population with no reproduction and no selection. Nothing in that world can move a gene, so the measurement records the environment's income and nothing about fitness." M5 solves `c₀` against that measurement. If M5 moves the carbon budget or the aquarium — and calibration is exactly the milestone that does — `α` has to be measured again, in a world that no longer exists because M3 deleted it.

So the immortal world is an instrument, not a scaffold, and it has to outlive the milestone that happened to need it first. M2's 100k-tick conservation gate keeps running in it unchanged, which has the second benefit of keeping the standing regression free of any death code at all.

The clamp moves out of `applyMaintenance`, which becomes unconditional: `organism.energy -= cost`, one behaviour, no mode. The clamp becomes an explicit line in `runTick`'s numbered pipeline, where "this world does not let an organism fall below zero" is visible to a reader already looking at the steps, rather than a `Math.max` two files away that silently means something different depending on which world called it.

The mode does **not** enter `hashState`. A hash identifies a state, not the laws that produced it, and two worlds of different mode at tick 0 genuinely are the same state; they diverge on their own from the first tick that charges maintenance. Folding it in would invalidate every hash M2 recorded, for nothing.

## Why remains are a frozen value, taken before separation

ADR-0006 fixes the commit order: delta buffer (9), collisions (10), deaths (11), births (12). Collisions therefore run _before_ deaths, so a condemned organism is still separated and still moves on its final tick, and its position at deposit time is not its position at death.

An organism dies when its energy runs out, not after being shoved by its neighbours, so the honest position is the one it held at step 8. In v0.1 this makes no observable difference, because the deposit ignores `pos` exactly as everything else does — which is precisely why it is worth settling now rather than in v0.2, when getting it wrong means corpse carbon landing in the wrong fluid cell and nobody being able to say when that started.

Freezing the value has a second payoff: step 11 becomes a pure `(pools, remains[]) => pools`, testable against no world at all.

The deposit is summed **order-independently**, the same way `ExchangeSettlement.commit` sorts before reducing. This is not decoration. Deaths are a second pool mutation in the same tick, and if they accumulate in population order then reordering the population stops producing bit-identical pools, breaking ADR-0005's guarantee and ADR-0007's with it. It would break invisibly, too: the `shuffle`-based tests only start failing once a run happens to bury two organisms on the same tick.

## Considered options

**A grace period** — die only after `n` consecutive ticks at zero, giving a starving organism a window to catch a passing food packet. Rejected: a new tuning constant and new per-organism state that would have to enter `hashState`, bought in exchange for softening a dynamic the model wants sharp.

**Keeping the floor in the mortal world too.** Harmless-looking and actively bad: in a mortal world the floor is unreachable code, and worse, it hides a bug class. If maintenance ever drives energy to `-1e6` that is an arithmetic error, and it should be visible in the last state the organism held rather than quietly clamped to something plausible.

**Depositing through `Environment.exchange`.** Rejected on grounds of what `exchange` means. It is the diffusion path: it can be partially fulfilled, and ADR-0016 exists to keep that partial-fulfilment path live. A death deposit is categorically different — always a credit, never a draw, never scaled, never failing, with no meaningful return value. Routing it through `exchange` would add a call site that structurally cannot exercise the path `exchange`'s return value exists to protect.

**Re-evaluating `energy <= 0` at step 11** instead of carrying the condemned list from step 8. Nothing between the two steps touches energy today, so the two predicates agree today. They are still two predicates that must agree forever, and M4's mitosis charge lands at step 12, close enough to be uncomfortable: the tick they disagree on is the tick an organism is both deposited and kept, minting its entire body mass.

**An `alive` flag on `Organism`.** `foldPopulation` folds every field that bears on determinism, so the flag would have to be folded, and it would read `true` for every organism in the array at every point a hash is ever taken. A field that is structurally constant is a field that should not exist.

**Storing `bodyMass` rather than deriving it.** Already settled in code and reaffirmed here: `bodyMass(organism) = ρ · bodyArea(organism)`. The conservation invariant and the death return must agree to the last bit or M3's acceptance criterion is noise, and the cheapest guarantee is that they are the same call. Generation-0 mass is not conjured — `initializeMetabolism` subtracts the population's summed body area from the carbon budget before solving ambient concentration, so total carbon at tick 0 is exactly `K·π` and death hands back precisely what construction deducted. A stored field buys nothing until an organism's mass can diverge from its area, which is growth-during-life, explicitly a future direction.

## Consequences

- **An organism can starve to death with a full food store.** Respiration follows mass action, so its rate — not its substrate — is the binding constraint. Slow respiration is itself a cause of death, and M3 is where that first becomes visible. It is intended.
- The `α` mean is struck at step 5 over a population that still contains the condemned, so a dying organism contributes to its own final tick's mean. Correct under ADR-0015: "Organisms at zero energy stay in: they are genuinely poor, and that is part of what the mean has to say."
- `getZeroEnergyCount` stops meaning anything in a mortal world — energy passes through zero to negative and the organism is gone the same tick — and is scoped to the immortal world, where an aquarium half-parked at zero is still exactly the signal that the constants are wrong. The mortal HUD shows a **cumulative** death count instead, cumulative rather than per-tick because `advance` runs up to 240 ticks per frame and any per-tick readout loses every death but the last batch's.
- M2's test pinning population constant over 2000 ticks moves to the immortal world; `applyMaintenance`'s "clamps energy at zero" test inverts to "drives energy negative".
- The milestone's strongest test becomes available only because the world is closed: run a population deep enough that light is negligible until every organism is dead, and total carbon lands back on exactly `K·π`. That is an assertion against a closed-form number known in advance, not against a drift from a baseline.
