# AGENTS.md

## Agent skills

### Issue tracker

Issues live as GitHub Issues in fakkio/acquario-ts (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Branching

A feature (an issue set from `/to-tickets`, a milestone) gets its own `feature/<slug>` branch off `develop`; a one-off change commits straight to `develop`. See `docs/agents/branching.md`.

### Commit messages

Conventional Commits structure with a gitmoji in place of the type word. See `docs/agents/commits.md`.

### Dev-log

One Italian article per milestone in `docs/devlog/`, written from a fragment pile captured during implementation. **Every ticket ends by asking where reality differed from the plan**; if something did, **offer** to run `/writing-fragments` — never run it or write to the pile unasked. See `docs/agents/devlog.md`.

### Release process

Semantic Versioning; every pre-1.0 release is a minor bump, cut as a `release/vX.Y.Z` git-flow branch off `develop`. See `docs/agents/release.md`.

### Quality gates

Pre-commit lints and formats staged files via Husky; pre-push will gate on tests once a real test suite exists. See `docs/agents/quality-gates.md`.
