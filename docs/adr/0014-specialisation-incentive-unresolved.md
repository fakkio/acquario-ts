# Sublinear organelle effectiveness stands; how specialisation is rewarded is unresolved

Organelle effectiveness stays **sublinear** in size, as stated in `vision.md`. The mechanism that makes a specialist out-compete a generalist is **not decided**, and is deferred to v0.2 when organelles first exist.

This ADR exists to record a contradiction, not to resolve it.

## The contradiction

The project wants producers and consumers to diverge from a single genome. The intuitive lever is to reward specialisation superlinearly: if a generalist draws 50 from photosynthesis and 50 from respiration, an organism that commits to one should reach far more than 100.

Sublinear effectiveness says the opposite. Doubling an organelle yields less than double, so two small organelles beat one large one at equal total area. Under that rule the generalist carrying both pathways **beats** the specialist carrying one — precisely backwards.

Both statements were held simultaneously without either being written down next to the other. Neither is wrong on its own; they are incompatible as a pair.

## Why sublinearity is the one that stands

Sublinearity is what makes size and number a real trade-off. Remove it and the optimal body is always one maximal organelle of each type, which collapses the organelle design space to a single point and deletes the reason organelles have position, count and size at all.

The specialisation incentive has no such load-bearing role yet: v0.1 has no organelles, so nothing is blocked by leaving it open. Deciding it now would mean designing against an unbuilt system.

## Considered options

Recorded so the question does not restart from zero in v0.2.

- **Drop sublinearity, make effectiveness superlinear in size.** Rejected above: it destroys the size/number trade-off.

- **A flat overhead per _capability_, not per organelle.** Holding any photosynthetic machinery at all costs a fixed amount, so a generalist pays two overheads and a specialist one. Sublinearity in size survives untouched; what gets rewarded is abandoning a whole pathway rather than enlarging one organelle. This is the same shape as the existence cost in ADR-0009 — a flat term is what creates an interior optimum there too — which is weak evidence it is the right shape here.

- **Ecological rather than physiological.** Let specialisation pay through the environment: light is spatially heterogeneous, and producers vent the O₂ that consumers need. Niches then come from the world rather than from a cost curve. Requires the v0.2 spatial fluid simulation to be meaningful, since well-mixed pools erase exactly the gradients this depends on.

- **Do nothing and observe.** A generalist may genuinely be optimal in a well-mixed world, in which case the v0.2 fluid fields create the niches unaided and no incentive needs inventing. Cheapest option, and the only one that finds out whether the problem is real.

## Consequences

- v0.1 is unaffected. It has no organelles, and its `r_opt` done-criterion (ADR-0011) does not depend on this.
- The observable that settles it is whether v0.2 gene distributions go **bimodal** along the photosynthesis/respiration axis. A unimodal population of generalists is the signal that an incentive is missing — not proof that the model is wrong.
- Whichever mechanism is chosen must remain a **law of the world, not a designed outcome**. A cost function declares the problem; a species type declares the answer. The project's central bet is that only the first is written by hand.
