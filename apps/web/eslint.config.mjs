import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/builder/motion/motion-studio.tsx"],
    rules: {
      // Motion Studio loads an authenticated remote campaign and intentionally derives
      // its loading/error state from that external fetch lifecycle.
      "react-hooks/set-state-in-effect": "off",
      // Preview URLs are user/Shopify/CDN assets with arbitrary hosts; forcing next/image
      // would require an unsafe wildcard image allowlist and does not improve email output.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts"
  ])
]);
