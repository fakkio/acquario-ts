# No gravity in v0.1; light acts through a positional founder effect

v0.1 has no gravity or buoyancy. Light is a vertical gradient attenuating exponentially with depth (`I(y) = I₀·e^(−k·y)`), precomputed into a lookup table so the simulation loop evaluates no transcendental function.

## Considered options

Adding sinking, so that body size determines equilibrium depth and couples the one multiplicative gene to light income. Rejected because v0.1 has no thrusters: sinking would be monotonic, the entire population would accumulate in a dark layer at the floor, carbon fixation would stop, and the closed carbon cycle would have no input. Gravity without propulsion produces no niche. Buoyancy only becomes an interesting axis once something can fight it, so it arrives in v0.2 packaged with thrusters.

## Consequences

- Depth is not under genetic control in v0.1; the doc's earlier claim that light "introduces a natural selective pressure" is only true in a weaker, lineage-level sense.
- What light does provide: spatial heterogeneity of income, and a **positional founder effect** — because children are born tangent to their parents, position is quasi-heritable and a lineage in the photic zone passes on the good address.
- Two strategies exist from one genome: organisms in the light fix carbon, organisms in the dark subsist on dissolved food that corpses put into the pool.
- Combined with Stokes drag (ADR-0008), large organisms wander slowly and stay where born, so size means _higher variance_ in lifetime light income.
