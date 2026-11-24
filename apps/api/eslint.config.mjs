// @ts-check
import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "src/generated/"] },
  eslint.configs.recommended,
  // Type-aware rules: no-floating-promises, no-misused-promises, no-unsafe-* and friends.
  // These catch the bugs Node is known for, which syntax-only rules cannot see.
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "no-console": ["error", { allow: ["error"] }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  { files: ["eslint.config.mjs"], ...tseslint.configs.disableTypeChecked },
  prettier,
);
