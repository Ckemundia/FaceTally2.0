import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";
import prettier from "eslint-plugin-prettier";
export default defineConfig([
  // Base JS/JSX configuration
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    plugins: { prettier },
    extends: ["plugin:prettier/recommended"],
    rules: {
      "prettier/prettier": ["warn", { endOfLine: "auto" }],
    },

    extends: [
      js.configs.recommended,
      pluginReact.configs.flat.recommended,
    ],
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "react/prop-types": "off",
      "no-undef": "error",
    },
  },

  // disable prop-type linting for UI component files specifically
  {
    files: ["src/components/ui/**/*.jsx"],
    rules: {
      "react/prop-types": "off",
    },
  },

  // JSON
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },

  // JSONC
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    language: "json/jsonc",
    extends: ["json/recommended"],
  },

  // JSON5
  {
    files: ["**/*.json5"],
    plugins: { json },
    language: "json/json5",
    extends: ["json/recommended"],
  },

  //Markdown
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    extends: ["markdown/recommended"],
  },

  //CSS
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },

  {
    plugins: { prettier: require("eslint-plugin-prettier") },
    extends: ["plugin:prettier/recommended"],
    rules: {
      "prettier/prettier": ["warn", { endOfLine: "auto" }],
    },
  }
]);
