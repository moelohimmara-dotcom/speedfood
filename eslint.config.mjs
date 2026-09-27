import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefacts de build @opennextjs/cloudflare (voir docs/DEPLOIEMENT-CLOUDFLARE.md) :
    // jamais committés, mais lint les scannait quand ils traînaient sur disque.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
