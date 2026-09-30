# The v0.2 roster is four types, and only function or cost gives weight

v0.2 ships four organelle types: the **chloroplast**, the **float**, the **thruster** and the **neuron**. Each one declares only the parameters it uses, so orientation belongs to the thruster alone. A type weighs only when weight is what it does or what it costs, so the neuron and the thruster are weightless like the cytoplasm. Everything else in `vision.md`'s table is deferred with a tentative version. Settled in #49. This amends ADR-0028's common parameters and ADR-0030's default density for "every other type".

## The roster

| Type        | Parameters beyond radius and position                                                                      | Organelle Density | Ports                    | Effect                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| Chloroplast | none                                                                                                       | `ρ_w(H) + Δ/2`    | none                     | `kChloro × light(own position) × 2·r × C_cytoplasm(CO₂)` (ADR-0029)                        |
| Float       | none                                                                                                       | `ρ_w(0) − Δ`      | none                     | lift only                                                                                  |
| Thruster    | `orientation` (wrapping angle, born uniform), `drive` (additive clamped `[0, 1]`, born at `drive_new > 0`) | weightless        | input `power`            | `F_max = kForce × 2·r` at its centre along its orientation, forward only; costs `k_thrust· | F   | `   |
| Neuron      | `τ`, `bias`, `threshold`, `dischargeFactor` (ADR-0031)                                                     | weightless        | input `in`, output `out` | CTRNN                                                                                      |

`Δ = ρ_w(H) − ρ_w(0)` is the water's span. Writing both densities in units of it leaves the milestone only `Δ` and `g` to calibrate.

## Orientation is declared, not common

ADR-0028 gave every organelle an orientation. A chloroplast is a disc that reads light where it sits, and its projected width `2r` is the same at any angle. The same holds for the float and the neuron. An orientation gene on them would do nothing, but it would still take its share of the bounded structural events a birth draws (ADR-0028), drift at random, and be inherited by every future type whether it used one or not.

So orientation is one more parameter a type declares when it needs one, with the wrapping-angle law. In v0.2 only the thruster declares it. The body's rotation is physical state, not a gene: it turns every organelle together, so positions matter for every type anyway.

## Weight comes from function or cost

ADR-0030 let every type other than the chloroplast and the float take a density inside the water's range. A neuron with such a density would move its carrier's resting depth. If it is lighter than the water around the body, it moves the body towards the light and selection keeps it as a small float. If it is heavier, selection drops it as ballast. Either way the network would be selected for its buoyancy before it is ever wired, and a neuron's insertion would lose the exact neutrality that is v0.2's only protection for new structure (#45, ADR-0031). A thruster would be selected for what it weighs rather than for how it pushes.

The rule instead: **a type weighs only when weight is what it does or what it costs.**

- **The float**: weight is its function.
- **The chloroplast**: weight is the price of photosynthesis.
- **The thruster and the neuron**: protein machinery, water inside the membrane like the cytoplasm. They add no Buoyant Weight and no torque at any depth, and they are left out of the mean density a body rests at.

The rule extends to later types. The carapace (v0.3) can weigh as the price of defence, the eye stays weightless, and a storage vesicle could act as ballast through the food it holds.

With `ρ_chloro = ρ_w(H) + Δ/2` and `ρ_float = ρ_w(0) − Δ`, ADR-0030's constraints hold: a chloroplast alone sinks to the floor, and a float lifts more than its own area of chloroplast weighs. A body rests inside the column when chloroplasts make up 40–80% of its weighing area. It rests in the Bright Zone, the column's top quarter, only when chloroplasts are at most about half of it, so it needs about as much float area as chloroplast area. That is how "photosynthesis costs lift" reads in numbers.

It also orders the route. A chloroplast inserted alone takes its carrier to the floor, where it cannot breed. A float inserted alone already pays, because it gathers a minimal organism, which otherwise wanders the whole column, towards the light. The expected path is float first, then chloroplast.

## The thruster

- **Force scales with radius**, like every type whose output is a rate (ADR-0029). A Split copies `drive` and every incoming synapse to both pieces, and each piece's force follows its own radius. Total force can grow by up to ×1.41, and total thrust cost with it. The split is not neutral, as for the chloroplast. The two pieces can later diverge in orientation and wiring, so a split also buys control, and nobody writes that in.
- **Orientation is free** of position. A radial thruster pushes the body straight, and a tangential one near the rim both turns and moves it. Pure rotation needs a pair of opposed thrusters. A newly inserted thruster's angle is drawn uniformly, as its position is.
- **Position has no law of its own.** It matters through the lever arm: near the rim a thruster steers, near the centre it pushes straight.
- **`drive` is born small but not zero.** At 0 an unwired thruster would be pure cost until a second event moved it, which is the two-event insertion valley ADR-0031 exists to avoid.

## Costs

`β_type = β` for every type in v0.2. Nothing so far argues for a tissue that costs more or less than cytoplasm, and an organelle's area already costs storage because it holds no stores.

`r* = c/k` needs an output measured in energy. Only the chloroplast has one. Lift and thrust have no closed-form break-even. So the chloroplast, the float and the thruster share one overhead, `c_organelle`, derived from the chloroplast's `r_new ≈ r*/2` rule. The neuron and the synapse keep their own small overheads (ADR-0029).

## Deferred

| Type                       | Tentative version | Why                                                                                                                                                              |
| -------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eye, and sensor organelles | v0.3              | Nothing is worth seeing until there is something to eat (ADR-0031).                                                                                              |
| Teeth / Spines, Carapace   | v0.3              | Predation.                                                                                                                                                       |
| Lung / Gill                | v0.4              | A chloroplast is already worth up to +50% at the surface and ×6 in the dark, and linear income stays unbroken while everything else is calibrated (ADR-0029).    |
| Vesicle (storage)          | v0.4              | With well-mixed pools and constant light there is nothing to buffer against. Patchy fluid fields give storage a use, and a shared internal volume comes with it. |
| Gonad, Uterus              | v0.5              | Sexual reproduction.                                                                                                                                             |

## Considered options

- **Orientation common to every type** (ADR-0028). An inert gene on three of the four types.
- **Every other type's density inside the water's range** (ADR-0030). It selects networks and thrusters for their buoyancy.
- **Accepting that the float is always first.** That orders the chloroplast, but it does not stop a weighing neuron from being selected as a float.
- **Force proportional to area.** A split would be exactly neutral, but the thruster would be the only active type with no size/number trade-off, and the overhead would always favour one giant thruster.
- **A thruster that works better near the membrane.** Physically sound, since a flagellum anchors there. But distance to the membrane depends on the other organelles, because the outermost ones set the enclosing circle. A chloroplast inserted further out would weaken a thruster that never changed. The lever arm already gives position a meaning. Kept in `docs/ideas.md`.
- **A float whose density a signal regulates, with its density as an output.** A second actuator. Free, it makes holding depth free and takes the thruster's vertical role. Priced, it needs a cost law of its own. Kept in `docs/ideas.md`.
- **The chloroplast's fixation rate as an output port.** Nearly the same information as the `light` and `CO₂` innate senses. Every chloroplast, and every split of one, would add a source to the uniform synapse draw and dilute the body's senses. Kept in `docs/ideas.md`.
- **Walsby's collapse depth for the float.** There is no pressure law for it to act on. Kept in `docs/ideas.md`.
- **A gill in v0.2.** The chloroplast is not weak enough to need one.
- **A storage vesicle in v0.2.** Nothing to store against.
- **`drive` born at 0.** Reopens the two-event insertion valley.

## Consequences

- ADR-0028's "common parameters" become radius and position. Orientation is declared per type.
- ADR-0030's "every other type starts neutral, inside the water's range" becomes "every other type is weightless unless weight is its function or its cost". The resting depth and the restoring stiffness are sums over weighing organelles only.
- The insertion operator draws its type uniformly over the roster the current milestone has shipped.
- #50 inherits four types to draw, one of them oriented and two weightless.
- #51 inherits an expected route, float then chloroplast, worth checking as an observable.
- #52 places the four types in milestones. The float ships no later than the chloroplast, and gravity enters with the first of them (ADR-0030).
- Glossary: **Roster**, **Chloroplast**, **Float**, **Thruster**; **Organelle Density**, **Buoyant Weight** and **Organelle Gene** amended.
