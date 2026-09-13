import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "dist/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["*.test.js", "*-check.mjs", "*.config.js", "scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, Bun: "readonly" } },
  },
];
