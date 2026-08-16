import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260816170000_tenant_foundation.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").toLowerCase();

const applicationTables = [
  "profiles",
  "workspaces",
  "workspace_memberships",
  "brands",
  "campaigns",
  "campaign_versions",
  "assets",
  "audit_events",
];

test("tenant tables are protected by RLS and anonymous access is revoked", () => {
  for (const table of applicationTables) {
    assert.match(normalized, new RegExp(`alter table public\\.${table} enable row level security;`));
    assert.match(normalized, new RegExp(`revoke all on public\\.${table} from anon;`));
  }
});

test("all application policies target authenticated users only", () => {
  const policies = [...normalized.matchAll(/create policy [^;]+;/g)].map((match) => match[0]);
  assert.ok(policies.length >= 20, "expected a complete policy set");

  for (const policy of policies) {
    assert.match(policy, / to authenticated /, `policy missing authenticated target: ${policy}`);
    assert.doesNotMatch(policy, / to anon /, `policy unexpectedly targets anon: ${policy}`);
  }
});

test("authorization helpers live in the private schema and use security definer", () => {
  for (const helper of [
    "workspace_role_for",
    "is_workspace_member",
    "can_edit_workspace",
    "can_admin_workspace",
    "is_workspace_owner",
  ]) {
    const pattern = new RegExp(
      `create or replace function private\\.${helper}\\([^)]*\\)[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
      "i",
    );
    assert.match(sql, pattern);
  }

  assert.match(normalized, /workspace_memberships_user_idx on public\.workspace_memberships\(user_id, workspace_id\)/);
  assert.match(normalized, /wm\.user_id = \(select auth\.uid\(\)\)/);
});

test("immutable records do not receive update or delete policies", () => {
  assert.doesNotMatch(normalized, /create policy [^;]+ on public\.campaign_versions for update/);
  assert.doesNotMatch(normalized, /create policy [^;]+ on public\.campaign_versions for delete/);
  assert.doesNotMatch(normalized, /create policy [^;]+ on public\.audit_events for update/);
  assert.doesNotMatch(normalized, /create policy [^;]+ on public\.audit_events for delete/);
  assert.doesNotMatch(normalized, /create policy pagevelope_originals_[^;]+ on storage\.objects for update/);
});

test("workspace ownership cannot be accidentally removed", () => {
  assert.match(normalized, /create trigger workspace_memberships_keep_owner before update of role or delete on public\.workspace_memberships/);
  assert.match(normalized, /raise exception 'a workspace must keep at least one owner\.'/);
  assert.doesNotMatch(normalized, /return coalesce\(new, old\)/);
});

test("original asset storage is private and workspace scoped", () => {
  assert.match(normalized, /'pagevelope-originals', 'pagevelope-originals', false, 26214400/);
  assert.match(normalized, /private\.path_workspace_id\(name\)/);
  assert.match(normalized, /pagevelope_originals_select_member on storage\.objects for select to authenticated/);
  assert.match(normalized, /pagevelope_originals_insert_editor on storage\.objects for insert to authenticated/);
  assert.match(normalized, /pagevelope_originals_delete_admin on storage\.objects for delete to authenticated/);
});

test("migration is transactional and marked as not production-applied", () => {
  assert.match(sql, /IMPORTANT: authoring this migration does not apply it to production\./);
  assert.match(normalized, /^ begin;/);
  assert.match(normalized, / commit;$/);
});
