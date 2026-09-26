import {existsSync} from "node:fs";
import {registerHooks} from "node:module";
import {fileURLToPath} from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const base = new URL(specifier, context.parentURL);
      for (const candidate of [`${base.href}.ts`, `${base.href}/index.ts`]) {
        if (existsSync(fileURLToPath(candidate))) {
          return {
            url: candidate,
            format: "module-typescript",
            shortCircuit: true,
          };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
