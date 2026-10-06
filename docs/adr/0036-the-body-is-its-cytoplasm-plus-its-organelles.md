# The body is its cytoplasm plus its organelles, and an organelle is born anywhere in it

ADR-0028 and ADR-0034 derive the body from its organelles: the **Enclosing Circle** of the relaxed layout, plus a width of cytoplasm, centred on that circle. That puts a lone organelle at the centre of its body for ever. A thruster there can never make torque, a float can never right the body, and a lone organelle is the stage every lineage starts from. This ADR inverts the dependency: the body is its cytoplasm's area plus its organelles' area, and the organelles are placed in it. It amends ADR-0028 and ADR-0034. Settled in the M7.5 grill.

## The gene is the cytoplasm's radius, and the body's area is a sum

The body-size **Organism Gene** is the **Cytoplasm Radius** `r_c`, the radius of a circle of area `C = π·r_c²`. It replaces `cytoplasmThickness`, keeps `bodyRadius`'s multiplicative law and step, and with no organelles is the whole body radius, so v0.1's minimal organism and a world with an empty roster stay what they were to the last bit.

```text
R_area = √((C + Σ organelleArea) / π)
Reach  = max over organelles of (|p| + r)        (0 with none)
R      = max(R_area, Reach)
```

The body is a circle of radius `R` centred on the genome's origin. **Cytoplasm Area** stays what it was, `bodyArea − Σ organelleArea`, and is now at least `C`. An organelle's area is added to the body rather than taken out of the cytoplasm, so organelles do not shrink the stores.

## Organelles are born anywhere, and nothing recentres

The genome's origin is the body's centre and stays so: the recentring ADR-0034 added is gone. Position now means something to the physics, which reads it from that centre (a thruster off the centre makes torque, a float off the centre rights the body).

An insertion draws its type, then computes the radius the body will have with the new organelle's area added, and only then draws its position: uniform by area over the disc of radius `R_new − r_new`, which holds the whole organelle by construction. Generation 0's founders are placed by the same law. Relaxation still follows every event, and still only moves positions.

## The body grows to hold what is in it

An organelle can end up past `R_area`: it grew near the rim, a deletion or a smaller `r_c` shrank the body, or relaxation pushed it out. The body then grows to `Reach`, and the organelles never move back. Packing discs fills at most 90.7% of a circle, so an organelle set can also fail to fit `R_area` outright, and this is the one rule that has no unresolved case.

## The ceiling is the larger of an area bound and a reach bound

ADR-0034 rejected inserting anywhere in the body because the ceiling would then grow with the cytoplasm's width for every parent. With the body growing by an area, that objection holds only for the reach term.

```text
maxChildArea = π · max(R_area_max², Reach_max²)
```

- **`R_area_max`** is closed-form and exact: `C` at its largest step, `r_c·(1+δ)`, plus the parent's organelle area plus `M_max` times the most area one event adds. An insertion adds `π·r_new²`, a radius step `π·((r·(1+δ))² − r²)`, a Split, a position step and a deletion nothing.
- **`Reach_max`** is the parent's reach plus `M_max` times the most one event can add to it. An event that adds `Δd` of diameter or moves an organelle by `d` grows the reach by at most `Δd + d`, the contract of ADR-0028 restated on the reach, and an insertion is bounded by the body it is born in. The per-event constants are read off each type's declared laws, as today, and the milestone's property test is what checks them.

The operator counting of ADR-0034 stands: only operators with a valid target count, and a world with an empty roster prices exactly v0.1's ceiling.

## Considered options

- **Keep the thickness and centre the body on the origin: `R = Reach + t`.** It gets organelles off-centre with less change, and ADR-0034's objection returns in full: an organelle born near the rim grows the body by about `t`, and every parent pays for it.
- **Push every organelle that sticks out back inside, then relax.** It may not converge, since relaxing pushes outwards again, and for an organelle set too dense for `R_area` it never does.
- **Reject the draw or the mutant that does not fit.** It brings back the Birth Sieve (ADR-0027) that the law is built without.
- **Rescale the positions by `R_new/R_old` when the body shrinks.** It undoes a relaxation already done and breaks the contract that holds per event.
- **Have `C` follow the reach down, so the gene is never inert.** It is a second rule that mutates a gene the mutation did not draw.
- **One additive bound on the radius, as in ADR-0034.** It is simpler and wide, where the area term alone is exact.

## Consequences

- **`C` is inert while the reach dominates.** An organelle far out keeps the body wide whatever a mutation does to `C`, and the free cytoplasm exceeds `C`. This is accepted, because it costs: the extra cytoplasm pays body cost and the cap of the stores' area, so selection pulls the organelle in through position steps. The calibration harness reports the fraction of bodies with `Reach > R_area`; a high one reopens this.
- ADR-0034's "inside the Enclosing Circle" and the recentring step are superseded. Its radius floor, its operator counting and the inherited relaxed layout stand.
- `relax` and `makeRoom` keep their moves and their contract. The Enclosing Circle survives in the code as the way the slide move picks its ray, and is no longer the body.
- The caps and concentrations that read the Cytoplasm Area (ADR-0029, ADR-0035) read a quantity that no longer depends on the layout, except through the reach.
- Glossary: **Cytoplasm Radius** replaces **Cytoplasm Thickness**, **Reach** is new, **Enclosing Circle** is retired, **Body Radius** and **Cytoplasm Area** are redefined. `vision.md`'s body construction, insertion and ceiling text follow.
- M7 ships with the Enclosing Circle, and the ticket that implements this changes `layout.ts`, `genome.ts` and `birthCostCeiling`. It comes before the caps work of #68-#71, which reads the Cytoplasm Area.
