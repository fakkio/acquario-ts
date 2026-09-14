# Exchange settles in two sub-passes: request, then grant

Step 2 of the tick pipeline splits in two. In **2a** every organism registers the flux it wants, writing nothing. Between the passes, the scaling factor for each pool is computed from the total demand against it. In **2b** every organism is handed its granted amount and runs its reactions against that number. The delta buffer applied at commit therefore holds **grants**, already scaled, rather than requests.

## Why

ADR-0005 states two things that cannot both hold in a single pass:

- `exchange` returns the amount **actually** exchanged, and that return value exists specifically to force the partial-fulfilment path to exist from day one;
- requests accumulate into a delta buffer applied once at end of tick, with proportional scaling if a pool would go negative.

The scaling factor is a function of the _total_ demand, so it is not a number until every organism has asked. In a single pass, an organism that calls `exchange` early is asking a question the world cannot yet answer.

Worked, with the pool nearly dry. The food pool holds 10. Organisms A and B each want 8; the scaling rule gives each of them 5. But when A calls `exchange(food, 8)`, B has not spoken, so the only honest answer available is 8. A then respires against `2 in store + 8 arriving = 10` and burns 9. At commit the pool yields 5, and A holds `2 + 5 − 9 = −2` food. A negative store is carbon minted from nothing, and the milestone's invariant fails on the first crowded tick.

## Considered options

**Reactions never count on this tick's inflow.** `exchange` returns the requested amount, availability for photosynthesis and respiration is measured against the store an organism already holds, and the shortfall is applied symmetrically at commit. One pass, and no store can go negative because nothing spends what has not arrived. Rejected for what it costs rather than for being unsound: it puts a tick of latency between absorbing and using, and — more seriously — leaves the return value of `exchange` read by nobody, so the partial-fulfilment path ADR-0005 exists to establish is written but dead. A path with no caller is not a path.

**Apply optimistically and claw back at commit.** The worked example above: the clawback lands on a store that has already been spent. Rejected outright.

## Consequences

- One extra O(n) pass over the population, inside a tick that already makes several. The cost is linear and known; the alternative's cost is a class of conservation bug that only appears under crowding.
- **Caps and floors become exact rather than argued.** Grants are final before any reaction runs, so "an organism never holds less than zero or more than its cap" is a property of the arithmetic rather than a conclusion drawn from the order of operations.
- Order-independence is untouched. Pass 2a writes only to the buffer, pass 2b writes only to the organism it is running for; ADR-0005's guarantee that reordering the population changes nothing survives both.
- The partial-fulfilment path is live code from M2. It matters little against well-mixed global pools, which is exactly why it has to be built now: in v0.2 the pools become fluid cells that run dry routinely, and that is the worst moment to discover the path was never exercised.
- ADR-0006's claim that the world is mutated at a single well-defined point still holds. Grants are _decided_ in 2b and _applied_ to the pools at step 9 with everything else.
- `docs/vision.md`'s pipeline is renumbered, and its line about steps 3–5 touching internal state only is rewritten: they still write nothing to the world, but they now read a number the world computed collectively this tick.
