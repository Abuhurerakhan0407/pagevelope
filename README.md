# Pagevelope

Creative-production software for Shopify/Klaviyo agencies and ecommerce teams.

Pagevelope turns selected Shopify products into controlled email campaign assets: constrained visual authoring, deterministic MJML/HTML/text rendering, email-safe motion, immutable review evidence, explicit single-recipient test delivery, and approved Klaviyo template publishing. Campaign sending remains in Klaviyo; Pagevelope is not bulk-email infrastructure.

## Current state

Launch hardening and controlled-pilot verification. The application is implemented but not paid-launch ready. See [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) for current evidence, blockers, and the exact recovered stopping point.

## Local verification

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm run verify
npx playwright install chromium
npm run e2e
```

Database migration replay and adversarial RLS tests run in the Database CI workflow against a disposable local Supabase stack. Never infer production migration parity from CI.
