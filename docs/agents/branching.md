# Branching

Branch by the **size of the body of work**, not by the change. Two cases, and only two.

## Feature — its own branch

A **feature** is a body of work large enough to be broken into a set of issues by `/to-tickets`, or a milestone from `docs/vision.md`. It lives on its own `feature/<slug>` branch off `develop` (this repo's git-flow base), merged back when the whole set is done.

- `<slug>` — short kebab-case name of the feature (e.g. `feature/dna-gene-encoding`, `feature/organelle-eyes`).
- Cut the branch before publishing the spec, or immediately after — always before the first implementation commit lands.
- Reuse an existing `feature/<slug>` for this feature rather than opening a duplicate.
- `/implement` commits to whatever branch is checked out — check out `feature/<slug>` first.
- When the feature merges into `develop`, write its entries under `[Unreleased]` in `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/) sections), in a `📝: CHANGELOG <slug>` commit right after the merge. The milestone's ADRs and tickets are fresh then; at release time they would have to be rebuilt from the log.

## One-off — straight on `develop`

A **one-off** is a single ask: one fix, one tweak, one small implementation, a handful of commits that are born and merged within the session. Commit it directly to `develop`.

When the two are hard to tell apart, ask the user before cutting a branch.

## When a skill says "create a branch for this spec/feature"

`git checkout -b feature/<slug> develop`

## When a skill says "integration branch"

It is the feature's `feature/<slug>` branch. Features merge into `develop` locally, not through a pull request, so `/implement-spec` opens no draft PR: it closes each ticket as `docs/agents/issue-tracker.md` describes.
