import globals from "globals";
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import pluginReact from "eslint-plugin-react";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    ignores: ["amplify/**"], 
    languageOptions: {
      parser: tsparser,
      globals: {
        ...globals.browser,
        ...globals.node, // Add Node.js globals (includes process.env)
      },
    },
    plugins: {
      react: pluginReact,
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...js.configs.recommended.rules, // Enable base JavaScript rules
      ...tseslint.configs.recommended.rules, // Enable TypeScript ESLint rules
      ...pluginReact.configs.recommended.rules, // Enable React rules
      "react/react-in-jsx-scope": "off", // Disable this if using Next.js
    },
  },
];
