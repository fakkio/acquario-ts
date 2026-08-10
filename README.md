# AcquarioTS

A 2D artificial-life simulation in which autonomous organisms evolve over time through natural selection.

Nothing is scripted. There are no predefined species, no programmed behaviours, no hand-tuned strategies. Every organism is described by a genome, and everything it can do — moving, photosynthesising, sensing, attacking, reproducing — either exists innately in a minimal body or emerges as an evolvable **organelle** layered on top of it. The goal is to watch morphologies, metabolic strategies, nervous systems, predation, cooperation and reproductive strategies emerge spontaneously, purely from selection acting on mutation.

Runs entirely client-side, in a single browser tab. No server, no backend, no account.

## Why

Most artificial-life projects either hand-design the species they want to see, or bolt evolution onto a system that was never built to support open-ended change. AcquarioTS starts from the opposite end: the **minimal organism** — a circle with passive diffusion, passive photosynthesis, passive respiration, brownian motion and mitosis — is the _only_ organism that exists at first. Every advanced capability is an organelle an organism can evolve to grow, never a rule baked into the simulation itself. If a behaviour shows up, it's because it was worth it.

The project also treats conservation as its main correctness tool: the world is a closed carbon-and-oxygen system, and total carbon/oxygen are asserted as invariants across every run. Nearly every metabolic bug surfaces first as a leak in those numbers.

Read the full design rationale in [`docs/vision.md`](./docs/vision.md), and the "why" behind contested decisions in [`docs/adr/`](./docs/adr/).

## Status

Early and actively evolving (pun intended). Current focus is **v0.1**: the minimal organism, with no organelles yet — circular bodies, brownian motion, a closed three-pool metabolism (energy / O₂ / CO₂ / food), death by starvation, and mitosis with a four-gene genome. See the [milestones table in the vision doc](./docs/vision.md#milestones) for what's shipped and what's next, and [`CHANGELOG.md`](./CHANGELOG.md) for release history.

Organelles, sight, a nervous system, sexual reproduction and spatial fluids are all deferred to v0.2+.

## Getting started

```bash
npm install
npm run dev
```

Opens a fullscreen Canvas2D view with start/pause/step, zoom/pan, and a HUD showing tick, seed, population, pool levels and live gene statistics.

Other useful scripts:

```bash
npm run test       # Vitest
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # production build
```

## How it works, briefly

- **Genome in, phenotype out.** Every organism is generated from a genome. In v0.1 that's four genes (body size, reproduction threshold, child allocation, a neutral lineage-colour marker); from v0.2 it becomes a structural `Gene[]` of organelles, neurons and synapses.
- **A closed world.** Energy, oxygen, carbon dioxide and food are the only resources. Food is matter, energy is work. Photosynthesis and respiration are the only two reactions, both mass-balanced, and both intentionally inefficient — that inefficiency is what organelles exist to improve on later.
- **Selection has real teeth.** Because carbon is finite, the population has a hard ceiling set by the world, not by a tuning constant — and full extinction is a genuinely possible outcome.
- **Deterministic by construction.** A single master seed drives all randomness, split into independent per-organism streams, so the same seed and build always reproduce the same run.

For the full mechanics — the tick pipeline, the diffusion law, reproduction costs, the calibration method — see [`docs/vision.md`](./docs/vision.md). Vocabulary and terminology live in [`CONTEXT.md`](./CONTEXT.md).

## Contributing

Issues are tracked as GitHub Issues on this repo. If you'd like to pick one up:

1. Check open issues, especially any labelled `ready-for-human` or `ready-for-agent`.
2. Read [`docs/vision.md`](./docs/vision.md) first — most design decisions are deliberate and documented; if something looks like an oversight, check [`docs/adr/`](./docs/adr/) before assuming it's a bug.
3. Simulation logic (metabolism, mutation, genome, spatial grid, neuron update rule) is built test-first — see the testing notes in [`docs/agents/`](./docs/agents/). The rendering layer and the animation loop are instead verified by running the app.
4. Commits follow Conventional Commits with a gitmoji in place of the type word; see [`docs/agents/commits.md`](./docs/agents/commits.md).

Bug reports, questions and design discussion are all welcome via GitHub Issues.

## License

[ISC](./LICENSE)
