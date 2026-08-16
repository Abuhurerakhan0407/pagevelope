# Supabase Tenant Foundation

Status: **authored and CI-reviewed, not applied to production**.

Pagevelope uses Supabase as the tenant data, authentication, and private asset foundation. The database authorization boundary is workspace membership plus row-level security (RLS), not client-side checks.

## Migration

`supabase/migrations/20260816170000_tenant_foundation.sql`

The first migration creates:

- `profiles`
- `workspaces`
- `workspace_memberships`
- `brands`
- `campaigns`
- append-only `campaign_versions`
- asset metadata in `assets`
- append-only `audit_events`
- private Storage bucket `pagevelope-originals`

The migration also creates workspace-scoped RLS helpers in the non-exposed `private` schema, protects the last workspace owner from accidental removal, and scopes original asset paths by workspace UUID.

## Role matrix

| Capability | Owner | Admin | Editor | Reviewer | Viewer |
| --- | --- | --- | --- | --- | --- |
| Read workspace data | Yes | Yes | Yes | Yes | Yes |
| Create/edit brands and campaigns | Yes | Yes | Yes | No | No |
| Append campaign versions | Yes | Yes | Yes | No | No |
| Upload private originals | Yes | Yes | Yes | No | No |
| Delete brands/campaigns/assets | Yes | Yes | No | No | No |
| Read audit stream | Yes | Yes | No | No | No |
| Manage non-owner memberships | Yes | Yes | No | No | No |
| Grant/remove owner role | Yes | No | No | No | No |
| Delete workspace | Yes | No | No | No | No |

A workspace must always retain at least one owner.

## Storage contract

Original asset object names must begin with the workspace UUID:

```text
<workspace_uuid>/<brand-or-campaign-scope>/<file>
```

The `pagevelope-originals` bucket is private. Authenticated members may read originals, editors or above may upload, and admins or owners may delete. There is intentionally no authenticated UPDATE policy for original objects.

Initial upload limit: 25 MB per object. Initial allowed MIME types: JPEG, PNG, WebP, GIF, and MP4.

## Security boundary

- Anonymous access to application tables is explicitly revoked.
- Application-table RLS policies target `authenticated` users.
- Authorization comes from `workspace_memberships`.
- User metadata may populate display information only; it is not an authorization source.
- Cross-workspace references are constrained with workspace-aware foreign keys where relevant.
- Campaign versions and audit events are append-only through authenticated application access.
- Security-definer authorization helpers live in the `private` schema with an empty `search_path`.
- Production service-role credentials must never be exposed to the browser.

## Verification

Current CI runs the static migration contract test with the rest of the core suite:

```bash
npm test
```

Once the Supabase CLI/local stack is connected, the required database gate is:

```bash
supabase start
supabase db reset
supabase test db
```

That future gate must include adversarial RLS tests proving that users cannot read, mutate, or upload into another workspace.

## Production application

Coding agents may author and test migrations. Applying this migration to the production Supabase project is a human-controlled action.

Before production application:

1. Run the migration against a disposable/local Supabase database.
2. Run cross-tenant RLS tests for every role.
3. Verify Storage policies with two separate workspaces and users.
4. Inspect the generated schema diff.
5. Take/confirm the appropriate production backup or rollback point.
6. Apply only after the database gate is green.

## Rollback

This foundation migration intentionally has no automatic destructive down migration. If rollback is required before launch, use a reviewed manual rollback plan against a disposable environment first. Never drop production tenant tables or buckets automatically.
