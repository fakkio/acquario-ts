# Branching

Each spec (PRD) lives on its own dedicated branch, not on `develop`/`main` directly — consistent with this repo's existing git-flow setup.

## Convention

- Branch name: `feature/<slug>`, where `<slug>` is a short kebab-case name for the feature the spec describes (e.g. `feature/dna-gene-encoding`, `feature/organelle-eyes`).
- Branch off `develop` (this repo's git-flow base branch).
- Create and check out the branch before publishing the spec, or immediately after — before any implementation commits land.
- Reuse an existing `feature/<slug>` branch for this spec rather than creating a duplicate.
- `/implement` commits to whatever branch is currently checked out — make sure `feature/<slug>` is checked out before implementation starts.

## When a skill says "create a branch for this spec/feature"

`git checkout -b feature/<slug> develop`