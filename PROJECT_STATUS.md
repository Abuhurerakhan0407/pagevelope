# Pagevelope Project Status

Updated: 29 August 2026

## Actual phase

**Launch hardening and controlled-pilot verification. Pagevelope is not paid-launch ready.**

Last merged milestone: PR #47, `release: integrate Pagevelope launch stack`, commit `6a58722580b869505aa949b4d46da9e4862f4006`, merged and deployed on 18 August 2026.

Last recovered workflow stopping point: review opened after two immutable campaign versions. The next product milestone remains one controlled real-asset release through provider-confirmed test delivery, real Gmail/Apple Mail/Outlook evidence, human approval, and one Klaviyo template publish receipt.

## Current verified evidence

- Repository main and the current Vercel production deployment both identify commit `6a58722580b869505aa949b4d46da9e4862f4006`.
- Vercel deployment `dpl_ygtJzEj7AC3Fot6CMWFWn6XQu8eB` reports `READY`; public home, sign-in, and pricing routes return HTTP 200.
- No grouped Vercel runtime errors were reported for the latest seven-day query. This does not prove authenticated product health or active monitoring.
- A clean local install, production dependency audit, warning-free lint, typecheck, 160 core tests, and production build pass on 29 August.
- E2E server startup works with an explicit loopback hostname. Browser assertions remain unexecuted locally because Playwright Chromium download timed out; CI now installs Chromium and runs the E2E suite.
- Supabase project `pagevelope-prod` (`xubqggfqezjeewnfkfzh`) reports `INACTIVE`. Migration listing times out, so production health and migration parity are unknown.

## Implemented and preserved

- Deterministic MJML/HTML/text release rendering with source and manifest fingerprints.
- Tenant-scoped workspaces, brands, products, campaigns, immutable versions, release candidates, evidence, approvals, audit events, and provider receipts.
- Shopify read-only product ingestion with encrypted offline credentials.
- Email-safe motion assets with measured GIF evidence and static fallbacks.
- Explicit single-recipient Resend test delivery only; Pagevelope is not bulk-email infrastructure.
- Controlled Klaviyo template publishing after release gates; campaign sending remains in Klaviyo.
- Razorpay subscription integration and workspace billing UI.

## Hardening authored after audit

The current review branch adds migration `20260829083947_launch_security_hardening.sql`. It is not applied anywhere.

- Removes authenticated insert/update/delete access to subscription state.
- Enforces paid active access at the shared workspace edit boundary.
- Preserves access through a paid cancellation period.
- Fixes Razorpay end-of-period cancellation and status normalization.
- Rejects unknown Razorpay plans instead of granting Pro access.
- Adds a separate owner-controlled billing launch switch.
- Makes analytics actor identity server-verified, tenant-scoped, append-only, and runtime validated.
- Removes duplicate analytics emissions found in the launch merge.
- Adds database security tests and expands application regression tests.
- Removes unsupported free-tier, trial, automated inbox-testing, refund, and security claims from local marketing/legal copy.

## Unresolved launch blockers

1. Restore or otherwise make Supabase accessible, then identify why it became inactive.
2. Reconcile all 20 historical repository migrations against production before reviewing the new hardening migration as migration 21.
3. Run disposable-database migration replay and new billing/analytics RLS tests in CI.
4. Confirm all required production environment values by name and scope without exposing their values.
5. Obtain owner/legal approval for pricing, refunds, contracting entity, privacy terms, and the paid-launch switch.
6. Verify Razorpay checkout, webhook replay/idempotency behavior, entitlement activation, cancellation, and period-end access in a test account.
7. Complete the controlled pilot using real assets and preserve receipts for Resend delivery, three real inbox clients, approval, and Klaviyo template publication.
8. Add and verify active production monitoring/alert ownership. Absence of recent Vercel errors is not monitoring evidence.

## Prohibited shortcuts

- Do not apply migration 21 until production migration parity is known.
- Do not enable paid checkout until legal/commercial approval and test-mode billing evidence exist.
- Do not treat browser screenshots as inbox-client evidence.
- Do not publish or send without the immutable approval chain.
- Do not add bulk sending to Pagevelope.
