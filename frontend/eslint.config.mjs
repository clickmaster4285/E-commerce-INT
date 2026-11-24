import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// Design tokens (src/app/globals.css `@theme inline`) — colors class names se
// nahi, tokens se: `text-success` / `bg-card` / `text-user-fg`.
// Light/dark + store theme CSS variables khud sambhalte hain.
const DARK_VARIANT = String.raw`/(^|[\s"'\x60]|:)dark:/`;
const ARBITRARY_COLOR_VAR = String.raw`/(^|[\s:])(text|bg|border|ring|outline|divide|from|via|to|fill|stroke)-\[var\(--/`;
const tokenMessage =
  "Use a design token class (e.g. text-success, bg-card, border-line, text-user-fg) instead of `dark:` pairs or `[var(--…)]` — see the token table in src/app/globals.css.";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: ["src/**/*.js"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        { selector: `Literal[value=${DARK_VARIANT}]`, message: tokenMessage },
        { selector: `TemplateElement[value.raw=${DARK_VARIANT}]`, message: tokenMessage },
        { selector: `Literal[value=${ARBITRARY_COLOR_VAR}]`, message: tokenMessage },
        { selector: `TemplateElement[value.raw=${ARBITRARY_COLOR_VAR}]`, message: tokenMessage },
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
