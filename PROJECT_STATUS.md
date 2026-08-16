# Pagevelope Project Status

Updated: 17 August 2026

## Active phase

**Pilot activation — code-complete MVP, external production setup still required.**

The remaining work is no longer broad feature development. It is the controlled activation of real Supabase, Resend, Shopify and Klaviyo environments, followed by real inbox/test-send/publish evidence.

## Repository and delivery foundation — CLOSED

- GitHub repository `Abuhurerakhan0407/pagevelope` is the source of truth.
- Canonical `package-lock.json` is committed and CI uses locked `npm ci` installs.
- CI permanently runs production dependency audit, lint, typecheck, tests and production build.
- Database CI applies every migration to a disposable Supabase database, replays from scratch and runs adversarial RLS tests.
- Vercel project is connected with root directory `apps/web`.
- Earlier live browser smoke testing passed. Current Vercel preview/production rebuilds are temporarily blocked by the account build-rate limit, not by application CI.

## Production renderer — CLOSED

- MJML compiler pinned to `5.4.0` with strict validation.
- Controlled campaign JSON compiles to deterministic MJML, HTML and plain text.
- Release bundle contains canonical source JSON, MJML, HTML, plain text and manifest.
- SHA-256 fingerprints and compiler metadata are recorded.
- Final HTML safety checks block executable markup and unsafe output.
- Legal address, unsubscribe, images-off essentials and link-safety behavior are covered.
- Determinism is proven across the 20-campaign fixture matrix.
- High-severity production dependency audit is a permanent CI gate.

## SaaS / tenant foundation — CLOSED IN CODE

- Supabase SSR authentication boundary.
- Workspace onboarding and membership roles: owner, admin, editor, reviewer, viewer.
- Tenant-isolated RLS and adversarial two-workspace tests.
- Brands and brand profile data.
- Campaign brief and creative-direction workflow.
- Immutable campaign versions with optimistic concurrency.
- Private original-asset storage contract.
- Audit events and last-owner protection.
- Production migrations are authored and repeatedly validated in disposable CI databases.

**Production migration application remains an explicit human-controlled action.**

## Products and Shopify — CLOSED IN CODE

- Manual product catalog and campaign product selection.
- Shopify OAuth authorization-code integration.
- Strict `*.myshopify.com` validation, callback state/HMAC verification and encrypted offline tokens.
- Least-privilege `read_products` scope.
- Admin GraphQL product import with pagination and retry-safe external identities.
- Shopify catalog sync preserves manual products and tenant isolation.
- Pagination remains available after product-catalog refresh.
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

## Release review / Inbox boundary — CLOSED IN CODE

- Release candidates bind the exact campaign version, renderer evidence and manifest fingerprints.
- Release generation fails closed on blocking QA.
- Review workflow preserves immutable approval requirements.
- Inbox evidence is represented as a release gate and cannot be silently treated as Playwright/browser evidence.
- Real mailbox/client evidence is still required during pilot activation before a real production release is approved.

## Test send — CLOSED IN CODE

- Explicit single-recipient test-send boundary exists.
- Resend is limited to test/transactional delivery, not campaign sending infrastructure.
- Test-send behavior is tied to the release candidate and approval pipeline.
- Real provider credentials and one real test delivery are still required for pilot evidence.

## Klaviyo publish — CLOSED IN CODE

- Klaviyo OAuth connection metadata and encrypted server-side credential storage.
- Approved/current release is reverified immediately before publishing.
- Pagevelope creates production CODE-template content and records immutable publish receipts.
- Receipt records provider IDs plus source/manifest fingerprints.
- Publish fails closed when connection, approval, candidate freshness or environment configuration is missing.
- Pagevelope does not call the Klaviyo campaign-send endpoint; sending remains in Klaviyo.

## Remaining pilot activation work — HUMAN / EXTERNAL

1. Create/connect the production Supabase project and apply the already-tested migrations.
2. Configure production-only environment values in Vercel for Supabase, Resend, Shopify and Klaviyo. No secret is committed to GitHub.
3. Authorize one real Shopify development/pilot store and sync products.
4. Authorize one real Klaviyo account.
5. Verify one real content-addressed image/GIF delivery asset from production Supabase Storage.
6. Execute one real Resend test-send to a controlled recipient.
7. Capture real inbox-client evidence for the pilot campaign and record it in the release workflow.
8. Approve the exact immutable candidate and perform one controlled Klaviyo publish.
9. Verify the immutable release receipt and perform final browser/pilot smoke testing.

## Current completion estimate

**~95% pilot-ready.**

The remaining ~5% is primarily external account provisioning, production secrets/authorization, production database activation, real mailbox evidence and the first controlled customer/pilot publish. Those boundaries intentionally remain outside unattended coding-agent authority.
