# Closed carbon ledger; photosynthesis fixes carbon

The world is a closed system whose only external input is light. To make that literally true rather than narrative, food is modelled as pure carbon and is the currency of *matter*: photosynthesis is `CO₂ + light → food + O₂` (carbon fixation, producing no energy), respiration is `food + O₂ → energy + CO₂`, mitosis pays food-mass in proportion to the child's area, and death returns exactly the mass paid at birth.

## Considered options

An earlier draft had photosynthesis produce energy directly and death convert body mass into food, while nothing ever *bought* that mass. That mints food from nothing on every birth–death cycle, funded by sunlight: the food pool trends upward without bound, there is no carrying capacity, and the claim that extinction is an emergent outcome is false. The alternative was to keep it and delete the conservation claim, accepting a corpse-driven food faucet tuned by a magic number.

## Consequences

- Two quantities are exactly conserved and continuously asserted: carbon (`pool.food + pool.CO₂ + Σ internal food + Σ internal CO₂ + Σ bodyMass`) and oxygen (`pool.O₂ + pool.CO₂ + Σ internal O₂ + Σ internal CO₂`). Energy is deliberately not conserved.
- Population is hard-capped by the world's total carbon rather than by a tuning constant.
- A photosynthesiser must *also* respire to obtain usable energy, as real plants do, so O₂ and CO₂ are genuinely coupled instead of decorative.
- The conservation assertion is the project's primary bug detector, and later guards the v0.2 fluid solver, whose semi-Lagrangian advection is stable but not mass-conserving.