# Pagevelope Project Status

Updated: 16 August 2026

## Active phase

Supabase SaaS foundation — authentication boundary, workspaces, roles, tenant-isolated RLS, private originals, and audit events.

## Phase 0 — CLOSED

- Product promise and first ICP locked.
- Core stack and AI/tool ownership locked.
- GitHub repository `Abuhurerakhan0407/pagevelope` connected.
- Canonical `package-lock.json` committed.
- GitHub Actions uses locked `npm ci` installs.
- CI passes dependency audit, lint, typecheck, tests, and production build.
- Vercel project is connected with root directory `apps/web`.
- Live browser smoke test passed.
- Production secrets remain unavailable to coding agents.
- Software Factory remains disabled for production orchestration.

## Production renderer gate — CLOSED

- MJML compiler pinned to `5.4.0` and strict validation enabled.
- Controlled campaign JSON compiles to production MJML/HTML/plain text.
- Release bundle contains canonical source JSON, MJML, compiled HTML, plain text, and manifest.
- Release manifest records SHA-256 fingerprints and compiler metadata.
- Final HTML safety checks block executable markup and unsafe output.
- Legal address and Klaviyo unsubscribe requirements are preserved.
- Images-off essential-content behavior is covered by the renderer suite.
- Determinism is proven across a 20-campaign fixture matrix.
- High-severity production dependency audit is a permanent CI gate.

## Visual Builder → renderer pipeline — CLOSED

- Professional visual builder v1 is live.
- Blocks and layers map into `CampaignDocumentV1`.
- Current builder state renders through the deterministic server-side MJML release renderer.
- Production HTML can be previewed inside the builder.
- Renderer version, QA result, HTML bytes, and source fingerprint are surfaced.
- HTML fallback download is available only after a successful render.
- Edited campaigns invalidate stale rendered output.
- Publish remains fail-closed behind approval and Inbox Lab gates.
- PR #5 merged as commit `44d5f5b` with green CI and successful Vercel deployment.

## Supabase tenant foundation — IN PROGRESS

Authored on an isolated branch, not applied to production:

- workspace roles: owner, admin, editor, reviewer, viewer;
- profiles, workspaces, memberships, brands, campaigns, immutable campaign versions, asset metadata, audit events;
- workspace-aware foreign keys and indexes;
- row-level security on every application table;
- private security-definer authorization helpers;
- last-owner protection;
- anonymous table access revoked;
- private `pagevelope-originals` Storage bucket contract;
- immutable original asset update boundary;
- static migration security-contract tests;
- migration and role/storage documentation.

## Current gate

Before production database connection or migration application:

- pass repository CI with the migration contract tests;
- run the migration against a disposable/local Supabase database once the Supabase CLI/project connection is available;
- add adversarial RLS tests using at least two users and two workspaces;
- verify owner/admin/editor/reviewer/viewer behavior;
- verify private Storage cross-tenant isolation;
- integrate the Next.js Supabase SSR auth client with no production secrets in source control.

Database migrations may be authored and tested by agents. **Production migration application remains human-controlled.**

## Next platform milestone

After the tenant gate is proven, connect authentication and onboarding in the web app: sign in → create/join workspace → brand setup → campaign persistence/versioning. Then connect the existing Visual Builder to real workspace data instead of demo state.
