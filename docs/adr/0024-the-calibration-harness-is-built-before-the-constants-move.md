# The calibration harness is built before the constants move, and it replaces the CSV export

M5's calibration happens in a headless, in-repo script — `npm run calibrate` — that constructs worlds, runs them, and reports the numbers the constants have to be chosen against. It is built and landed **before any constant is touched**. It carries no assertions: the gates live in the long suite, not in the instrument. The CSV export ADR-0011 committed to is dropped, because the harness does its one job better; the HUD gene statistics ship as planned, because it cannot do theirs at all.

## Why an instrument, and why first

`RESPIRATION_ENERGY_YIELD` is the precedent. Its comment records that the milestone's paper table put it at 100, "which starved the entire population within a few hundred ticks", and that 800 was found "by running `createWorld` out to 100k ticks and reading where the population settles rather than by solving for it on paper". `EXISTENCE_COST` moved the same way and for the same reason.

That method was right and it is not in the repo. Nobody can rerun it, diff its output against a later run, or check what a constant was measured against beyond the prose beside it. M5 moves five or six coupled constants at once and owes a verdict on v0.1 at the end of it, which is more than prose beside a number can carry.

Ordering matters more than it looks. ADR-0011 exists because "without a target fixed in advance, tuning drifts toward whatever was seen first". An instrument built _after_ the constants have moved cannot guard against that: it would be calibrated, unavoidably, against the run that produced it. Building it first costs nothing and removes the failure mode entirely.

## Why a script rather than a test

A test that prints instead of asserting is a test that can never fail, and a suite that contains one is a suite with a permanently green square in it. The harness reports; the gates are separate and assert:

- **#31**, reopened: conservation survives birth over 100k ticks in an unprimed fertile world, with its non-vacuity assertions.
- **The done-criteria run** (ADR-0025): convergence on the predicted `r_opt`.

Both live in `test:long`, where the existing 100k-tick gates already are.

## What it reports

Enough to choose against every constraint M5 has taken on, and nothing that only looks interesting:

- `α`, whole-population and photic-band (ADR-0023)
- the fitted income exponent `n` in `income ∝ r^n`, the maximum reproductive radius `r_max`, and tenancy (ADR-0025)
- the dark viable radius band's bounds, or that it is empty (ADR-0023)
- time to first unaided birth; population trajectory; births and deaths
- peak internal food concentration as a fraction of `s`, which is how close the world is to ADR-0022's gate

## The cost, stated rather than hidden

For the harness to sweep, the constants have to be reachable from outside the module that declares them. Two ways, and this ADR deliberately does not pick: thread a `WorldConstants` record through `createWorld`, which is a real change to a seam for the sake of an instrument; or have the script re-invoke a child process per candidate, which is uglier and contained. Whichever the ticket takes, it is a cost of this decision and belongs recorded beside it.

## Why the CSV export goes

ADR-0011 required it and justified it precisely: "it is the only way to compare runs offline". That justification has been overtaken. A reproducible command producing diffable text is a strictly better artefact than a file a human remembered to click for, and the comparison it enables is the one M5 actually needs to make.

The HUD statistics are a different artefact with a different job and they stay. The harness cannot tell you that a world satisfies every number and is still lifeless to watch; only a person watching it can, and the gene means and `α` split are what make that legible.

One line of `vision.md` goes with the CSV: it was described as "the one deliberate exception to having no persistence". With it gone, v0.1 has no persistence at all, without qualification — which is tidier than the exception was.

## Considered options

**Calibrate by hand in the browser,** reading the HUD. It forces the HUD to be genuinely good, and it is how the world will actually be watched. Rejected as the _search_ method: the sweep is over five coupled constants, and a search whose record is a human's memory of what looked right is the exact failure ADR-0011 names.

**A long test in reporting mode.** Reuses `vitest.long.config.ts` and its timeouts for free. Rejected for the permanently-green-square problem above.

**Keep the CSV as well.** Defensible, and rejected on the grounds that a deliverable should be justified by what it is for rather than by an ADR having once listed it. If a use appears that the harness cannot serve, it comes back with that use written down.

**Commit a calibration report to `docs/`.** Rejected: the repo already has the pattern, and it works — each constant's own comment carries its derivation and how it was measured. A separate report would duplicate it and rot.

## Consequences

- ADR-0011's consequence "Requires CSV export of that time series" is withdrawn. Its HUD requirement stands and grows: gene mean ± σ, plus `α` shown photic-against-whole.
- ADR-0015's depth-binned CSV consequence is withdrawn with it (ADR-0023 already replaces the need).
- The evidence trail for M5's constants lands in three places that already exist: the comments in `constants.ts`, the reopened #31 gate, and the devlog fragment pile.
- The harness is a **script, not a gate**: nothing in CI runs it, and it is expected to be rerun by hand whenever a constant is questioned again. That is also true of it after M5.
