import tseslint from "typescript-eslint";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["node_modules/**", "dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
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
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    },
  },
  {
    files: ["src/manager/**/*.{ts,tsx}"],
    ...reactHooks.configs.flat["recommended-latest"],
  },
  // The page never writes HTML strings into the DOM. scripts/lint-extension.ts
  // relies on this to excuse react-dom's own innerHTML in manage.js.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        ...["innerHTML", "outerHTML", "insertAdjacentHTML"].map((property) => ({
          property,
          message: "Build DOM with React or createElement instead.",
        })),
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Build DOM with React instead.",
        },
      ],
    },
  },
  {
    files: ["tests/**/*.{js,mjs,ts}", "*.config.js", "scripts/**/*.ts"],
    languageOptions: { globals: { ...globals.node, Bun: "readonly" } },
  },
];
