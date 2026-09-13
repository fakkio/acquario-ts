# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.3] - 2026-09-13

### Added

- Circular organisms, each carrying a position, a `bodyRadius`, a `lineageHue` and its own PRNG stream, placed as a generation-0 population in a finite, hard-walled aquarium whose dimensions are expressed in baseline body radii.
- Brownian motion under overdamped Stokes drag (ADR-0008): velocity is force over drag times radius, so large bodies visibly wander less than small ones, and no body ever crosses the aquarium boundary.
- A uniform grid over the population (ADR-0012), rebuilt from scratch each tick, with a toggleable debug overlay drawing the cells.
- Positional separation: overlapping bodies are pushed apart along their pair normal in proportion to `1/area`, with corrections buffered and applied once per tick so the result does not depend on visit order.
- HUD rows for the population count and the worst penetration depth.

### Changed

- `advance` runs discrete per-tick steps through ADR-0006's read / resolve / commit phases, instead of converting elapsed time into a tick count and adding it in a single step.
- `hashState` folds in every organism's position, radius and stream state, so the determinism invariant covers bodies and not only the clock.

### Removed

- M0's placeholder background grid and hash-derived background hue, now that the aquarium wall and the population are what the canvas shows.

This closes **M1 — Bodies and motion**: the aquarium holds bodies that drift, jostle each other apart and stay inside hard walls, with no metabolism of any kind.

## [0.0.2] - 2026-08-10

### Added

- Toolchain: Vite, Vitest, TypeScript (strict mode), ESLint + Prettier, Husky pre-commit hook.
- Deterministic `World` core (`createWorld`/`advance`/`hashState`) with a fixed-step accumulator, a catch-up cap, and per-organism PRNG streams derived from a single master seed (ADR-0007).
- Canvas2D render loop with play/pause/single-tick-step controls.
- HUD shell showing the live tick count and active seed.
- Pan and zoom on the canvas, with touch support.

This closes **M0 — Simulation skeleton**: same seed now yields the same state hash at tick N.
