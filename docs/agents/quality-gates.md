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
