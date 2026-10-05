# Quality gates

Local git hooks, via Husky.

## Pre-commit — lint, format, typecheck

`.husky/pre-commit` runs two steps:

1. `npx lint-staged`, which runs ESLint (`--fix`) and Prettier (`--write`) on staged files only, per the `lint-staged` field in `package.json`.
2. `npm run typecheck` (`tsc --noEmit`), across the whole project — type errors can surface in files the commit didn't touch, so this isn't scoped to staged files like the lint-staged step.

A failure in either step blocks the commit.

ESLint config (`eslint.config.mjs`) uses `typescript-eslint`'s `strictTypeChecked` + `stylisticTypeChecked` rule sets, scoped to `**/*.ts`/`**/*.tsx` via `tsconfig.json` (`projectService`), plus `curly: ["error", "all"]` — every `if`/`for`/`while` body must use braces, even a single statement. Non-TS files (config scripts, etc.) only get plain `@eslint/js` recommended rules — they aren't part of the TypeScript project.

## Pre-push — tests

Not yet wired. `npm test` (`vitest run`) is a real suite now (M1 onward), but `.husky/pre-push` isn't set up yet — that is still v0.1's trigger, not a date.

## The long suite

`npm test` runs every `*.test.ts` file except `*.long.test.ts` (`vite.config.ts`'s `test.exclude`). A `*.long.test.ts` file is one whose run costs seconds rather than milliseconds — the line drawn by ticket #20, which put the first one there: a single 100k-tick conservation run costs several seconds on its own (see `conservation.long.test.ts`'s doc comment for the measured number), well past "a few seconds". These live under their own config, `vitest.long.config.ts`, with the default test/hook timeouts raised to fit; run them with `npm run test:long`.

The long suite isn't wired into any git hook. Once pre-push testing above is wired up, it is the long suite's natural home — `npm test` stays the fast, always-on gate; `npm run test:long` is for CI or a deliberate local run.

## The calibration harness is not a gate

`npm run calibrate` runs M5's instrument (ADR-0024). It constructs worlds, runs them and prints what they did. **It asserts nothing**: no number it measures can make it fail, however unwelcome. So it is not a gate, and nothing automated runs it — not `npm test`, not the long suite, not a git hook. (It can still crash, on a bad `ACQUARIO_` override or a ladder that does not fit the aquarium. That is the instrument being broken rather than a measurement coming back wrong, and it should be loud.) A test that prints instead of asserting is a test that can never fail, and a suite holding one has a permanently green square in it.

It is meant to be rerun by hand, by a person, whenever a constant is questioned — including long after M5. Its output is plain text, formatted to diff cleanly between runs.

One thing does gate on what it measures, and it asserts: #31's conservation-survives-birth run, in the long suite.

The done-criteria runs used to be the second, as a long-suite file left red on purpose to record v0.1's verdict. ADR-0027 made them a reported measurement, so they moved into the harness under an entry point of their own, `npm run done-criteria`. Like `calibrate`, it prints its verdict as text (accuracy and convergence, each PASS or FAIL) and exits successfully whatever the numbers say. It is a sibling rather than a section of `calibrate` because fifteen 100k-tick worlds take long enough to slow down every rerun of the instrument. With it gone, every failure in `npm run test:long` means something.

`npm run neuron` is a third sibling, for the same reason: M7's neuron carrier fraction and ceiling readings (#66) run five seeds of 100k ticks twice, once with `c_neuron = 0`. It asserts nothing either.
