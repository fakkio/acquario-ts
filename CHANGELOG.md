# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.2] - 2026-08-10

### Added

- Toolchain: Vite, Vitest, TypeScript (strict mode), ESLint + Prettier, Husky pre-commit hook.
- Deterministic `World` core (`createWorld`/`advance`/`hashState`) with a fixed-step accumulator, a catch-up cap, and per-organism PRNG streams derived from a single master seed (ADR-0007).
- Canvas2D render loop with play/pause/single-tick-step controls.
- HUD shell showing the live tick count and active seed.
- Pan and zoom on the canvas, with touch support.

This closes **M0 — Simulation skeleton**: same seed now yields the same state hash at tick N.
