# Release process

[Semantic Versioning](https://semver.org/). Until `1.0.0`, two counters run at once:

- **Patch counts milestones.** Each milestone from `docs/vision.md` ships as a patch release: M0 was `0.0.2`, M1 is `0.0.3`, and so on.
- **Minor counts versions of the vision.** `0.1.0` is cut when the last milestone of v0.1 closes, which is M5; `0.2.0` when v0.2's does.

So a minor bump is also the release that ships a milestone, and there is no separate release for it.

A hotfix flow is not defined; add one when a hotfix is first actually needed, not before.

## Cutting a release

A release branch off `develop`, per this repo's git-flow: `release/vX.Y.Z`.

Once the branch is open, three operations, always in this order, each its own commit (see `docs/agents/commits.md` for the gitmoji format):

1. **Bump the version.** Set `version` in `package.json` to `X.Y.Z`, then `npm i` so `package-lock.json` picks it up. Commit: `🔼: Bump version to vX.Y.Z`.
2. **Update dependencies.** `npm update` — bumps everything short of a major release. Commit: `⬆️: npm update`.
3. **Write the CHANGELOG entry.** Rename the `[Unreleased]` heading in `CHANGELOG.md` to `[X.Y.Z] - YYYY-MM-DD`, filled in from what actually merged into `develop` since the previous release, and open a fresh empty `[Unreleased]` above it. Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Commit: `📝: CHANGELOG vX.Y.Z`.

## Finishing a release

Standard git-flow finish: merge `release/vX.Y.Z` into `main`, tag `vX.Y.Z` there; back-merge `release/vX.Y.Z` into `develop`; delete the release branch.
