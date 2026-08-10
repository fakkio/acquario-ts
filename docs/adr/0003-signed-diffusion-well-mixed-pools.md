# One signed diffusion law over well-mixed pools

Passive exchange is a single signed law, with concentration defined as an amount divided by the area holding it on both sides of the membrane:

```text
C_external(r) = pool[r] / worldArea
C_internal(r) = internal[r] / bodyArea
flux(r)       = kDiffusion × perimeter × (C_external(r) − C_internal(r)) × dt
```

In v0.1 the three pools (O₂, CO₂, food) are global and well-mixed — a zero-dimensional approximation of the spatial fluid simulation planned for v0.2+, where a region of the world will be able to be richer than another.

## Consequences

- One law covers every passive exchange: positive flux absorbs O₂ and food, negative flux vents CO₂. No direction flags, no special cases, and equilibrium falls out for free as `C_internal → C_external`.
- `cap = kCap × bodyArea` becomes a maximum internal _concentration_ — a physical constant rather than an arbitrary bucket size — and only binds when the world is richer than `kCap`.
- Hoarding leaks: an organism filled above ambient bleeds food back to the pool, which is a selective pressure against banking mass instead of spending it on offspring, obtained without writing a rule.
- Suffocation needs no rule. Low O₂ throttles respiration until the organism starves, so death by `energy ≤ 0` remains the only death condition.
- Measuring `C_internal` against `bodyArea` means a large organism needs proportionally more stock to reach a given concentration while its intake scales with perimeter only — the surface-to-volume pressure that is the central tension of v0.1.
