# The nervous system is a CTRNN wired through ports

v0.2's neuron is a non-spiking leaky integrator with `vision.md`'s input-scaling bug fixed. Integrate-and-fire is kept only as a superset that a newborn neuron has switched off. Every organelle type declares named input and output **Ports**, and a synapse joins an output port to an input port. The body itself is an endpoint whose output ports are the **Innate Senses**. v0.2 has no sensor organelles, and the thruster is its only **Actuator**. Settled in #48. This amends ADR-0028's reserved ids.

## The neuron

```text
inputSum = bias + Σ (weightᵢ × previousSignal(sourceᵢ))
memory  ← decay · memory + (1 − decay) · inputSum          decay = 1 − 1/τ
signal   = tanh(memory)
if memory ≥ threshold: memory ← memory × dischargeFactor
```

- **The input is scaled by `(1 − decay)`.** Without that factor, steady-state gain is `1/(1−decay)`, and a small mutation of `decay` near 1 multiplies it: 0.95 → 0.99 is 20× → 100× (#45, [findings](../research/evolved-recurrent-networks.md)). With the convex form, a constant input `u` settles at `u` whatever the memory length, so time constant and gain are no longer entangled.
- **The time constant is a gene `τ ≥ 1`** in ticks, symmetric multiplicative and floored at 1, the way `bodyRadius` mutates. `τ = 1` is a neuron with no memory, and the gene cannot reach the unstable region `decay ≥ 1`. That law, "symmetric multiplicative with a floor", widens ADR-0028's closed menu by one entry.
- **Integrate-and-fire is a superset, not the model.** `threshold` is additive. `dischargeFactor` is additive, clamped to `[0, 1]`, and a new neuron is born with it at 1, where firing does nothing and the neuron is exactly a CTRNN. As `dischargeFactor` falls, the reset strengthens continuously from a small dip to a full discharge. Every configuration between "always on" and "accumulate, fire, reset" is therefore reachable in small steps, from one neuron. A latch needs no discharge at all: a self-synapse of weight above 1 on `tanh` is bistable.
- **`tanh` is the only activation in v0.2**, with signals in `[−1, 1]`. It makes bias 0 the centre-crossing point, where a new neuron is born away from saturation. It also needs no categorical gene, which the law menu has no entry for. Functions added later must share `tanh`'s value 0 and slope 1 at zero (`sin`, a clamped identity), so that switching between them stays near-neutral. `sigmoid` and `step` do not qualify.
- **A neuron's size and position mean nothing** beyond cost, space and layout. Tying gain or `τ` to radius, a capacitance reading that would give `τ ∝ r` in 2D, would make a Split change both pieces and lose its exact neutrality, which is v0.2's only protection for new structure (#42, #45). So cost pressure alone acts on a neuron's radius, and neurons are expected to shrink towards the milestone's minimum.
- Neurons pay `c_neuron + β_neuron·a` and no activity cost (ADR-0029).

## Ports

Every organelle type declares a fixed, named list of **input ports** and **output ports**, as it declares its parameters. A synapse endpoint is `(id, port)`. A port is not a synapse: one input port takes any number of synapses, and one output port feeds any number of them.

- **An input port always receives the weighted sum** of its synapses' signals from the previous tick. What the organelle does with each port's sum is the type's own: a neuron integrates it, a thruster adds it to its drive. Non-additive aggregation, if ever wanted, is a neuron type, not a second meaning of "synapse".
- **An output port carries one signal per tick**, computed by the organelle.
- **Sources are output ports, destinations are input ports.** Self-synapses are allowed, and so is a synapse straight from a sense to an actuator, a reflex with no neuron in between. Synapse insertion draws its source uniformly among all output ports and its destination uniformly among all input ports, so no event is spent on a pair that cannot exist.
- **A Split works port by port.** Incoming synapses are copied to both pieces and outgoing ones divided `f`/`1−f`. For a neuron, both pieces see the same inputs with the same parameters, so they fire together and the divided outputs sum to the original: still exactly neutral, integrate-and-fire included.
- In v0.2 the neuron has one input port and one output port, the thruster has one input port, and the chloroplast and float have none.

## The body is an endpoint

ADR-0028 reserved one fixed id per innate sense. Instead, the **body** gets one reserved id outside the innovation counter's range and is an endpoint like any organelle, with output ports only. Its output ports are the **Innate Senses**, the passive version of what a sensor organelle would improve:

| Port                          | Signal                                                |
| ----------------------------- | ----------------------------------------------------- |
| `energy`, `food`, `O₂`, `CO₂` | the store over its cap, `[0, 1]`                      |
| `light`                       | light at the body's centre, `[0, 1]`                  |
| `up`                          | `cos θ`, how far the body's axis points up, `[−1, 1]` |
| `tilt`                        | `sin θ`, which way it leans, `[−1, 1]`                |

`θ` is the angle between the body's axis (the genome frame's) and the vertical. Two channels are needed because `sin θ` alone cannot tell up from down. In an empty genome the body's senses are the only sources, so a first synapse always reads the world.

Left out, each for a reason:

- **depth**: light depends on depth alone, so it is the same signal;
- **velocity**: the body's own thrust plus Brownian motion;
- **age** and **clock**: they read nothing of the world;
- **noise**: Brownian motion and light already perturb the network, and a sense that draws from the organism's stream only when wired would complicate the draw contract.

## The actuator

The thruster is v0.2's only actuator, and each type declares whether it is one. Its signal is `clamp(drive + Σ, 0, 1)` and its force is that signal times its maximum force. It pushes forward only, so moving backwards takes a second thruster facing the other way. **A thruster with no incoming synapse runs at its `drive`**, a flagellum at constant thrust. In a bottom-heavy body, one pointed up already lifts its carrier with no neurons (ADR-0030), so the insertion valley is one event, not two. `drive` and the maximum force are parameters the roster fixes (#49). `drive` is born near 0, because thrust costs `k_thrust·|F|` (ADR-0029).

## Considered options

- **CTRNN only, dropping threshold and discharge.** Leaner, and what the evolved-agent literature favours. Rejected because "accumulate, fire, reset" then needs two neurons and three or four synapses, where the superset gives it to one neuron at the price of two genes that are inert at birth.
- **Integrate-and-fire as the model** (`vision.md`'s original). Without noise it locks into oscillations (Floreano), and a newborn neuron would not be neutral.
- **`decay` as the gene**, additive in `[0, 1)`. A fixed step near 1 doubles the memory length.
- **`vision.md`'s activation set** (`tanh`, `sigmoid`, `sin`, `step`). A categorical gene for oscillators that recurrence already gives, and a non-neutral switch between `tanh` and `sigmoid` or `step`.
- **Size as gain, or size as time constant.** Both break the Split's neutrality.
- **Sensor organelles in v0.2.** Their natural improvement is the eye, which is v0.3.
- **One reserved id per sense.** It works, but it makes the senses a special case beside organelles, where ports make the body just another endpoint.
- **One port a side for every type.** Enough for v0.2, but an eye's colour channels or a thruster steered as well as powered would reopen the synapse's shape.
- **An unconnected thruster that stays off.** It is pure cost until a second event wires it.

## Consequences

- `vision.md` § Nervous system is rewritten, and ADR-0028's reserved-ids sentence reads "one reserved id, the body's".
- ADR-0028's law menu gains "symmetric multiplicative with a floor".
- #49 declares ports and `drive` for the thruster, and ports for every other type it ships (none for the chloroplast and float as they stand).
- #50 inherits neurons that shrink, and a network whose endpoints are ports.
- Glossary: **Neuron**, **Synapse**, **Signal**, **Port**, **Innate Sense**, **Actuator**, **Drive**; **Organelle** and **Synapse Gene** amended.
