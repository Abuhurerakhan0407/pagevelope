# Pagevelope Project Status

Updated: 17 August 2026

## Active phase

**Pilot activation — production Supabase is live; external credentials and real-provider evidence remain.**

The MVP code and production database foundation are active. Remaining work is production environment configuration for the deployed app, external provider authorization, and one controlled end-to-end pilot through real inbox evidence and Klaviyo publishing.

## Repository and delivery foundation — CLOSED

- GitHub repository `Abuhurerakhan0407/pagevelope` is the source of truth.
- Canonical `package-lock.json` is committed and CI uses locked `npm ci` installs.
- CI permanently runs production dependency audit, lint, typecheck, tests and production build.
- Database CI applies every migration to a disposable Supabase database, replays from scratch and runs adversarial RLS tests.
- Vercel project is connected with root directory `apps/web`.
- Main application CI, database CI and Vercel deployment are green after the provider-write hardening merge.

## Production renderer — CLOSED

- MJML compiler pinned to `5.4.0` with strict validation.
- Controlled campaign JSON compiles to deterministic MJML, HTML and plain text.
- Release bundle contains canonical source JSON, MJML, HTML, plain text and manifest.
- SHA-256 fingerprints and compiler metadata are recorded.
- Final HTML safety checks block executable markup and unsafe output.
- Legal address, unsubscribe, images-off essentials and link-safety behavior are covered.
- Determinism is proven across the 20-campaign fixture matrix.
- High-severity production dependency audit is a permanent CI gate.

## SaaS / tenant foundation — LIVE IN PRODUCTION

- Production Supabase project `pagevelope-prod` is active.
- All 17 current production migrations are applied successfully.
- Supabase SSR authentication boundary is implemented.
- Workspace onboarding and membership roles: owner, admin, editor, reviewer, viewer.
- Tenant-isolated RLS and adversarial two-workspace tests are green.
- Brands and brand profile data are persisted tenant-safely.
- Campaign brief and creative-direction workflow is persisted.
- Immutable campaign versions use optimistic concurrency.
- Private original-asset storage contract is live.
- Public content-addressed delivery storage is live for recipient-safe derived assets.
- Audit events and last-owner protection are live.
- Live verification confirms expected public tables have RLS enabled.
- Production currently contains no customer workspace/campaign/product/publish-receipt data.

## Products and Shopify — CLOSED IN CODE / DATABASE LIVE

- Manual product catalog and campaign product selection.
- Shopify OAuth authorization-code integration.
- Strict `*.myshopify.com` validation, callback state/HMAC verification and encrypted offline tokens.
- Least-privilege `read_products` scope.
- Admin GraphQL product import with pagination and retry-safe external identities.
- Shopify catalog sync preserves manual products and tenant isolation.
- Provider-confirmed Shopify writes are service-role only; authenticated browser clients cannot forge Shopify-sourced products directly through RPC.
- No Shopify customer/order/write scopes are used.

## Visual Builder — CLOSED

- Professional constrained 600px email builder.
- Builder blocks map into versioned `CampaignDocumentV1` source.
- Desktop/mobile/images-off preview states.
- Current builder state renders through the deterministic server-side renderer.
- Successful renders surface renderer version, QA result, HTML bytes and source fingerprint.
- HTML fallback download remains gated behind a successful render.
- Stale rendered output is invalidated after edits.

## Motion Studio — CLOSED IN CODE

- Dedicated Motion Studio for persisted campaign versions.
- Supports header, hero, image, product and column media targets.
- Direct animated-GIF upload instead of manual URL/metric entry.
- Direct separate first-frame upload for Outlook/static fallback.
- Optional MP4 browser-preview asset.
- Content-addressed SHA-256 public delivery assets while originals remain private.
- GIF byte inspection derives frame count, duration and infinite-loop proof.
- 2 MB warning and 5 MB hard release block.
- Read-only measured motion evidence.
- Removing motion promotes the proven first frame to the production static image.
- Motion edits create new immutable campaign versions.

## Release review / Inbox boundary — CLOSED IN CODE / DATABASE LIVE

- Release candidates bind the exact campaign version, renderer evidence and manifest fingerprints.
- Release generation fails closed on blocking QA.
- Review workflow preserves immutable approval requirements.
- Inbox evidence is represented as a release gate and cannot be silently treated as Playwright/browser evidence.
- Real mailbox/client evidence is still required before a real production release is approved.

## Test send — CLOSED IN CODE / DATABASE LIVE

- Explicit single-recipient test-send boundary exists.
- Resend is limited to test/transactional delivery, not campaign sending infrastructure.
- Test-send behavior is tied to the immutable release candidate and approval pipeline.
- Positive approval requires a provider-confirmed successful test delivery.
- Real Resend credentials and one controlled real delivery are still required for pilot evidence.

## Klaviyo publish — CLOSED IN CODE / DATABASE LIVE

- Klaviyo OAuth connection metadata and encrypted server-side credential storage.
- Approved/current release is reverified immediately before publishing.
- Pagevelope creates production CODE-template content and records immutable publish receipts.
- Receipt records provider IDs plus source/manifest fingerprints.
- Provider-confirmed Klaviyo receipt writes are service-role only; authenticated browser clients cannot forge publish completion through RPC.
- Publish fails closed when connection, approval, candidate freshness or environment configuration is missing.
- Pagevelope does not call the Klaviyo campaign-send endpoint; sending remains in Klaviyo.

## Production security verification — PASSED

- Authenticated users cannot execute the legacy Klaviyo publish-receipt RPC.
- Authenticated users cannot execute the legacy Shopify sync RPC.
- Authenticated users cannot execute either new server-only provider completion RPC.
- `service_role` can execute the new server-only Shopify and Klaviyo completion RPCs.
- Supabase security advisor no longer reports the Shopify sync or Klaviyo publish completion RPCs as authenticated `SECURITY DEFINER` functions.
- The credentials table intentionally has RLS enabled with no authenticated policy and no authenticated table grants; it is server/service-role storage only.

## Remaining pilot activation work — HUMAN / EXTERNAL

1. Configure production Vercel environment values. The connected Vercel tool currently exposes deployment inspection but no environment-variable write action, so this is the immediate human-only boundary.
2. Configure Supabase public URL/publishable key for the web app, plus server-only provider values as each integration is activated.
3. Authorize one real Shopify development/pilot store and sync products.
4. Authorize one real Klaviyo account.
5. Configure Resend and execute one real single-recipient test send.
6. Capture real inbox-client evidence for Gmail Web, Apple Mail and Outlook Windows.
7. Approve the exact immutable candidate and perform one controlled Klaviyo publish.
8. Verify the immutable release receipt and perform final browser/pilot smoke testing.

## Current completion estimate

**~97% pilot-ready.**

The remaining work is primarily production environment values, external OAuth/provider authorization, real mailbox evidence and the first controlled pilot publish. The production database, tenant boundary, release gates and provider-write trust boundary are already live and verified.
