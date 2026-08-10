# Reproduction genes are dimensionless ratios

`mitosisEnergyThreshold` and `childAllocationRatio` are fractions in `[0, 1]` mutating additively with clamping; `bodyRadius` remains the only multiplicative gene. Reproduction is gated by a hard physical requirement (enough energy _and_ enough food-mass for the child) plus the genetic strategy threshold, expressed as a fraction of the organism's own energy cap.

## Considered options

Keeping `mitosisEnergyThreshold` as an absolute amount, as originally drafted. Two defects: energy is capped at `kCap × bodyArea`, so multiplicative mutation can drift the threshold _above the cap_, permanently sterilising an organism and every descendant — a modelling accident, not a fitness effect. And the threshold's meaning depends on `bodyRadius`, silently entangling two genes so that neither's evolution can be read cleanly.

## Consequences

- Sterile lineages are impossible; `1.0` is reachable and viable.
- The genome follows one mutation law for ratios and one for scale, rather than two arbitrary ones.
- The r/K trade-off becomes explicit and readable: a low threshold breeds early and thin, a high one hoards and breeds fat.
