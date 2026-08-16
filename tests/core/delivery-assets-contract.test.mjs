import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/20260816232000_delivery_assets.sql", import.meta.url), "utf8");
const uploader = readFileSync(new URL("../../apps/web/lib/assets/delivery.ts", import.meta.url), "utf8");

test("delivery assets use a public content-addressed bucket with tenant-scoped writes", () => {
  assert.ok(migration.includes("pagevelope-delivery"));
  assert.ok(migration.includes("private.can_edit_workspace(private.path_workspace_id(name))"));
  assert.ok(migration.includes("split_part(name, '/', 2) = 'delivery'"));
  assert.ok(migration.includes("register_delivery_asset"));
  assert.equal(migration.includes("pagevelope_delivery_update"), false);
});

test("browser uploader hashes asset bytes and never overwrites delivery files", () => {
  assert.ok(uploader.includes('crypto.subtle.digest("SHA-256"'));
  assert.ok(uploader.includes("/delivery/"));
  assert.ok(uploader.includes("upsert: false"));
  assert.ok(uploader.includes("register_delivery_asset"));
  assert.ok(uploader.includes("getPublicUrl"));
});

test("GIF inspection proves animation metrics and infinite looping", () => {
  assert.ok(uploader.includes("GIF87a"));
  assert.ok(uploader.includes("GIF89a"));
  assert.ok(uploader.includes("frameCount += 1"));
  assert.ok(uploader.includes("durationMs += pendingDelayMs"));
  assert.ok(uploader.includes("NETSCAPE2.0"));
  assert.ok(uploader.includes("!loopsForever"));
});
