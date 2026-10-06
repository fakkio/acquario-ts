# Only the energy store has a hard cap

No reaction is throttled by the headroom of a food, O₂ or CO₂ store any more. Photosynthesis is limited by the CO₂ it has. Respiration is limited by the food and O₂ it has and by the energy store's headroom. Passive exchange already reads concentrations and already let a store exceed its cap. It is now the only thing that brings a full diffusible store back down, and the further a store is over the ambient level, the faster it vents. Energy keeps a hard cap, because nothing but maintenance drains it. This amends ADR-0003 and ADR-0022 and narrows `vision.md`'s "throttle, never spill" to the one store it still governs. Settled in the M7.5 grill (#67).

## Why

The CO₂ cap was binding in cases the design never meant it to. #65's inspector showed an organism with food at 50% of its cap and O₂ at 55%, respiring 0.013 per tick against a mass-action rate near 2. Its CO₂ store sat at 100%, so respiration could only produce as much CO₂ as exchange and photosynthesis removed. A full store can vent no faster than the gradient `1 − C_ext` allows, about 0.2 at that ambient level. The organism was starving with fuel in store.

At tick 0 every founder is worse off. Ambient CO₂ opens at about 1.04, above `kCap(CO₂) = 1`. Every store starts at the ambient concentration, so every CO₂ store starts over its cap, and no founder respires until photosynthesis draws its CO₂ below 1. Below the Bright Zone, exchange holds it above 1 for as long as the ambient level stays there, and respiration never starts. This is the noise #35 recorded in `α`.

ADR-0003 described the cap as a maximum internal concentration that "only binds when the world is richer than kCap". The world opens richer than that in CO₂, and respiration makes every organism richer inside than outside. So the case ADR-0003 treated as an edge is the normal one.

"Throttle, never spill" was written to protect conservation, since spilling a product past its cap would destroy it. There is a third option that the rule did not name: the store simply holds more. That conserves exactly, and passive exchange corrects the excess on its own.

## Which stores

The line is drawn by what drains a store, not by whether it is a gas. All three diffusibles cross the membrane under one law, so all three soften, food included.

Food's `kCap = 1.5` was raised so that a parent could reach the mass gate (ADR-0022). The gate is a floor on the food store, and removing the ceiling leaves the floor reachable. The ceiling was a liability, too. Food's cap is taken over the Cytoplasm Area and a child's mass cost over its whole body area. Given enough organelle area, `kCap(food)·cytoplasmArea` falls below `ρ·maxChildArea`, and a carrier can never breed.

Energy is a tank: it has no exchange and no ambient level, and only maintenance drains it. Without the throttle a sated organism would burn food with nowhere to put the result, and `mitosisEnergyThreshold` is read as a fraction of the energy cap.

## No cap is left for a diffusible

A cap that no reaction respects is not a cap. Keeping one as a "soft cap" or a reference level would leave a number in the world that no law reads, and it would invite the throttle back. For CO₂ and O₂, the level at which concentration is 1 is the Cytoplasm Area itself, so there is nothing to keep. Food's `1.5` would turn into an arbitrary 100%. `K_CAP` for food, O₂ and CO₂ is deleted, and **Cap** means the energy store's alone. Inspector and HUD read a diffusible store as its internal concentration next to the ambient one, which is the comparison that decides which way exchange runs.

Mitosis clips a child's allocation at the child's own cap, and the excess stays with the parent. That clip now applies to energy only. Food, O₂ and CO₂ are handed over at `childAllocationRatio` in full. A child smaller than its parent can be born at a higher concentration than the water, and it vents the difference. That adds a selective pressure the clip used to hide: a parent that gives more than its child can keep loses the excess to the shared pool.

## Considered options

- **Soften CO₂ and O₂ only, keeping food hard for the mass gate.** The criterion that softens the gases is that exchange already reads concentrations and already exceeds the cap, and it applies to food word for word. The mass gate needs a floor, not a ceiling.
- **Soften CO₂ only.** O₂ is the same kind of store with the same exchange law. Photosynthesis in bright light fills it while respiration is energy-throttled, and the same wall would appear on the other side of the cycle.
- **Raise `kDiffusion` so a full store vents faster.** It sets the reproductive period (ADR-0022) and stays out of every sweep.
- **A pressure or saturation compartment.** With equal solubility, partial pressure is equivalent to the concentration gradient the exchange law already uses, and a saturation compartment would be a new carbon compartment needing a ledger of its own. It may come back with M8's float or with v0.4's fluid fields.

## Consequences

- The loop is bounded without a rule. Photosynthesis and respiration conserve an organism's internal carbon (food + CO₂) and its internal oxygen (O₂ + CO₂). Diffusion relaxes each sum towards its ambient total (ADR-0022's relaxation, which never read a cap). So no store can settle above the ambient total of its ledger.
- The CO₂ ↔ photosynthesis feedback is accepted as physics. Respiration now leaves more CO₂ in store, and photosynthesis is mass action on it, so an organism in the light fixes more. The harness reports each diffusible's highest internal concentration, and no gate asserts a bound. A store that grows without settling is a finding, and saturating kinetics (`vision.md`) would be the response to it, not a precaution taken beforehand.
- ADR-0015's exclusion of organisms throttled by a full energy store is unchanged. It was always about the energy store.
- `α` moves. M7.5 measures it before and after and gates on persistence. `c₀` is not re-solved until M12, which re-solves it for every mass-side move anyway. If persistence fails, nothing pre-registered moves, because every candidate lever is a constant that belongs to M12. The failure goes to a grill.
- The empty-roster world can no longer match M6's state hash, so the golden value is re-recorded on M7.5's world, and every later law change re-records it deliberately.
- ADR-0003's consequence that the cap "only binds when the world is richer than kCap" is withdrawn. ADR-0022's per-resource `K_CAP`, and its sentence that food gets a coefficient above `ρ`, describe a cap no reaction reads any more. ADR-0025's fallback "waits" behind a full O₂ store, but the fallback was declined, so the change touches nothing live.
