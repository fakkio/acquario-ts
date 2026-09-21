# Uniform grid rather than a quadtree

Neighbour queries use a uniform grid (spatial hash), rebuilt from scratch every tick.

## Why

Every organism moves every tick, so the spatial structure has to be rebuilt every tick either way — and a grid rebuilds in O(n) by bucketing on cell index, where a quadtree costs O(n log n) for recursive subdivision. Neighbour queries are also more cache-friendly over flat buckets than over tree pointers.

## Consequences

- The grid maps well onto the planned WebGPU migration, where bucketing or counting-sort per cell is a standard compute-shader technique; quadtrees are notoriously awkward on GPU.
- Reference material kept for the rejected option: [The Coding Train](https://www.youtube.com/watch?v=OJxEcs0w_kE) and [Computerphile](https://www.youtube.com/watch?v=BK5x7IUTIyU) on quadtrees. WebGPU compute research: <https://surma.dev/things/webgpu/index.html>.
- Cell size is derived from the largest body radius the world allows, so that a body never spans more than one cell and a query, dilated by that radius, touches a bounded number of cells. **That derivation expired at M4.** `bodyRadius` is a gene with range `> 0` mutating multiplicatively (`docs/vision.md`), so once reproduction exists there is no largest radius to derive from, and `MAX_BODY_RADIUS` stops describing the population. The failure is silent: a body that outgrows half a cell is simply missed by neighbour queries near it, with every test still green. M4 had to replace the rule — cell size tracking the current population's largest body and rebuilt with the grid each tick, or organisms bucketed into every cell their circle overlaps instead of into the cell of their centre.

**Amendment (M4).** The first candidate was taken: `buildUniformGrid` now scans the population it is handed for its largest `bodyRadius` before bucketing — an O(n) pass against a build that is already O(n) — and derives cell size and the query's dilation from that number instead of from a module constant. The second candidate, bucketing each body into every cell its circle overlaps, stays rejected; it is a larger change and belongs with v0.2's fluid grid (`docs/ideas.md`). What was `MAX_BODY_RADIUS` is renamed `GENERATION_0_MAX_BODY_RADIUS`, since it now describes generation 0's spread rather than a world-wide ceiling, and it survives as the fallback cell size for a population with no bodies to derive one from — an extinct world's grid, called from the render layer regardless. No ceiling is imposed on `bodyRadius` in its place: the carbon ledger already is one, since a single body cannot exceed the whole carbon budget (`ρ·πr² ≤ K·π`, ADR-0001), giving `r ≤ √K`.
