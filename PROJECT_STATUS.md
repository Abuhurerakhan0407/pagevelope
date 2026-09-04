# Pagevelope Project Status

Updated: 4 September 2026

## Actual phase

**Launch hardening and controlled-pilot verification. Pagevelope is not paid-launch ready.**

Last merged milestone: PR #47, `release: integrate Pagevelope launch stack`, commit `6a58722580b869505aa949b4d46da9e4862f4006`, merged and deployed on 18 August 2026.

Current hardening work: draft PR #48, branch `audit/launch-hardening-20260829`. Before this update its tested head was `4383bf60d2b0033a43fba4c173605a71203d4e46`.

Last recovered workflow stopping point: review opened after two immutable campaign versions. The next product milestone remains one controlled real-asset release through provider-confirmed test delivery, real Gmail/Apple Mail/Outlook evidence, human approval, and one Klaviyo template publish receipt.

## Current verified evidence

- Repository `main` remains `6a58722580b869505aa949b4d46da9e4862f4006`.
- Current production Vercel deployment remains on PR #47/main and reports `READY`.
- PR #48 preview deployment reports `READY`.
- Vercel reported no grouped runtime errors in the latest seven-day check on 4 September 2026.
- PR #48 Application CI #180 passed dependency audit, lint, typecheck, 160 core tests, production build, Chromium E2E.
- PR #48 Database CI #92 passed fresh migration application, full replay, and adversarial RLS/database security tests.
- Repository contains 20 historical production migrations plus one new PR #48 hardening migration, `20260829083947_launch_security_hardening.sql`.
- Supabase project `pagevelope-prod` (`xubqggfqezjeewnfkfzh`) remains `INACTIVE`.
- A restore attempt on 4 September 2026 was rejected because the Supabase organization has already reached its two-active-free-project limit. This is now the exact reason production cannot be restored on the current free allocation.

## Implemented and preserved

- Deterministic MJML/HTML/text release rendering with source and manifest fingerprints.
- Tenant-scoped workspaces, brands, products, campaigns, immutable versions, release candidates, evidence, approvals, audit events, and provider receipts.
- Shopify read-only product ingestion with encrypted offline credentials.
- Email-safe motion assets with measured GIF evidence and static fallbacks.
- Explicit single-recipient Resend test delivery only; Pagevelope is not bulk-email infrastructure.
- Controlled Klaviyo template publishing after release gates; campaign sending remains in Klaviyo.
- Razorpay subscription integration and workspace billing UI.

## Hardening authored after audit

PR #48 adds migration `20260829083947_launch_security_hardening.sql`. It must remain unapplied until production migration parity is known.

- Removes authenticated insert/update/delete access to subscription state.
- Enforces paid active access at the shared workspace edit boundary.
- Preserves access through a paid cancellation period.
- Fixes Razorpay end-of-period cancellation and status normalization.
- Rejects unknown Razorpay plans instead of granting Pro access.
- Adds a separate owner-controlled billing launch switch.
- Makes analytics actor identity server-verified, tenant-scoped, append-only, and runtime validated.
- Removes duplicate analytics emissions found in the launch merge.
- Adds database security tests and expands application regression tests.
- Removes unsupported free-tier, trial, automated inbox-testing, refund, and security claims.

## Current execution blocker

Production reconciliation cannot proceed until one Supabase active-project slot is available. The two currently active projects are `madarsa-erp` and `shalcon-intelligence`. Do not pause either project without owner authorization.

After a slot is available:

1. Restore `pagevelope-prod`.
2. List production migration history and reconcile it against the 20 historical repo migrations.
3. Inspect production schema/data assumptions and take the required safety checks before migration 21.
4. Apply migration 21 only if parity is exact and the migration is safe for existing production state.
5. Run Supabase security/performance advisors and production database smoke checks.
6. Re-run PR #48 CI/E2E if the branch changed, then merge only after production reconciliation passes.
7. Verify production deployment SHA and authenticated product health.
8. Verify Razorpay in test mode and then perform the controlled real-provider pilot.

## Owner-only / external gates after infrastructure recovery

- Confirm pricing, refund/cancellation terms, contracting identity and privacy/legal details.
- Keep `BILLING_LAUNCH_ENABLED=false` until commercial/legal approval and test-mode billing evidence exist.
- Provide/authorize real provider accounts or credentials when required for Shopify, Klaviyo, Resend and Razorpay validation.
- Provide real Gmail, Apple Mail and Outlook evidence for the controlled pilot.

## Prohibited shortcuts

- Do not apply migration 21 until production migration parity is known.
- Do not merge PR #48 merely because CI is green; production reconciliation must pass first.
- Do not enable paid checkout until legal/commercial approval and test-mode billing evidence exist.
- Do not treat browser screenshots as inbox-client evidence.
- Do not publish or send without the immutable approval chain.
- Do not add bulk sending to Pagevelope.
