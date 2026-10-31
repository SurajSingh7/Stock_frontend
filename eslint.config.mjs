import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // All HTTP goes through src/lib/apiClient.js (paths in src/constants/api).
  // middleware.js runs on the edge before any page and keeps its own fetch.
  {
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/lib/apiClient.js", "src/middleware.js"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Use api from @/lib/apiClient with a path from @/constants/api." },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
