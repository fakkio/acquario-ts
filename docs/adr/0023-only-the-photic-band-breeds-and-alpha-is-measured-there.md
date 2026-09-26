# Only the photic band breeds, and `α` is measured there

In v0.1 reproduction happens in the light and nowhere else. The dark is not a sink organisms go to die in: it is a habitat where **large** bodies survive indefinitely and no lineage persists, because nothing there can build a child. Since selection acts only through reproduction, `c₀` is solved against the `α` measured over the **photic band** — a depth range fixed in advance by a light threshold — rather than against the population mean ADR-0015 currently ships.

## Why the dark cannot breed

ADR-0022 establishes that an organism's total internal carbon relaxes to the ambient `s` regardless of depth. Light does not change how much carbon an organism can hold. It changes **which chemical form it is held in**, and that is the whole difference:

```text
respiration:     food → CO₂     runs everywhere
photosynthesis:  CO₂ → food     runs only in the light
```

In the dark, respiration steadily converts internal food into internal CO₂ and nothing converts it back. Internal carbon still climbs to `s`, but it arrives as CO₂. Mitosis's mass cost is drawn from **food**, so a dark organism can be full of carbon and still unable to afford a child — it is holding the right amount in the wrong form.

This is the sharpest statement of what photosynthesis is for in this model. It produces no energy (`vision.md`: "Carbon fixation, not energy production"). What it produces is _matter in the form a body is built from_, and that is why the light is where lineages live.

## Why the dark is still a habitat

Survival is a pure energy balance, and energy comes only from respiration, whose substrate in the dark arrives entirely by diffusion. That income is linear in `r` for every radius above `2·kDiffusion/(kResp·C_O₂)`, which is about `0.02` baseline radii — so for every organism that will ever exist:

```text
α_dark = 2π · RESPIRATION_ENERGY_YIELD · kDiffusion · s_food
survival at radius r   ⟺   α_dark·r ≥ c₀ + β·r²
a viable radius exists ⟺   α_dark ≥ 2√(β·c₀)
```

A downward parabola, so the dark admits a **band** of radii, not a ceiling. Small bodies fail on the flat `c₀`; large bodies fail on `β·r²`; the band centres on `α_dark/(2β)`, which is large. The prediction is a two-morphology world: small fast breeders in the light, rare large bodies in the dark.

At M2's constants `α_dark ≈ 1.25` against `2√(β·c₀) = 2.0`, so the band is **empty** and nothing can survive the dark at any radius. That is exactly what #31's run showed, and it is the first thing M5's harness should confirm or refute.

## Why `α` moves to the band

ADR-0015 ships `α` as a population mean and already warned that "a population mean over a vertical gradient is an average of two different ecologies". Under this decision that stops being a reporting nicety. `c₀ = α·r_opt/2` is the constant that decides where `bodyRadius` converges, convergence is produced by reproduction, and reproduction happens only in the light. A mean that includes organisms which will never contribute a birth predicts `r_opt` for a depth no lineage occupies.

The band is fixed **in advance**, at `y ≤ 10` baseline radii — where light is at least a tenth of its surface value, which is already what `vision.md` calls the photic zone and what `LIGHT_ATTENUATION_K` was chosen to produce. Deriving the band from where breeding turned out to happen would reintroduce precisely the circularity ADR-0015 spent a section eliminating.

ADR-0015's anti-circularity argument is otherwise untouched: `α` is still measured in the **fixed population** (mortality and fertility both off), where nothing can select, and the prediction is still fixed before the world that tests it exists. Only the set the mean is taken over has changed.

## Considered options

**Keep the population mean.** No code changes, and it predicts an optimum for an idealised organism at a depth where nothing ever breeds. It is the "declare `α` nominally" option ADR-0015 already rejected, arriving by a different route.

**Measure `α` over the organisms that actually bred.** Directly circular: breeders are selected, so the measurement would carry the fitness it is supposed to predict.

**Make an `r_opt`-sized organism survive the dark.** Worked through, the condition reduces to `α_dark ≥ α_photosynthetic + 3β` at `r_opt = 1.5` — diffusive income must _exceed_ photosynthetic income, because `c₀` is calibrated against the light's total. Achieving it means deliberately demoting photosynthesis to a minor channel, which inverts what the light gradient is in the world for.

**Expose `α` as an array of depth bins,** per ADR-0015's original CSV consequence. Rejected with the CSV itself (ADR-0024): it allocates an array every tick for a reader that no longer exists. The world exposes two scalars instead — the whole-population mean, unchanged, and the photic-band mean — computed by the same fold with one more predicate, next to the energy-throttle predicate it already carries.

## Consequences

- One new glossary term, **Photic Band**: the light-threshold depth range `α` is measured over, distinct from **Photic Zone**, which stays the informal ecological region.
- The photic-band threshold becomes a world constant, read by both the `α` fold and the HUD, and fixed before any calibration run.
- ADR-0015 is amended twice: the calibration input is the photic-band mean rather than the population mean, and the consequence that "M5's CSV export carries `α` binned by depth" is withdrawn along with the CSV.
- The HUD shows both readings, so the gap between the two ecologies is visible while a run is watched rather than only in a report.
- `vision.md`'s "two viable strategies from a single genome" passage is wrong as written and is corrected: the dark strategy is survival, not persistence.
- **v0.2's eating is what reopens the dark.** Predation and scavenging give a dark organism a route to food that is already food, which is the one thing diffusion and its own metabolism cannot hand it. Until then, a photic-only breeding regime is a property of the world and not a defect in it.
- If the harness reports the dark band empty even at high `RESPIRATION_ENERGY_YIELD`, that is a finding to record and decide on, not a number to tune around.
