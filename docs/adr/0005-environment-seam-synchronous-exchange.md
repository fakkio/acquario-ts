# Environment seam, position-aware from day one; synchronous double-buffered exchange

Metabolic code never touches a pool. It talks to an `Environment` whose signature already takes a position, even though the v0.1 implementation ignores it everywhere except `light`:

```ts
interface Environment {
  concentration(resource: Resource, pos: Vec2): number
  light(pos: Vec2): number
  // returns the amount ACTUALLY exchanged, which may be less than requested
  exchange(resource: Resource, pos: Vec2, amount: number): number
}
```

Exchange is synchronous and double-buffered: every organism reads the same start-of-tick snapshot, requests accumulate into a delta buffer, and the buffer is applied once at end of tick, with proportional scaling if a pool would go negative.

## Considered options

Writing metabolism directly against the global pools and refactoring when fluids arrive. Rejected because fluids are planned imminently and the refactor would touch every metabolic routine, while the seam costs nothing now. Also considered applying exchanges sequentially in array order — simpler, but it makes physics depend on array position, so the first organism drinks from a richer pool, and array order changes whenever organisms die.

## Consequences

- `exchange` returning the amount *actually* transferred looks pointless against an effectively infinite pool, but it forces the partial-fulfilment path to exist from day one — otherwise every routine acquires a hidden assumption that breaks the day a fluid cell runs dry.
- A tick is order-independent: reorder the population and results are bit-identical. This composes with per-organism PRNG streams (ADR-0007) and keeps the WebGPU path open.
- The proportional-scaling rule is the same code needed later when a single fluid cell is exhausted.