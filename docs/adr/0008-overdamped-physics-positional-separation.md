# Overdamped physics and positional collision separation

Motion is overdamped: velocity is proportional to force rather than to its derivative, with drag following Stokes' law (`drag ∝ radius`). Collisions are resolved by displacing overlapping bodies apart along their normal in proportion to `1/area`, with no impulses and no restitution; corrections accumulate in a buffer and are applied once.

## Considered options

Inertia, friction and bouncing collisions, as the earlier draft specified. Rejected on physical grounds: at the scale of microorganisms in water, inertia is irrelevant — Purcell's _Life at Low Reynolds Number_ — and a bacterium that stops swimming coasts roughly an atom's width. Momentum-based motion is not a simplification of that world, it is a different one.

Dropping collisions from v0.1 entirely was also considered, since nothing yet has a reason to interact. Rejected because light is the only spatially localised resource, so volume exclusion is what makes the photic zone finite and the only way one organism's existence costs another anything. Without it v0.1 has zero organism–organism interaction and the uniform grid is untestable dead code.

## Consequences

- No momentum state to integrate, hence an entire class of numerical failure removed: no oscillation, no restitution coefficient, no energy injected through collisions, no tunnelling. Valuable given that runs are unattended for 100k ticks against a conservation assertion.
- It matches what microscopy actually looks like — jittering, drifting, nudging apart — where bouncing billiard balls would read as wrong.
- Stokes drag reinforces ADR-0004: the diffusion coefficient goes as `1/r`, so large organisms stay near where they were born.
- v0.2 thrusters map output directly to a speed rather than an acceleration.
- The cost: an organism that stops pushing stops instantly, so inertial gliding can never become an evolvable strategy.
