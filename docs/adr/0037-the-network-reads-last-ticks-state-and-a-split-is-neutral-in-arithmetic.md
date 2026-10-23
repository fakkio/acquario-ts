# The network reads last tick's state, and a split is neutral in arithmetic, not in floating point

> **Amends [ADR-0031](./0031-the-nervous-system-is-a-ctrnn-wired-through-ports.md) and [ADR-0028](./0028-the-structural-genome-and-its-mutation-law.md).**

ADR-0031 settled the neuron, the ports and the innate senses, and left four things to M11: how a diffusible sense reads a store with no cap (ADR-0035), the ranges and birth values of the neuron's parameters and of a synapse's weight, where the network runs in the tick, and what "a split is exactly neutral" means once it is a test. Settled in the M11 grill.

## A diffusible sense reads `c / (1 + c)`

`food`, `O₂` and `CO₂` each read the store's own internal **Concentration** `c` as `c / (1 + c)`, in `[0, 1)`. It reads 0.5 at `c = ρ = 1`, the concentration the mitosis mass gate needs, so the middle of the sense is the line between a parent that can afford a child and one that cannot. It reads the organism's own state only and has no division to guard. `energy`, `light`, `up` and `tilt` stay as ADR-0031 wrote them.

## The parameters are born inert and stay inside the menu

Every parameter is born at the value where it does nothing surprising, so a new neuron's parameters are mutational capital that costs nothing to hold. Every law is already in the closed menu, so the menu does not widen.

| Gene              | Law                               | Range     | Step | Born at    |
| ----------------- | --------------------------------- | --------- | ---- | ---------- |
| `τ`               | symmetric multiplicative, floor 1 | `≥ 1`     | 0.25 | 1          |
| `bias`            | additive clamped                  | `[−4, 4]` | 0.25 | 0          |
| `threshold`       | additive clamped                  | `[0, 4]`  | 0.25 | 1          |
| `dischargeFactor` | additive clamped                  | `[0, 1]`  | 0.05 | 1          |
| synapse weight    | additive clamped                  | `[−4, 4]` | 0.25 | `u · 0.25` |

- **`τ` is born at 1**, with no memory, and its step is three times the radius's, because a given neuron's `τ` is drawn rarely: one event a birth, then a parameter change, then one organelle, then one parameter of six. At 0.08 a memory of 100 ticks is about 120 consistent steps away; at 0.25, about 40.
- **`bias` and the weight stop at ±4**, where `tanh` is 0.9993 and nothing new happens beyond.
- **`threshold` is born at 1**, where firing needs a signal of about 0.76, so the first mutation of `dischargeFactor` below 1 changes little. Born at 0, it would reset the neuron whenever its memory is positive, half its life, after one small step. Negative thresholds are excluded: a reset of a memory that is already negative pulls it towards 0, which switches the neuron on.
- **A synapse is born at the weight step taken from 0**, `u` signed (ADR-0028), small and of either sign.
- **A synapse pays `c_synapse = c_neuron`**, `0.01 · c₀`. The calibration harness reports what share of a carrier's spending it is; it is a starting value, measured rather than derived.

## Six operators, and ports drawn in a fixed order

The structural events gain `weightChange` and `synapseInsertion`, appended after M7's four so their draw order is unchanged. The rate weights are parameterChange 0.4, weightChange 0.1, insertion 0.2, synapseInsertion 0.2, deletion 0.2, split 0.1. An event with no valid target still does nothing and is not redrawn, and in a world where few bodies carry an input port most synapse events are spent that way: organelle insertion falls from a fifth of events to a sixth. `M_max` stays 1, since no world constant moves before M12. Deletion stays one operator over every gene, so a growing network takes deletions from the organelles; the harness reports it.

A synapse insertion draws its source uniformly over an ordered list of output ports and its destination over an ordered list of input ports. Innovation ids cannot order them, so the order is the body's seven senses in a fixed order (`energy`, `food`, `O₂`, `CO₂`, `light`, `up`, `tilt`), then each organelle in genome order, each with its ports in its type's declaration order. A synapse may duplicate an existing pair: two parallel synapses act as one with their weights summed, and forbidding them would mean rejecting or redrawing a draw.

## The network runs first, on committed state

The network is a new step at the head of phase 2, per organism, before exchange is requested. It reads only what the last tick committed, the stores, the Body Axis and the snapshot's light at the body's centre, and writes only to the organism itself, so it is order-independent like steps 3 to 5. Every neuron computes from the previous tick's signals, every sense reads the previous tick's state, and every thruster's signal is set there, before step 5 charges its Thrust Cost and step 6 moves the body. The latency is one tick, everywhere, and a store changed this tick is seen the next.

A neuron's `memory` and every output's `signal` are physical state, not genes. A child is born with both at 0, and both enter the state hash. A world with an empty roster has no neuron to evaluate and its golden hash does not move.

## A split of a self-synapse becomes four

A Split copies incoming synapses to both pieces and divides outgoing ones `f` and `1 − f`. A self-synapse `A → A` of weight `w` is both: it becomes `A₁ → A₁` and `A₁ → A₂` at `f · w`, `A₂ → A₁` and `A₂ → A₂` at `(1 − f) · w`. Each piece then receives `f · w · s + (1 − f) · w · s = w · s`, what `A` received, so the pieces stay identical and the split stays neutral.

## Neutrality is a property of the arithmetic, and the test says so

In floating point `f · w · s + (1 − f) · w · s` is not `w · s` to the last ulp, a recurrent network can amplify that difference, and an ulp on either side of `memory ≥ threshold` makes one neuron fire a tick before its twin. So M11's invariant is tested on the network alone, with scripted senses: on random networks with `dischargeFactor = 1`, every actuator signal of the split network stays within 1e-9 of the original for 500 ticks; on networks that discharge, the same, with every threshold kept a margin away from the memory it is compared against. Bit-identity is not claimed.

## Considered options

- **`c_int / (c_int + c_ext)`** for a diffusible sense. It reads which way exchange runs and is 0.5 at equilibrium, but it divides by zero when both are 0 and reads the world rather than the body.
- **`min(c, 1)`.** Ambient CO₂ opens above 1, so it would read 1 for every founder.
- **Unclamped additive `bias` and `threshold`.** It widens the menu for a range in which `tanh` has already saturated.
- **`τ` born at 10.** A short memory from birth, but `τ = 1` is the simplest neuron to read and the floor lets mutation only lengthen it.
- **The network after the exchange grants**, reading this tick's stores. Closer to now, and it reads a state that has never been committed.
- **Raising `M_max`** so a wiring can be built in fewer generations. It is a world constant, and those wait for M12.
- **Separate deletion operators for organelles and synapses.** It protects organelles from a growing network, and the risk is reported first.
- **Bit-exact neutrality.** Impossible by construction in floating point.

## Consequences

- `vision.md` § Nervous system, § Mutations, § Organelle costs, § Tick pipeline and M11's row follow.
- M11's harness, `npm run nervous-system`, reports synapse carriers, Reflexes and sense→neuron→thruster chains, neuron radius against `r_min`, the synapses' share of spending, and insertion rates beside M10's.
- Glossary: **Reflex** is new.
