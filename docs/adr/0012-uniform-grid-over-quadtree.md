# Uniform grid rather than a quadtree

Neighbour queries use a uniform grid (spatial hash), rebuilt from scratch every tick.

## Why

Every organism moves every tick, so the spatial structure has to be rebuilt every tick either way — and a grid rebuilds in O(n) by bucketing on cell index, where a quadtree costs O(n log n) for recursive subdivision. Neighbour queries are also more cache-friendly over flat buckets than over tree pointers.

## Consequences

- The grid maps well onto the planned WebGPU migration, where bucketing or counting-sort per cell is a standard compute-shader technique; quadtrees are notoriously awkward on GPU.
- Reference material kept for the rejected option: [The Coding Train](https://www.youtube.com/watch?v=OJxEcs0w_kE) and [Computerphile](https://www.youtube.com/watch?v=BK5x7IUTIyU) on quadtrees. WebGPU compute research: <https://surma.dev/things/webgpu/index.html>.