# Quality gates

Local git hooks, via Husky.

## Pre-commit — lint, format, typecheck

`.husky/pre-commit` runs two steps:

1. `npx lint-staged`, which runs ESLint (`--fix`) and Prettier (`--write`) on staged files only, per the `lint-staged` field in `package.json`.
2. `npm run typecheck` (`tsc --noEmit`), across the whole project — type errors can surface in files the commit didn't touch, so this isn't scoped to staged files like the lint-staged step.

A failure in either step blocks the commit.

ESLint config (`eslint.config.mjs`) uses `typescript-eslint`'s `strictTypeChecked` + `stylisticTypeChecked` rule sets, scoped to `**/*.ts`/`**/*.tsx` via `tsconfig.json` (`projectService`), plus `curly: ["error", "all"]` — every `if`/`for`/`while` body must use braces, even a single statement. Non-TS files (config scripts, etc.) only get plain `@eslint/js` recommended rules — they aren't part of the TypeScript project.

## Pre-push — tests

Not yet wired. `npm test` is still the placeholder script from repo scaffolding (`exit 1`, always fails) — wiring a pre-push gate on it now would block every push. Add `.husky/pre-push` running `npm test` once the first milestone (`v0.1`) lands a real test suite; that milestone is the trigger, not a date.
