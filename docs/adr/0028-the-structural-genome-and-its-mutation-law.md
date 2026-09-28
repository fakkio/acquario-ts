# The structural genome and its mutation law

v0.2's genome is a fixed header of **Organism Genes** plus a `Gene[]` of structural genes. Structural mutation is a bounded number of events per birth, duplication is a **Split** that conserves area, and the **Birth Cost Ceiling** becomes a closed-form bound computed per parent, because a body derived from its organelles' layout has no constant ceiling worth pricing. Settled in #42.

## The shape

```text
Genome  = { mitosisEnergyThreshold, childAllocationRatio, lineageHue, cytoplasmThickness, genes: Gene[] }
Gene    = OrganelleGene | SynapseGene
```

- **Organism Genes** are the genes an organism has exactly once. They live in the header, mutate under ADR-0021 unchanged (independent probability 0.25 each), carry no id and are aligned by name. Putting them in `Gene[]` as a fourth kind would force every structural operator to exclude them by hand.
- **A neuron is an organelle type**, with a position, a size, a place in the layout and a cost, as `vision.md` has always said. A **synapse** is the one structural gene with no geometry: a relation between two endpoints, with a weight.
- **The body is derived from the layout.** Organelles are relaxed apart, and the body radius is their minimum enclosing circle plus **Cytoplasm Thickness**. With no organelles that circle is empty and the thickness is the whole radius, so the gene inherits v0.1's `bodyRadius` and its multiplicative law, and a body with no organelles is v0.1's minimal organism.
- **The baseline genome has no organelles.** Generation 0 uses the same mutation law as any birth (ADR-0021's "one law, not two"), so a founder may be born with an organelle but none is seeded.
- **No `active` flag in v0.2.** Its canonical use is NEAT's disabled genes, which serve crossover (v0.5). An inactive gene that pays nothing makes reactivation an unbounded cost jump; one that pays in full is strictly worse than a deletion.

## Innovation ids are identity only

Each structural gene carries an **Innovation Id**, minted from a monotonic per-world counter when the gene is inserted or split off. The counter advances at mitosis in population order, so an id's _value_ depends on processing order, which ADR-0007's per-organism streams exist to keep out of behaviour. The rule that keeps it out: ids are compared for equality and nothing else. Nothing sorts, iterates, draws or branches on an id's value, and evaluation order is a gene's position in the genome. The counter consumes no stream draws. What is lost is that an isolated lineage replay reproduces behaviour but not id values.

Innate endpoints a synapse can reference without being genes (whatever senses #48 decides every body has) get fixed, reserved ids outside the counter's range.

## Mutation is a bounded number of events

ADR-0021's independent per-gene probability does not scale: 60 synapses at 0.25 is fifteen mutations a birth. The header keeps that law. The `Gene[]` instead draws a count `n ∈ 0…M_max` per birth, and each event picks an **operator** by rate weight, then a **target** uniformly among the genes that operator can act on. An event with no valid target does nothing and is not redrawn. `M_max`, the weights and the distribution of `n` are the milestone's.

| Operator            | Acts on       | Law                                                                                                |
| ------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| parameter change    | one organelle | one parameter, by the law its type declares                                                        |
| weight change       | one synapse   | small continuous step                                                                              |
| organelle insertion | the genome    | type uniform over the roster, fixed small size `a_new`, uniform position within the current circle |
| neuron insertion    | the genome    | an organelle insertion of type `neuron`, born unconnected (exactly neutral)                        |
| synapse insertion   | two endpoints | drawn among existing endpoints, small weight (the weight step taken from 0)                        |
| deletion            | one gene      | removes it and, in cascade, every synapse touching it; one event                                   |
| split               | one organelle | see below                                                                                          |

Parameters are **declared, not coded**. Every organelle type lists its parameters and gives each a law from a closed menu (symmetric multiplicative, additive clamped, wrapping angle), widened only by ADR. The common parameters share one law: size is the radius, symmetric multiplicative; position is Cartesian in the genome's frame with an additive step of at most `δ_pos·rᵢ`, the organelle's own radius; orientation is a wrapping angle. A free `mutate()` per type could do anything, including break the ceiling unnoticed. A declared law has a worst case that can be read off the declaration.

NEAT's add-node, splitting a connection with a new neuron, is not an operator: under a synchronous update it is not neutral (#45).

## Duplication is a Split

A duplication cannot copy a large organelle for free (ADR-0027). It divides one: the organelle becomes two of areas `f·A` and `(1−f)·A`, with `f = 0.5 + (u₁ + u₂ − 1)·w`, a triangular bell on `[0.5−w, 0.5+w]` (`w = 0.3` gives `[0.2, 0.8]`) that needs no truncation. Incoming synapses are copied to both pieces, with new ids and the same weight; outgoing ones are divided, `f·w` and `(1−f)·w`. For a neuron that is exactly neutral at any `f`, and for any organelle it conserves area. Synapses have no split of their own: they arise by insertion or as copies inside a split.

## The ceiling is computed per parent

Area is conserved by a split, but the body is not. Two circles of total area `A` need an enclosing circle of radius `(√f + √(1−f))·r`, up to `1.41·r` at `f = 0.5`, so splitting an organelle that fills its body roughly doubles the child's area. Relaxation adds a second unknown: a small insertion can push a chain of organelles outward by an amount that depends on the algorithm. A constant `γ` covering that worst case would ask every parent to hold a child twice its size.

So the gate prices a bound computed in closed form from the parent's own genome, not a constant:

```text
R_max          = MEC_parent + M_max · maxEventGrowth(genome) + cytoplasmThickness · (1 + δ)
maxEventGrowth = max( split:     2(√2 − 1) · r_max     ≈ 0.83 · r_max
                      insertion: 2 · r_new
                      size:      2 · δ_size · r_max
                      position:  δ_pos · r_max )
maxChildArea   = π · R_max²          priced for both mitosis costs, as in ADR-0027
```

`r_max` is the parent's largest organelle radius. This is still a bound by construction, read from the declared laws, not a maximum found by enumerating mutations, and it is never enforced by rejecting draws. It hands the milestone a **relaxation contract**: an event that adds `Δd` of diameter or moves an organelle by `d` grows the enclosing radius by at most `Δd + d`, however far the relaxation pushes. The milestone may tighten the constants; it may not loosen the contract. ADR-0027's `(1+γ)·parentArea` is v0.1's special case, where the genome is one multiplicative radius.

The bound is in area. If #47 makes density depend on composition, the density law must stay bounded too, or a child's mass escapes the ceiling.

## Considered options

**Body area additive in the genes** (`cytoplasm + Σ organelle area`, layout inside a fixed circle). It keeps `γ` a small constant, gives a split no ceiling term and needs nothing from relaxation. Rejected to keep the body a consequence of its layout, where an organelle's position physically changes the body's size, as `vision.md`'s body construction describes.

**A large global `γ`.** Simple, and it sterilises every parent to cover the worst case of a few.

**A per-birth count over the whole genome, header included.** One law, but the header's share of events falls as structure accumulates, so body size and breeding strategy would evolve more slowly in complex organisms for no reason connected to fitness.

**Duplication as a reduced copy** (`k·A`). Adds area and a ceiling term with no gain over a split, and is not neutral for neurons.

**Per-lineage ids** (53 bits drawn from the organism's stream). Order-independent, but they consume draws and admit collisions, for a property the identity-only rule already gives.

## Consequences

- **A parent carrying one large organelle must hold much more than it will pay**, and so breeds later. That is a selection pressure against giant single organelles that nobody designed. Children remain an unbiased sample, so it is not a sieve, but it is a risk to watch in the first milestone with organelles.
- The relaxation algorithm stays the milestone's, bound by the contract above.
- New structure evolves more slowly per gene as the genome grows, since `n` does not scale with it.
- An empty `Gene[]` can only gain structure by insertion, at the insertion weight's share of events.
- Open for #48: what a neuron's size and position mean.
- Glossary: **Organism Gene**, **Structural Gene**, **Organelle Gene**, **Synapse Gene**, **Innovation Id**, **Cytoplasm Thickness**, **Split**; **Body Radius**, **Mutation**, **Genome** and **Birth Cost Ceiling** amended.
