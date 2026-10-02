# Small evolved recurrent networks: neuron models and topology operators

Research for issue #45 (child of the v0.2 map, #39). It feeds the nervous-system ticket. The design under review is `docs/vision.md` § Nervous system: sparse recurrent networks, a synchronous update, leaky integrate-and-fire neurons with an evolvable activation, NEAT-style innovation ids, and no learning within a lifetime. Transcendental activations are allowed (map #39, standing constraints), so cross-engine bit-identity is out of scope.

Every claim cites the source that owns it. Anything marked **(inference)** is this note's own reasoning from those sources, applied to AcquarioTS, and is not a claim made by the source.

## Answer in brief

1. **Keep the leaky integrator, but fix its input scaling.** Beer's reference CTRNN code (and Framsticks' `N` neuron) moves the state _toward_ the input: `state += k·(input − state)`, where `k = dt/τ`. In `vision.md`, the input is added unscaled (`memory = decay·memory + inputSum`), so the steady-state gain is `1/(1−decay)`. A mutation of `decay` from 0.95 to 0.99 raises that gain from 20 to 100, which breaks the "mutations must be resilient" goal. Use the convex form `memory = decay·memory + (1−decay)·inputSum`, and consider evolving `τ ≥ 1` multiplicatively, the way ADR-0021 evolves `bodyRadius`.
2. **Saturation, not topology, dominates what random small networks do.** In CTRNN parameter space, the chance that every neuron is dynamically active shrinks exponentially with N (Beer 2006). Seeding with _center-crossing_ biases (each neuron's bias puts its activation over the middle of its input range) makes rich dynamics far more likely. For example, 26.6% of center-crossing 5-neuron circuits oscillate, against 1.2% of random ones (Mathayomchan & Beer 2002). New neurons should be born near their center-crossing point.
3. **Most of NEAT's machinery exists for crossover and speciation, and v0.2 has neither.** Innovation numbers exist to align genes for crossover and to measure compatibility for speciation (Stanley & Miikkulainen 2002 §3.2, §5.7). Mutation-only NEAT still works (5,557 evaluations against 3,600 with mating). Without speciation, though, "no structural innovations can survive" unless new structure is given another form of protection. In AcquarioTS that protection has to come from new structure being born cheap and near-neutral, which `vision.md` already intends.
4. **NEAT's add-node split is only near-neutral, and less so under a synchronous update.** NEAT gives the new in-link weight 1 and the new out-link the old weight "to minimize the initial effect". In a synchronous recurrent network the split also adds one tick of latency. With a logistic activation, no inserted unit can act as an identity (Net2Net §2.4). Duplication can be made exactly function-preserving by halving the outgoing weights (Net2Net §2.3).
5. **Rates in the literature are per genome, per reproduction:** NEAT uses add-node 0.03, add-link 0.05 (0.3 in large populations), and an 80% chance of weight mutation, of which 90% are perturbations and 10% replacements. neat-python's example config uses 0.2 for add/delete node, 0.5 for add/delete connection and 0.8 for weight mutation. All are tuned for speciated generational GAs of 150 to 1,000 individuals, so none carries over unchanged.
6. **Activation sets differ widely between systems.** NEAT uses one steepened sigmoid, Beer uses the logistic with an evolvable gain, neat-python offers 18 functions, and The Bibites has 12 node types, including stateful ones (latch, differential, integrator). Framsticks keeps one squashing neuron with an evolvable steepness and provides special behaviours (threshold, sine, delay, noise, derivative) as separate neuron _classes_.
7. **Innate senses are plain input neurons, normalised to about [0, 1] or [−1, 1].** In Polyworld these are health-energy and a random value, in Framsticks energy/initial-energy, a tilt gyroscope, water depth and touch, and in The Bibites EnergyRatio, Fullness, Maturity, Speed and clocks. Framsticks attaches sensors to body parts as neurons, which is the closest precedent for `vision.md`'s "single network" of organelles and neurons.
8. **Cost is O(neurons + synapses) per organism per tick with one synchronous pass,** as in Polyworld. Measured here: 1,000 organisms × 32 neurons × 128 synapses costs about 1.2–1.3 ms per tick with flat typed arrays and transcendental activations, and about 2.1–2.4 ms with per-organism JS objects, against a 16.7 ms tick budget.

## 1. Neuron models

### 1.1 CTRNNs (Beer)

The standard CTRNN neuron is `τᵢ·dyᵢ/dt = −yᵢ + Σⱼ wⱼᵢ·σ(gⱼ(yⱼ + θⱼ)) + Iᵢ` with the logistic `σ(x) = 1/(1+e⁻ˣ)` ([Beer 1996, §3][beer1996]; [Mathayomchan & Beer 2002, eq. 2.1][mb2002]).

Beer's own reference implementation integrates it by forward Euler as follows ([`CTRNN.cpp`, `EulerStep`][beer-ctrnn-cpp]):

```text
input     = externalinput[i] + Σⱼ weight[j][i] · output[j]
state[i] += stepsize · (1/τᵢ) · (input − state[i])
output[i] = σ(gain[i] · (state[i] + bias[i]))
```

The state update happens for all neurons before any output update, so the scheme is synchronous: every neuron reads the previous step's outputs.

**Parameter ranges used in Beer's evolved agents:**

- Beer 1996: biases in [−5, 5], time constants in [1, 2], weights in [−5, 5], forward Euler with step 0.1, states initialised to 0 ([Beer 1996, §3][beer1996]).
- Mathayomchan & Beer 2002: weights and biases in ±16, time constants in [0.5, 10], Euler step 0.1 ([§3][mb2002]).
- Beer 2006 samples the same ±16 / [0.5, 10] box ([Fig. 11 caption][beer2006]).

With step 0.1 and τ ≥ 0.5, the per-step factor `k = dt/τ` never exceeds 0.2.

**Mapping to `vision.md` (inference).** The Euler step is `y ← (1−k)·y + k·input`. So `decay = 1 − dt/τ`, and the input term carries the factor `k = 1−decay`. `vision.md`'s `memory = decay·memory + inputSum` omits that factor, which has three consequences:

- The fixed point for a constant input `u` is `u/(1−decay)` instead of `u`. Time constant and gain are entangled: lengthening a neuron's memory also amplifies it.
- Near `decay → 1`, a small additive mutation of `decay` produces a large jump in gain, which is the opposite of `vision.md` § Mutations → Goal.
- `decay` must still be kept in `[0, 1)`. At `≥ 1` the integrator diverges, and at `< 0` it flips sign every tick.

A parameterisation consistent with ADR-0021 is a gene `τ` (in ticks, `τ ≥ 1`), mutated multiplicatively and symmetrically in log space, with `decay = 1 − 1/τ`. Then `τ = 1` means "no memory" (`decay = 0`), and the gene can never reach the unstable region.

**Beer's framework has a gain gene.** `σ(g·(y + θ))` has an evolvable gain `g` ([Beer 1996][beer1996]; [`CTRNN.h`][beer-ctrnn-h]). Framsticks exposes the same knob as the `N` neuron's "sigmoid" parameter ([Framsticks, Brain simulation][fram-brain]). `vision.md` has no gain; its weights can partly stand in for one, but a per-neuron gain lets one mutation sharpen a neuron towards step-like behaviour without touching every incoming weight **(inference)**.

**What a single self-connection can already do.** For a one-neuron CTRNN with a self-weight `w`, only stable equilibria exist when `w < 4`. When `w > 4`, bistability becomes possible, because σ′ ≤ 1/4 ([Beer 1995, §2.1][beer1995]). Driven by input, such a neuron shows hysteresis, which is a memory latch ([Beer 1995, Fig. 10][beer1995]). The general condition is `w · max f′ > 1`, so the threshold is `w > 1` for `tanh`, whose slope at 0 is 1 **(inference)**. A latch therefore needs no threshold/discharge mechanism, only a self-synapse, which NEAT's add-connection can produce.

**Richness of small circuits.** In a three-neuron CTRNN, varying a single time constant produces periodic, doubly periodic and chaotic dynamics. Three neurons is the smallest autonomous CTRNN that can be chaotic ([Beer 1995, §4][beer1995]).

### 1.2 Saturation and center-crossing

"Unless a neuron's bias is properly tuned to the range of inputs it receives, that neuron will simply saturate on or off and drop out of the dynamics" ([Mathayomchan & Beer 2002, §2][mb2002]). The center-crossing bias is `θᵢ* = −Σⱼ wⱼᵢ / 2` for logistic outputs in [0, 1] (eq. 2.2; the same formula is in `CTRNN::SetCenterCrossing` in [`CTRNN.cpp`][beer-ctrnn-cpp]).

Mathayomchan & Beer 2002 report the effect of seeding with center-crossing networks:

- Seeding the initial population with center-crossing networks "significantly improves both the frequency and the speed" of evolving high-fitness oscillators. The effect is "especially striking at low mutation variances".
- 26.6% of random center-crossing 5-neuron circuits oscillated, against 1.2% of fully random ones (§4).

Beer 2006 extends this across network sizes:

- As N grows, "the probability of finding circuits with saturated subcircuits exponentially overwhelms the probability of finding circuits in which all neurons are dynamically active". Biased sampling (center-crossing) or activity-dependent regulation counteracts this ([Beer 2006, §7][beer2006]).
- Circuits with some neurons saturated are not useless. "It can be much easier to evolve 17-dimensional dynamics in a 23-neuron circuit than in a 17-neuron circuit" (§7).

**For AcquarioTS (inference).**

- A newly inserted neuron should be born with a bias at or near its center-crossing value for its current inputs.
- A zero-centred activation (`tanh`, `sin`) makes bias ≈ 0 the center-crossing point whenever its inputs are roughly symmetric, which simplifies the rule.
- A `sigmoid` neuron with the default bias 0 sits at output 0.5, not at the middle of the range of inputs it actually receives.

### 1.3 Integrate-and-fire in evolved agents

- **Floreano & Mattiussi 2001** evolved spiking controllers (Gerstner's Spike Response Model) for a real vision-based robot. The genome encoded only each neuron's sign and a connectivity bit per potential connection (`l = n(1+n+s)` bits). Neural time was discretised into 1 ms steps, sensors were read every 100 ms, and motor commands were the motor neurons' firing rate over 20 ms. Without noise on the refractory function, "the networks go very quickly into locked oscillations for a very large number of connectivity patterns". A sigmoid network with the same encoding, with all weights fixed at 1, did not improve over 40 generations, whether it was updated once or 100 times per 100 ms ([Floreano & Mattiussi 2001, §§2–4 and footnote 4][floreano2001]). That comparison is confounded, since the sigmoid networks had no evolvable weights, biases or time constants.
- **Candadai Vasu & Izquierdo 2017** evolved Izhikevich spiking interneurons for Beer's categorical-perception task: forward Euler with step 0.1, weights in [−50, 50], and Gaussian vector mutation with σ² = 0.5. They read the motors from a _moving average_ of each spiking neuron's output ([§2.2–2.3][candadai2017]).

**For AcquarioTS (inference).**

- Both precedents turn spikes into a rate before driving an effector. In `vision.md`'s model, a downstream neuron with `decay > 0` does exactly that smoothing, so threshold/discharge neurons can coexist with continuous effectors without extra machinery.
- Both precedents also ran many neural sub-steps per sensory-motor step. `vision.md` evaluates one pass per tick, so any pulse lasts at least one full tick at 60 Hz.
- Floreano's locked-oscillation finding argues for an internal noise source, such as Polyworld's and Framsticks' random input neuron (see §4).
- The threshold/discharge pair is the least-precedented part of the design among evolved _agents_. The mainstream evolved-agent neuron is the non-spiking leaky integrator (CTRNN).

### 1.4 Framsticks' `N` neuron (a second-order integrator)

Framsticks documents the following update for its standard neuron ([Framsticks, Brain simulation][fram-brain]):

```text
velocity = force·(input − state) + inertia·velocity
state   += velocity             (clamped to ±10)
output   = 2/(1 + e^(−state·sigmo)) − 1      (−1..1)
```

The parameters are force (range 0..1, default 0.04), inertia (range 0..1, default 0.8) and sigmoid (any real, default 2.0). The state again moves _toward_ the input, as in Beer's form. Framsticks notes that "values [of inertia] near the maximum (1.0) can result in oscillations of the neuron state" and that a strong signal saturates the neuron so that "later signal changes do not influence the output" ([same page][fram-brain]).

## 2. Topology operators and innovation ids

### 2.1 NEAT's historical markings and competing conventions

- **Competing conventions.** A network can express the same solution in `n!` hidden-unit permutations, so position-aligned crossover of `[A,B,C]` with `[C,B,A]` can yield `[C,B,C]`. Growing topologies make it worse: similar solutions arise from "entirely different topologies, or even genomes of different sizes" ([Stanley & Miikkulainen 2002, §2.2][neat2002]).
- **Innovation numbers.** "Whenever a new gene appears (through structural mutation), a global innovation number is incremented and assigned to that gene… innovation numbers are never changed". Identical structural mutations "in the same generation" are given the same number by keeping a per-generation list ([§3.2][neat2002]). neat-python implements this with an `innovation_tracker`, and keys each connection by its `(in, out)` pair ([`genome.py`, `mutate_add_node` / `add_connection`][np-genome]).
- **What the markings are for.** "Speciation uses a compatibility operator that is based on historical markings, and crossover would not be possible without them" ([§5, ablations][neat2002]).

**Mutation-only evidence.** On double-pole balancing, NEAT without mating needed 5,557 evaluations on average, against 3,600 for full NEAT. That is slower, but "still significantly faster than the other ablations" ([§5.6, Table 3][neat2002]). Removing speciation from an otherwise unchanged system means "no structural innovations can survive, causing all networks to be stuck in minimal form". Started from random topologies instead, nonspeciated NEAT failed 25% of runs and was 7× slower ([§5.5][neat2002]).

**For AcquarioTS (inference).**

- v0.2 has mitosis only (sex is v0.5 per the map), so competing conventions cannot hurt yet. Stable ids are needed now only for identity, as `vision.md` already says: a synapse names its endpoints, and ids also support lineage inspection.
- NEAT's same-generation deduplication has no direct equivalent without generations. rtNEAT, NEAT's continuous-replacement variant, keeps the same innovation scheme and only changes the replacement loop ([Stanley, Bryant & Miikkulainen 2005, §3–4][rtneat2005]).
- A plain monotonic counter without dedup costs nothing until crossover exists: two independent identical mutations just get different ids and would count as non-homologous later.
- **Determinism caution.** A _global_ id counter consumed during step 7 (mitosis) makes id values depend on population index order. ADR-0007 is built to avoid that kind of dependence for randomness. Behaviour stays order-independent as long as nothing in the simulation _branches on or sorts by_ numeric id values. That is a rule to state explicitly, or ids should be derived per lineage.

### 2.2 Add-connection and add-node

- **NEAT add-connection:** "a single new connection gene with a random weight is added connecting two previously unconnected nodes" ([§3.1][neat2002]).
- **NEAT add-node:** "an existing connection is split… The old connection is disabled and two new connections are added… The new connection leading into the new node receives a weight of 1, and the new connection leading out receives the same weight as the old connection. This method of adding nodes was chosen in order to minimize the initial effect of the mutation" ([§3.1][neat2002]). neat-python also forces the new node's bias to 0 ([`genome.py`][np-genome]).
- **Start minimal.** Starting from random topologies made NEAT 7× slower and caused 5% failures ([§5.4][neat2002]). The Bibites calls its brain algorithm "loosely based on" rtNEAT and uses the same split, where "the old synapse end[s] up being a disabled one" ([Bibites wiki: Brain][bib-brain], [Synapses][bib-syn]).

**Why a split is not neutral here (inference, grounded in two sources):**

- Under a synchronous double-buffered update, which is what `vision.md` specifies and what neat-python's `RecurrentNetwork.activate` does ([`recurrent.py`][np-recurrent]), `A → B` becomes `A → N → B` and the signal arrives one tick later.
- The inserted neuron also applies its own nonlinearity. Net2Net shows an identity-preserving inserted layer exists only when `φ(Iφ(v)) = φ(v)`, which holds for ReLU. "For some popular activation functions, such as the logistic sigmoid, it is not possible to insert a layer of the same type that represents an identity function" ([Chen, Goodfellow & Shlens 2016, §2.4][net2net]).
- In `vision.md` terms, a near-neutral split needs all of the following: `decay = 0`, a threshold that cannot be reached, bias at the center-crossing point, and an activation whose slope near 0 is 1 (`tanh` or `sin`, not `sigmoid` or `step`).
- The alternative already in `vision.md` is to insert the gene _inactive_, or with a near-zero outgoing weight.

### 2.3 Duplication

`vision.md` names duplication as "one of the principal sources of complexity". The function-preserving form is Net2WiderNet: copy the unit with its incoming weights, copy its outgoing weights too, and divide each outgoing weight by the replication count. For example, a unit duplicated once has its outgoing weights halved on both copies. Then add a little noise to break symmetry ([Net2Net §2.3][net2net]). Without the division, duplicating a neuron doubles its downstream effect, which is a large, non-resilient jump **(inference)**.

### 2.4 Rates

| Source                                     | Add node            | Add connection       | Weights                                                                              | Other                                                                                          |
| ------------------------------------------ | ------------------- | -------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| NEAT, pop. 150 ([§4.1][neat2002])          | 0.03                | 0.05                 | 80% of genomes mutated; each weight 90% uniform perturb / 10% new random             | disabled-in-either-parent stays disabled 75%; 25% offspring mutation-only                      |
| NEAT, pop. 1,000 (DPNV)                    | 0.03                | 0.3                  | as above                                                                             | "a larger population can tolerate a larger number of prospective species"                      |
| neat-python XOR example ([config][np-xor]) | 0.2 (delete 0.2)    | 0.5 (delete 0.5)     | rate 0.8, Gaussian power 0.5, replace 0.1, clamp ±30                                 | enable toggle 0.01; activation fixed to sigmoid                                                |
| Beer / Mathayomchan ([§3][mb2002])         | fixed topology      | fixed topology       | whole-vector Gaussian displacement, random direction on the hypersphere, variance σ² | seeded advantage largest at low σ²                                                             |
| The Bibites ([wiki: Brain][bib-brain])     | "Neuron Add Chance" | "Synapse Add Chance" | change, flip sign, toggle                                                            | a "Brain Mutation Chance" gene sets how many mutation events a birth gets; I/O nodes immutable |

**Reading the table (inference).**

- Every number above is tuned for a generational, speciated or elitist GA, and NEAT says so: "the system is tolerant to frequent mutations because of the protection speciation provides" ([§4.1][neat2002]).
- AcquarioTS has no speciation and no elitism, so structural rates should start low (NEAT's 0.03 / 0.05 is the conservative reference) and be measured, not copied.
- ADR-0021's per-gene independent probability (`0.25`) does not scale to a `Gene[]` with dozens of synapses. Per-gene rates need to fall as `1/genomeLength`, or a per-birth mutation _count_ should be drawn, as The Bibites does.

## 3. Activation-function sets

| System                                       | Set                                                                                                                                                          | Notes                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| NEAT ([§4.1][neat2002])                      | one: `1/(1+e^(−4.9x))`                                                                                                                                       | "steepened… close to linear during its steepest ascent between activations −0.5 and 0.5"          |
| Beer CTRNN ([`CTRNN.h`][beer-ctrnn-h])       | logistic, with an evolvable gain                                                                                                                             | table-based fast sigmoid optional                                                                 |
| neat-python ([`activations.py`][np-act])     | sigmoid, tanh, sin, gauss, relu, elu, lelu, selu, softplus, identity, clamped, inv, log, exp, abs, hat, square, cube                                         | per-node `activation_mutate_rate` switches between options                                        |
| Framsticks ([neurons summary][fram-neurons]) | `N` (bipolar sigmoid with evolvable steepness), plus separate classes: `Thr` threshold, `Sin` oscillator, `D` derivative, `Delay`, `Rnd` noise, `*` constant | behaviour lives in neuron _classes_, not in an activation gene                                    |
| The Bibites ([wiki: Nodes][bib-nodes])       | Sigmoid, Linear (±100 clamp), TanH, Sine, ReLU, "Gaussian" `1/(1+x²)`, Latch, Differential, Abs, Mult (product aggregation), Integrator, Inhibitory          | stateful types carry memory per node; "Change a Neuron's Activation Function" is its own mutation |

**For AcquarioTS (inference).**

- `vision.md`'s set (tanh, sigmoid, sin, step) plus its leaky memory and threshold already covers Bibites' Integrator (`decay → 1`) and a pulse/latch (threshold + discharge, or a self-synapse, §1.1).
- It does not cover a _derivative_ (Bibites' Differential and Inhibitory nodes, Framsticks `D`). A derivative gives motion and change detection, such as "is energy rising?". In the linear regime, two synapses of opposite sign from the same source into neurons with different decays approximate one.
- Switching activation is a categorical jump. Around 0, `tanh`, `sin` and a clamped identity share value 0 and slope 1, so switching among them is near-neutral for small inputs. `sigmoid` (0.5 at 0, slope 1/4) and `step` are not. Ordering or grouping the set by that property keeps activation mutations resilient.

## 4. Innate internal senses as network inputs

| System                                                  | Internal senses exposed as input neurons                                                                                                                                                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Polyworld ([Yaeger 1994, §6][yaeger1994])               | vision (per colour), "the current normalized level of its internal health-energy store, and a random value"                                                                                                                                                                                     |
| Framsticks ([neurons summary][fram-neurons])            | `Energy` ("current energy level divided by the initial energy level"), `G`/`Gpart` gyroscope (tilt; `G` ∝ sin(angle)), `Water` (0 above surface … 1 deeper than 1), `T` touch/proximity, `S` smell, `*` constant, `Rnd` noise; sensors are attached to body parts and carry position parameters |
| The Bibites ([wiki: Brain][bib-brain])                  | EnergyRatio, Maturity, LifeRatio, Fullness (stomach), Speed, RotationSpeed, IsGrabbing, AttackedDamage, EggStored, clocks (Tic, Minute, TimeAlive), plus vision and pheromones; input and output nodes are fixed and "can't be subjected to mutation"                                           |
| rtNEAT / NERO ([Stanley et al. 2005, §5.1][rtneat2005]) | all sensors egocentric (radars, rangefinders, on-target, line-of-fire)                                                                                                                                                                                                                          |

**Patterns across these systems:**

- Senses are ratios or normalised values rather than raw quantities.
- There is always a constant or bias source and usually a noise source (Polyworld, Framsticks).
- There is often a clock or oscillator (The Bibites' Tic, Framsticks' `Sin`).
- Senses are egocentric.

**For AcquarioTS (inference).** The candidates for innate senses are:

- energy / cap and food / cap
- internal O₂ and CO₂ ratios
- sampled light
- normalised depth
- orientation as `sin`/`cos` of heading, because Framsticks' `G` uses `sin(angle)` to avoid the wrap-around of a raw angle
- speed
- age

Framsticks is the precedent for sensors being located organelles in one network. The Bibites is the precedent for a fixed, immutable I/O layer. `vision.md` chose the former.

## 5. Per-tick cost of many small networks

**Precedents:**

- Polyworld debated how to schedule brains and chose "a complete neural activation… pass with each time step", pricing neurons and synapses through energy: the cost is "determined linearly from the number of neurons and the number of synapses" ([Yaeger 1994, §§5–6][yaeger1994]).
- The Bibites also processes the brain once per frame ([wiki: Brain][bib-brain]).
- Spiking precedents need neural sub-steps. Floreano used 1 ms neural steps under a 100 ms sensor period ([§3][floreano2001]), which multiplies cost by the sub-step count.

**Measured here.** Node v26.7.0 on the maintainer's Windows machine, 400 timed ticks after 50 warm-up ticks, two runs. The model is `vision.md`'s neuron with the convex input form from §1.1, a synchronous double buffer, and a random activation from {tanh, sigmoid, sin, step}. Synapses are uniform at random within each organism. The benchmark script was a throwaway and is not in the repo.

| Organisms × neurons × synapses/organism | Flat typed arrays (CSR), transcendental | Flat, arithmetic clamp only | Per-organism objects, transcendental |
| --------------------------------------- | --------------------------------------- | --------------------------- | ------------------------------------ |
| 1,000 × 8 × 20                          | 0.24–0.27 ms                            | 0.13–0.15 ms                | 0.30–0.36 ms                         |
| 1,000 × 32 × 128                        | 1.2–1.3 ms                              | 0.75–0.81 ms                | 2.1–2.4 ms                           |
| 5,000 × 16 × 48                         | 3.7–4.5 ms                              | 2.5–2.7 ms                  | 10.4–10.8 ms                         |
| 5,000 × 32 × 128                        | 10.0–10.3 ms                            | 6.1–6.9 ms                  | 20.6–23.8 ms                         |

**Reading (inference).**

- At v0.1's observed peak of about 1,000 organisms (`reproduction.long.test.ts`) and brains of tens of neurons, network evaluation takes under 10% of the 16.7 ms tick.
- Transcendentals cost about 1.5–1.8× the arithmetic-only loop, not an order of magnitude.
- A population-wide struct-of-arrays layout is about 2× faster than objects at moderate size, and the gap widens with scale. That bears on the map's open "Performance ceiling" question and on SoA, but it is not forced at v0.1 population sizes.

## Sources

**Primary (papers and first-party code or docs):**

- Beer, R. D. (1995). On the dynamics of small continuous-time recurrent neural networks. _Adaptive Behavior_ 3(4). [PDF][beer1995]
- Beer, R. D. (1996). Toward the evolution of dynamical neural networks for minimally cognitive behavior. _SAB 4_. [PDF][beer1996]
- Mathayomchan, B. & Beer, R. D. (2002). Center-crossing recurrent neural networks for the evolution of rhythmic behavior. _Neural Computation_ 14(9). [PDF][mb2002]
- Beer, R. D. (2006). Parameter space structure of continuous-time recurrent neural networks. _Neural Computation_ 18(12). [PDF][beer2006]
- Beer, R. D. Evolutionary Agents C++ code: [`CTRNN.cpp`][beer-ctrnn-cpp], [`CTRNN.h`][beer-ctrnn-h].
- Stanley, K. O. & Miikkulainen, R. (2002). Evolving neural networks through augmenting topologies. _Evolutionary Computation_ 10(2). [PDF][neat2002]
- Stanley, K. O., Bryant, B. D. & Miikkulainen, R. (2005). Real-time neuroevolution in the NERO video game. _IEEE TEC_ 9(6). [PDF][rtneat2005]
- neat-python (CodeReclaimers), source: [`genome.py`][np-genome], [`nn/recurrent.py`][np-recurrent], [`activations.py`][np-act], [XOR config][np-xor].
- Chen, T., Goodfellow, I. & Shlens, J. (2016). Net2Net: Accelerating learning via knowledge transfer. _ICLR_. [arXiv:1511.05641][net2net]
- Floreano, D. & Mattiussi, C. (2001). Evolution of spiking neural controllers for autonomous vision-based robots. _LNCS_ 2217. [PDF][floreano2001]
- Candadai Vasu, M. & Izquierdo, E. J. (2017). Evolution and analysis of embodied spiking neural networks reveals task-specific clusters of effective networks. _GECCO '17_. [arXiv:1704.04199][candadai2017]
- Yaeger, L. (1994). Computational genetics, physiology, metabolism, neural systems, learning, vision, and behavior or PolyWorld: Life in a new context. _Artificial Life III_. [PDF][yaeger1994]
- Framsticks documentation (Komosinski & Ulatowski): [Brain simulation][fram-brain], [Summary of all neuron types][fram-neurons].

**Secondary (lower trust).** The Bibites is closed-source. Its community wiki is the only written description found, and it is not versioned against the game: [Brain][bib-brain], [Nodes][bib-nodes], [Synapses][bib-syn]. The Bibites' default mutation-rate values were not found on the pages read.

[beer1995]: https://rdbeer.pages.iu.edu/Papers/Beer1995a.pdf
[beer1996]: https://rdbeer.pages.iu.edu/Papers/Beer1996.pdf
[mb2002]: https://rdbeer.pages.iu.edu/Papers/Mathayomchan2002.pdf
[beer2006]: https://rdbeer.pages.iu.edu/Papers/Beer2006.pdf
[beer-ctrnn-cpp]: https://rdbeer.pages.iu.edu/Software/EvolutionaryAgents/CTRNN.cpp
[beer-ctrnn-h]: https://rdbeer.pages.iu.edu/Software/EvolutionaryAgents/CTRNN.h
[neat2002]: https://nn.cs.utexas.edu/downloads/papers/stanley.ec02.pdf
[rtneat2005]: https://nn.cs.utexas.edu/downloads/papers/stanley.ieeetec05.pdf
[np-genome]: https://github.com/CodeReclaimers/neat-python/blob/master/neat/genome.py
[np-recurrent]: https://github.com/CodeReclaimers/neat-python/blob/master/neat/nn/recurrent.py
[np-act]: https://github.com/CodeReclaimers/neat-python/blob/master/neat/activations.py
[np-xor]: https://github.com/CodeReclaimers/neat-python/blob/master/examples/xor/config-feedforward
[net2net]: https://arxiv.org/abs/1511.05641
[floreano2001]: https://infoscience.epfl.ch/server/api/core/bitstreams/b8dfbb6a-f2cf-4636-8dfe-fba206a355b4/content
[candadai2017]: https://arxiv.org/abs/1704.04199
[yaeger1994]: http://shinyverse.org/larryy/Yaeger.ALife3.pdf
[fram-brain]: https://www.framsticks.com/brain_simulation
[fram-neurons]: https://www.framsticks.com/neurons_summary
[bib-brain]: https://the-bibites.fandom.com/wiki/Brain
[bib-nodes]: https://the-bibites.fandom.com/wiki/Nodes
[bib-syn]: https://the-bibites.fandom.com/wiki/Synapses
