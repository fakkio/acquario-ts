# The relaxed layout is inherited, the radius floor clamps, and the ceiling counts only operators with a target

> **Amended by [ADR-0036](./0036-the-body-is-its-cytoplasm-plus-its-organelles.md).** An organelle is born anywhere in the body, not inside the Enclosing Circle, and the genome is no longer recentred on it: the body is its cytoplasm plus its organelles. The relaxed layout stays inherited, the radius floor still clamps, and the ceiling still counts only operators with a target.

M7 builds ADR-0028's structural mutation law and settles what that ADR left to the milestone. A child's genome is its parent's, mutated, then **relaxed and recentred**: the layout a body is built from is the layout its genome holds. Organelle radius has a floor that clamps rather than deletes. The **Birth Cost Ceiling** takes its worst event over the operators that have a valid target in the parent's genome, not over every operator. This amends ADR-0028. Settled in the M7 grill.

## The genome holds the relaxed layout

At birth the child's genome goes through three steps, all part of the mutation law: mutate, relax the organelles apart, recentre every position on the new **Enclosing Circle**'s centre. Founders go through the same three steps. The child is then built from that genome, with nothing left for construction to fix.

The alternative keeps the positions mutation produced and derives the layout from them every time. Those positions can then pile onto one another without limit, because relaxation hides the overlap. A position mutation stops moving anything visible and drifts at random. The relaxation contract would also have to hold for `relax(genotype)`, a function that can jump a long way when its input moves a little. If the genome holds the layout, the contract only has to hold for one relaxation of a layout that was already free of overlaps, with a few events applied to it.

The genome is still fixed for an organism's life: relaxation happens once, at birth, before the child exists.

## Insertion lands inside the Enclosing Circle

ADR-0028 places an inserted organelle within the current circle, and `vision.md` said "inside the current body". The circle is right. A disc born in the cytoplasm rim, far from the other organelles, grows the Enclosing Circle by about half the cytoplasm thickness, not by `2·r_new`, and the ceiling would have to cover that for every parent. In a body with no organelles the circle is empty, and the first organelle is born at the centre.

## The radius floor clamps

Radius uses the symmetric multiplicative law with a floor, `r_min`, from ADR-0028's closed menu. A **Split** whose smaller piece would fall below `r_min` has no valid target and does nothing, as every event without a target does. Clamping a piece up instead would add area that a split exists to conserve.

Deleting an organelle that shrinks below the floor was the other candidate, and it suits M7, where an organelle without a use could wither away. It fails in M11. A neuron's radius buys nothing (ADR-0031), so selection drives neurons towards the floor. Deleting at the floor would then remove wired neurons at random, with every synapse touching them, and add a hidden deletion rate on exactly the structure ADR-0031's neutrality exists to protect. A clamped neuron rests at `r_min` and does no harm. Why a neuron should be large at all is still open, in `docs/ideas.md`.

## The ceiling counts only operators with a target

ADR-0028 takes `maxEventGrowth` as the maximum over every operator. M7 tightens it, which that ADR allows ("the milestone may tighten the constants"):

- only operators with at least one valid target in the parent's genome count. With an empty `Gene[]`, only insertion counts. With an empty roster, nothing does;
- an insertion into a body with an empty Enclosing Circle grows it by `r_new`, from nothing to one disc, not by `2·r_new`.

A world with an empty roster then prices exactly v0.1's ceiling. That is what lets M7's regression test hold that world to M6's state hash. It also protects persistence cheaply. Every minimal organism can receive an organelle, and pricing that possibility costs it `r_new + (M_max − 1)·2·r_new` of ceiling radius on top of v0.1's.

## Considered options

- **Positions kept as mutated, layout derived each time.** Positions overlap and drift without limit, and the contract has to hold for a function that can jump.
- **Insertion anywhere inside the body.** The ceiling would grow with cytoplasm thickness for every parent, for organelles born far from the rest.
- **Deletion at the radius floor.** It suits M7 but becomes a hidden deletion rate on networks in M11.
- **A ceiling at the 90th percentile, with a child the parent cannot pay for born dead.** Mass is not the problem, since a child born dead returns its carbon through the Remains like any death. The problem is that the children born alive stop being an unbiased sample of the mutation law. The parent paying for the child born dead makes the cut costly, not unbiased, and that is the Birth Sieve with a price attached (ADR-0027). The cut also lands on innovation. With `M_max = 2` and `p = 0.25`, about 9% of births carry an insertion, so the most expensive tenth of children is almost exactly the children with a new organelle. Making the parent die instead keeps the same bias and kills breeders.

## Consequences

- The relaxation algorithm stays the ticket's. Its contract is checked by a property test over random genomes and events, and by the `throw` `evaluateMitosis` already makes when a child breaks its parent's ceiling. A draw is never rejected.
- The calibration harness reports the cost of the ceiling: the mean ratio of `maxChildArea` to the area of the child actually born, for carriers and non-carriers, next to the neuron's carrier fraction.
- `vision.md`'s insertion text now reads "inside the current Enclosing Circle".
- Glossary: **Enclosing Circle**.
