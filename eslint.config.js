// @ts-check
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", "node_modules/", "assets/"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.tools.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Чистая логика: без DOM, рендера, UI и платформы — её можно тестировать и запускать где угодно.
    files: ["src/core/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/engine/**",
                "**/ui/**",
                "**/platform/**",
                "**/game/**",
                "**/i18n/**",
                "preact",
                "preact/*",
              ],
              message: "src/core не зависит от рендера, UI, платформы и приложения.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "navigator",
        "requestAnimationFrame",
      ],
    },
  },
  {
    // Слой данных и словари не знают ни о чём, кроме себя.
    files: ["src/data/**", "src/i18n/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/engine/**",
                "**/ui/**",
                "**/platform/**",
                "**/game/**",
                "preact",
                "preact/*",
              ],
              message: "Данные и словари — листовые модули без зависимостей от приложения.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
);
