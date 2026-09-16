import {defineConfig} from "vitest/config";

/**
 * The long suite: `*.long.test.ts` files, excluded from the default
 * `vitest.config.ts` run (see the comment there) because they cost seconds
 * rather than milliseconds. Run explicitly via `npm run test:long`, and see
 * `docs/agents/quality-gates.md` for where this belongs once pre-push
 * testing is wired up.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.long.test.ts"],
    // A 100k-tick run costs several seconds by itself; the default 5s test
    // and hook timeouts are too tight for it.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
