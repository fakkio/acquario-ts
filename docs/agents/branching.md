# Branching

Branch by the **size of the body of work**, not by the change. Two cases, and only two.

## Feature — its own branch

A **feature** is a body of work large enough to be broken into a set of issues by `/to-tickets`, or a milestone from `docs/vision.md`. It lives on its own `feature/<slug>` branch off `develop` (this repo's git-flow base), merged back when the whole set is done.

- `<slug>` — short kebab-case name of the feature (e.g. `feature/dna-gene-encoding`, `feature/organelle-eyes`).
- Cut the branch before publishing the spec, or immediately after — always before the first implementation commit lands.
- Reuse an existing `feature/<slug>` for this feature rather than opening a duplicate.
- `/implement` commits to whatever branch is checked out — check out `feature/<slug>` first.

## One-off — straight on `develop`

A **one-off** is a single ask: one fix, one tweak, one small implementation, a handful of commits that are born and merged within the session. Commit it directly to `develop`.

When the two are hard to tell apart, ask the user before cutting a branch.

## When a skill says "create a branch for this spec/feature"

`git checkout -b feature/<slug> develop`
