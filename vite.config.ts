import {configDefaults, defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The 100k-tick conservation run (#20) costs several seconds on its
    // own — well past the "a few seconds" line the ticket draws for the
    // suite that runs at every commit. It lives in its own long suite
    // instead (`vitest.long.config.ts`, `npm run test:long`); see
    // `docs/agents/quality-gates.md`.
    exclude: [...configDefaults.exclude, "**/*.long.test.ts"],
  },
});
