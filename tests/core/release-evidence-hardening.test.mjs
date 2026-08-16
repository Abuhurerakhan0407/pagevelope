import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260816223500_release_evidence_hardening.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("passing inbox evidence requires an HTTPS evidence URL at the database boundary", () => {
  assert.match(normalized, /inbox_pass_requires_evidence/);
  assert.match(normalized, /status = 'fail'::public\.inbox_check_status or evidence_url is not null/);
  assert.match(normalized, /passing inbox evidence requires an https evidence url/);
  assert.match(normalized, /clean_url !~ '\^https:\/\/'/);
});

test("evidence attempts get distinct check timestamps and audit metadata", () => {
  assert.match(normalized, /clock_timestamp\(\)/);
  assert.match(normalized, /campaign\.inbox_evidence\.recorded/);
  assert.match(normalized, /'has_evidence_url'/);
});
