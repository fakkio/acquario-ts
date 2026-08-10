# Commit Messages

Conventional Commits' structure, but the `<type>` token is a gitmoji (https://gitmoji.dev/) instead of a word.

## Format

    <emoji>[(scope)]: <description>

- `<emoji>` — one gitmoji, chosen for what the commit actually does (see table below).
- `(scope)` — optional, in parentheses, no space before the colon — a feature/module name (e.g. `(newLip)`, `(quoter)`). Omit when the change isn't scoped to one area.
- `<description>` — short, describing the change.

Examples (observed style, from jeflab/nuova-tcm-front-end):

    ✨: Implementato bonus parametrico per polizza
    🐛(lips): Fix bug doppia compressione test-api
    💬(quoter): corretto "rata mensile" -> "premio"
    ♻️: refactoring di DocumentsLockMolliePayment per migliorare la gestione della UI

## Emoji → meaning

| Emoji | Meaning                                 |
| ----- | --------------------------------------- |
| ✨    | New feature                             |
| 🐛    | Bug fix                                 |
| 🚑️    | Critical hotfix                         |
| ♻️    | Refactor                                |
| 💄    | UI / style                              |
| 🚸    | UX / usability improvement              |
| ⚡️    | Performance improvement                 |
| 🏗️    | Architectural change                    |
| 🔥    | Remove code or files                    |
| 🚚    | Move/rename files, paths, routes        |
| ✏️    | Fix typos                               |
| 📝    | Docs (README, CHANGELOG, etc.)          |
| 💬    | Text / copy / literals                  |
| 🏷️    | Types                                   |
| 🦺    | Validation                              |
| 🛂    | Auth, roles, permissions                |
| 🥅    | Error handling / catching               |
| 🔊    | Add/update logs                         |
| 🔇    | Remove logs                             |
| 🚨    | Fix lint/compiler warnings              |
| 🔒️    | Security fix                            |
| ♿    | Accessibility                           |
| 🔧    | Config files                            |
| 🔨    | Dev scripts / tooling                   |
| ➕    | Add a dependency                        |
| ⬆️    | Upgrade a dependency                    |
| ⚗️    | Experiment                              |
| 🚧    | Work in progress (not production-ready) |
| 👽️    | Update due to external API change       |
| 🔀    | Merge branches                          |
| 🔖    | Release / version tag                   |
| 🔼    | Bump version                            |
| 👥    | Contributors                            |

Pick the closest match; if genuinely nothing fits, fall back to the full gitmoji.dev list.

## When a skill says "commit your work"

Use this format instead of a plain Conventional Commits type.
