import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules", "dist", ".agents", ".claude", "experiments"],
  },
  js.configs.recommended,
  {
    // The harness's resolver hook runs under plain `node`, outside the
    // bundler that would otherwise supply these. Listed by hand rather than
    // pulling in `globals` for three names.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {URL: "readonly", console: "readonly", process: "readonly"},
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      curly: ["error", "all"],
    },
  },
);
