# AGENTS.md

## Agent skills

### Issue tracker

Issues live as GitHub Issues in fakkio/acquario-ts (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Branching

Each spec/feature lives on its own `feature/<slug>` branch off `develop` (git-flow). See `docs/agents/branching.md`.

### Commit messages

Conventional Commits structure with a gitmoji in place of the type word. See `docs/agents/commits.md`.

### Dev-log

One Italian article per milestone in `docs/devlog/`, written from a fragment pile captured during implementation. When a notable choice lands, **offer** to run `/writing-fragments` — never run it or write to the pile unasked. See `docs/agents/devlog.md`.
