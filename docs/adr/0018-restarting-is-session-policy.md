# Restarting is session policy, not world behaviour

When a population goes extinct the App constructs a new `World`; the world never restarts itself. A **session** is the sequence of worlds run back to back in one tab, each seeded from the one before by a session-level PRNG derived from the master seed. Nothing in `src/world/` knows that sessions exist.

## Why the world cannot be the thing that restarts

`CONTEXT.md` defines a world as "One complete simulation run: an aquarium, its pools, its population, and the clock and random streams that advance them. **What a seed determines and a state hash identifies.**" A world that reseeds itself mid-life is no longer identified by its seed, and ADR-0007's guarantee — same seed, same build, same engine, identical run — quietly becomes false in a way that is hard to notice: tick N would belong to a different world than it did last run, and the hash at tick N would be comparing two different aquaria.

Putting the restart in the App costs nothing and changes nothing inside `src/world/`. The render loop already reads `getPopulation(world).length`; noticing that it is zero and rebinding its handle to `createWorld(nextSeed)` is the whole feature. This is the same call ADR-0015 already made for `α` smoothing: "Smoothing belongs to the App layer. A moving average in the world would be state crossing tick boundaries, which means it would have to enter `hashState` for the sake of one HUD row." An auto-restart has exactly that shape.

The conservation invariant is the other reason, and the sharper one. `initialTotalCarbon` and `initialTotalOxygen` are struck once in `createWorld`. A world that restarted itself would have to re-strike them mid-run, and re-striking is precisely how a restart that leaked or minted carbon would hide: the drift readout would innocently report zero. Keeping restarts outside the world keeps them outside the ledger, so the invariant stays per-world and a leak has nowhere to go. The 100k-tick gate therefore never crosses a restart — it runs in the immortal world of ADR-0017 — and M3's own acceptance run is a single world driven directly through `advance`, nowhere near the App's restart policy.

Worth recording, because it is not obvious from the formulas: **total carbon is invariant to the population draw and total oxygen is not.** `initializeMetabolism` solves `ambientConcentration = (K·π − A) / (A + aquariumArea)` precisely so that carbon lands on `K·π` whatever the draw. Oxygen works out to `ambientO₂ · (A + aquariumArea) + co2Share · (K·π − A)`, which moves with `A`. A world that reseeded itself would see carbon drift stay at zero across a restart while oxygen drift jumped — the two halves of the same invariant disagreeing for a reason that has nothing to do with a bug.

## What varies between worlds

The rule is **vary exactly one thing, and it is whatever you have**.

In M3 that is the seed, because it is the only axis that exists. The intended endpoint is the opposite: once organisms can be carried forward, the seed is **pinned** and the founders become the varying axis, which holds the pools, the placement draws and the light gradient constant so that any difference between consecutive worlds is attributable to genetics alone. That is the better experiment and it is the plan, not a future reversal.

It cannot ship first, though. With the seed pinned and no founders yet, world N+1 is bit-identical to world N and the restart becomes an infinite replay of one world — a feature that visibly does nothing. Varying both axes at once is worse still: it throws away the controlled comparison that made pinning the seed attractive.

The session PRNG is derived from the master seed either way, so one number reproduces an entire session, extinctions included. The HUD's seed row keeps showing the _current_ world's seed, so any single world can be replayed on its own by typing it back in.

Auto-restart ships **off** by default in M3, alongside a manual "new world" control. M3 has death and no birth, so every mortal world shrinks monotonically from tick 0 and the milestone's own story — the dark ones starve, the lit ones live forever — deserves to be watchable to its end rather than cut off at an arbitrary cadence. The manual control is debugging tooling of the same kind M0 front-loaded pan, zoom, pause and step for. Flip the default at M4, when a restart is showing something.

## Considered options

**A world that reseeds itself** on empty population: `WorldState.seed` becomes mutable, `hashState` folds a changing seed, the ledger baselines are re-struck inside a tick, and `CONTEXT.md`'s definition of a world is rewritten. Rejected for everything above.

**Drawing the next seed from fresh entropy** (`Date.now()`, `Math.random()`). Rejected: the most interesting thing a run will ever produce is a world that died in a way worth looking at again, and entropy makes that world unreproducible at exactly the moment it matters.

**`seed + 1`.** Reproducible, but correlated — adjacent states of the same generator — and there is no reason to find out the hard way whether adjacent seeds give visibly similar draws.

## Consequences

- One new glossary term, **Session**, and `World` keeps its current definition untouched.
- The restart is untested by the conservation gate, which is fine and deliberate: under this decision it touches no pool, no organism and no ledger. It constructs a world and drops the old one.
- It makes the eventual founder archive cheap. Carrying organisms forward means `World` becomes a pure function of `(seed, founders)`, and founders arrive as another field on `createWorld`'s options object; the policy choosing them lives in the App, which is where this decision already put it. That archive is **in-session memory only** — nothing written anywhere, so vision.md's "closing the tab loses the run" stands, and no genome schema gets versioned while the genome is still a four-field record on its way to `Gene[]`.
- The archive holds **genomes, not organisms**: a dead organism's stores went back to the pools at step 11, and only its heritable description can cross a world boundary without breaking the carbon ledger.
- The selection criterion for that archive is **open**, in the sense ADR-0014 leaves the specialisation incentive open. The leading candidate is a fixed-size list into which each death is inserted at a random index, the last element falling off — a recency-biased reservoir holding roughly the last `n · H(n)` casualties, heavily weighted toward the recent ones with a long tail that works against premature convergence. It is attractive partly because it introduces no new fitness axis: "died recently" in a collapsing world means "held out longest", which is survivorship, the thing the inner loop already selects on. An explicitly ranked criterion — longest-lived, most offspring, highest peak energy — would be a hand-written fitness function and would need vision.md's closing claim amended to say so. Worth noting for whoever runs the first experiment: in v0.1, dying last mostly means having been in the photic zone, and depth is not under genetic control until v0.2, so an early result may be reporting geography rather than genetics.
- **Cross-run inheritance must be off for M5's done-criteria runs.** ADR-0011 requires gene means to converge "from different seeds and different baseline genomes", and worlds chained through shared founders are not independent samples: part of the convergence would be inheritance. It stays a toggle, defaulting off, and calibration never enables it.
