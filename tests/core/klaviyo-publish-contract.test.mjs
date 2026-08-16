import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../../apps/web/lib/klaviyo/config.ts", import.meta.url), "utf8");
const oauth = readFileSync(new URL("../../apps/web/lib/klaviyo/oauth.ts", import.meta.url), "utf8");
const cryptoSource = readFileSync(new URL("../../apps/web/lib/klaviyo/crypto.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../../apps/web/lib/klaviyo/client.ts", import.meta.url), "utf8");
const templates = readFileSync(new URL("../../apps/web/lib/klaviyo/templates.ts", import.meta.url), "utf8");
const publishRoute = readFileSync(new URL("../../apps/web/app/api/releases/[candidateId]/publish/klaviyo/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20260816230000_klaviyo_publish_foundation.sql", import.meta.url), "utf8");
const secureStore = readFileSync(new URL("../../supabase/migrations/20260816230100_klaviyo_credentials_server_store.sql", import.meta.url), "utf8");

const normalizedMigration = `${migration}\n${secureStore}`.replace(/--.*$/gm, "").replace(/\s+/g, " ").toLowerCase();

test("Klaviyo integration pins the approved stable API revision and OAuth hosts", () => {
  assert.match(config, /KLAVIYO_API_REVISION = "2026-07-15"/);
  assert.match(config, /KLAVIYO_API_BASE = "https:\/\/a\.klaviyo\.com"/);
  assert.match(config, /KLAVIYO_AUTHORIZE_URL = "https:\/\/www\.klaviyo\.com\/oauth\/authorize"/);
  assert.match(config, /KLAVIYO_TOKEN_URL = "https:\/\/a\.klaviyo\.com\/oauth\/token"/);
});

test("OAuth uses PKCE S256 and the narrow Pagevelope publishing scopes", () => {
  assert.match(oauth, /code_challenge_method", "S256"/);
  assert.match(oauth, /createHash\("sha256"\)/);
  for (const scope of ["accounts:read", "templates:read", "templates:write", "campaigns:read", "campaigns:write"]) {
    assert.match(config, new RegExp(`"${scope.replace(":", "\\:")}"`));
  }
  assert.doesNotMatch(config, /lists:write|profiles:write|events:write|segments:write/);
});

test("OAuth credentials remain server-only and encrypted with authenticated encryption", () => {
  for (const name of ["KLAVIYO_CLIENT_SECRET", "KLAVIYO_TOKEN_ENCRYPTION_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    assert.match(config, new RegExp(`process\\.env\\.${name}`));
    assert.doesNotMatch(config, new RegExp(`NEXT_PUBLIC_${name}`));
  }
  assert.match(cryptoSource, /aes-256-gcm/);
  assert.match(cryptoSource, /randomBytes\(IV_BYTES\)/);
  assert.match(cryptoSource, /getAuthTag/);
  assert.match(cryptoSource, /setAuthTag/);
});

test("encrypted credential rows have no browser role grants", () => {
  assert.match(normalizedMigration, /alter table public\.integration_credentials_secure enable row level security/);
  assert.match(normalizedMigration, /revoke all on public\.integration_credentials_secure from public, anon, authenticated/);
  assert.doesNotMatch(normalizedMigration, /grant select on public\.integration_credentials_secure to authenticated/);
});

test("Klaviyo template publishing is CODE HTML/text and retry-safe", () => {
  assert.match(client, /editor_type: "CODE"/);
  assert.match(client, /html: input\.html/);
  assert.match(client, /text: input\.text/);
  assert.match(templates, /findCodeTemplateByName/);
  assert.match(templates, /updateCodeTemplate/);
  assert.match(templates, /upsertCodeTemplate/);
});

test("publishing requires the current approved immutable release evidence", () => {
  assert.match(publishRoute, /campaign\.status !== "approved"/);
  assert.match(publishRoute, /campaign\.current_version_number !== candidate\.version_number/);
  assert.match(publishRoute, /version\.source_sha256 !== candidate\.source_sha256/);
  assert.match(publishRoute, /release\.manifest\.sourceFingerprint !== candidate\.source_sha256/);
  assert.match(publishRoute, /generatedManifestSha !== candidate\.manifest_sha256/);
});

test("publish handoff can assign an existing campaign message but never sends the campaign", () => {
  assert.match(client, /\/api\/campaign-message-assign-template/);
  assert.match(publishRoute, /campaignMessageId/);
  assert.doesNotMatch(client, /campaign-send-jobs/);
  assert.doesNotMatch(publishRoute, /campaign-send-jobs/);
});

test("publish receipts are immutable, fingerprinted, tenant-scoped and audited", () => {
  assert.match(normalizedMigration, /unique \(release_candidate_id\)/);
  assert.match(normalizedMigration, /source_sha256 text not null/);
  assert.match(normalizedMigration, /manifest_sha256 text not null/);
  assert.match(normalizedMigration, /private\.can_edit_workspace\(target_workspace_id\)/);
  assert.match(normalizedMigration, /campaign\.published\.klaviyo/);
  assert.match(normalizedMigration, /revoke insert, update, delete on public\.campaign_publish_receipts from authenticated/);
});
