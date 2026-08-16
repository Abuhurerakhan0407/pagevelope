# Pagevelope

Creative-production operating system for Shopify/Klaviyo agencies and D2C lifecycle teams.

**Promise:** turn a product drop into a studio-grade Klaviyo campaign with safe motion, inbox testing, approvals, and controlled publishing.

## Current build state

Foundation plus deterministic renderer spike. The spike validates versioned campaign JSON, maps controlled components to MJML, generates plain text, runs initial preflight QA, and proves deterministic output using dependency-free core tests.

It does **not** yet prove final MJML-compiled HTML or inbox rendering.

## Commands

```bash
npm install
npm run dev
npm run verify
```

When package installation is unavailable, `npm run core:test` can still exercise the repository's dependency-free renderer proof if `tsc` is available globally.
