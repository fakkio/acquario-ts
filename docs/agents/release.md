# Release process

[Semantic Versioning](https://semver.org/). Until `1.0.0`, every release is a **minor** bump — `0.1.0`, `0.2.0`, ... — one per milestone from `docs/vision.md`. Patch releases and a hotfix flow are not yet defined; add them when a hotfix is first actually needed, not before.

## Cutting a release

A release branch off `develop`, per this repo's git-flow: `release/vX.Y.Z`.

Once the branch is open, three operations, always in this order, each its own commit (see `docs/agents/commits.md` for the gitmoji format):

1. **Bump the version.** Set `version` in `package.json` to `X.Y.Z`, then `npm i` so `package-lock.json` picks it up. Commit: `🔼: Bump version to vX.Y.Z`.
2. **Update dependencies.** `npm update` — bumps everything short of a major release. Commit: `⬆️: npm update`.
3. **Write the CHANGELOG entry.** Rename the `[Unreleased]` heading in `CHANGELOG.md` to `[X.Y.Z] - YYYY-MM-DD`, filled in from what actually merged into `develop` since the previous release, and open a fresh empty `[Unreleased]` above it. Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Commit: `📝: CHANGELOG vX.Y.Z`.

## Finishing a release

Standard git-flow finish: merge `release/vX.Y.Z` into `main`, tag `vX.Y.Z` there; back-merge `release/vX.Y.Z` into `develop`; delete the release branch.
