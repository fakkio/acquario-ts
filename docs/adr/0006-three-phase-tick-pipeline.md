# Three-phase tick pipeline: read, resolve, commit

The tick samples the environment once into a read-only snapshot, then runs all per-organism logic without writing to the world, then commits every world mutation in a fixed order: delta buffer → collisions → deaths → births.

```text
1. snapshot concentrations and light
2..8   per organism: passive exchange, photosynthesis, respiration, maintenance,
       brownian motion, evaluate mitosis (enqueue), evaluate death (enqueue)
9..13  apply delta buffer, collisions and walls, deaths, births, tick++
```

## Consequences

- Photosynthesis, respiration and maintenance touch only the organism's own state, so the metabolic core is order-independent by construction and unit-testable against one organism plus a snapshot, with no world required. That is most of the TDD surface.
- Newborns are appended at step 12 and are **inert for their first tick**: the current iteration never sees them, ruling out half-initialised organisms metabolising and birth cascades within a tick.
- Deaths are applied before births on purpose, so a corpse's carbon lands in the pool for the *next* tick's diffusion. Every carbon transfer within a tick is one-directional, which makes the conservation invariant checkable at exactly one point: the end of step 13.
- Mutation PRNG draws happen at commit (step 12), not when reproduction is evaluated (step 7). Reproduction is *decided* during read and *resolved* during commit.
- `digestion` disappears from the earlier draft's ordering — it was respiration all along. The v0.2 steps (eyes, neurons, active organelles, thrust) slot between steps 5 and 6.