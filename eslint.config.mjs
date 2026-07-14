import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  // Bypassing next-config imports due to Node.js ESM compatibility issues
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
