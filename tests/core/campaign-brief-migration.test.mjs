import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260816202000_campaign_brief_directions.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("campaign brief migration is transactional and adds the workflow gate", () => {
  assert.match(normalized, /^begin;/);
  assert.match(normalized, /alter table public\.campaigns/);
  for (const column of [
    "campaign_system",
    "brief_goal",
    "brief_audience",
    "brief_offer",
    "brief_tone",
    "brief_motion_level",
    "creative_directions",
    "selected_direction_key",
    "brief_completed_at",
  ]) {
    assert.match(normalized, new RegExp(`add column ${column}`));
  }
  assert.match(normalized, /commit;$/);
});

test("only the five approved campaign systems and three direction keys are accepted", () => {
  for (const system of [
    "product-launch",
    "collection-editorial",
    "restock-waitlist",
    "limited-offer",
    "lifecycle-reminder",
  ]) {
    assert.match(normalized, new RegExp(system));
  }
  for (const direction of ["editorial", "product", "motion"]) {
    assert.match(normalized, new RegExp(`'${direction}'`));
  }
  assert.match(normalized, /jsonb_array_length\(creative_directions\) in \(0, 3\)/);
});

test("brief and direction RPCs are security-definer, workspace-authorized, and audited", () => {
  for (const fn of ["save_campaign_brief", "select_campaign_direction"]) {
    const pattern = new RegExp(
      `create or replace function public\\.${fn}\\([\\s\\S]*?\\)[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
      "i",
    );
    assert.match(sql, pattern);
  }
  assert.match(normalized, /private\.can_edit_workspace\(target_workspace_id\)/);
  assert.match(normalized, /campaign\.brief\.saved/);
  assert.match(normalized, /campaign\.direction\.selected/);
  assert.match(normalized, /revoke all on function public\.save_campaign_brief/);
  assert.match(normalized, /grant execute on function public\.save_campaign_brief/);
  assert.match(normalized, /revoke all on function public\.select_campaign_direction/);
  assert.match(normalized, /grant execute on function public\.select_campaign_direction/);
});

test("direction selection fails closed until a completed brief contains that direction", () => {
  assert.match(normalized, /c\.status = 'draft'::public\.campaign_status/);
  assert.match(normalized, /c\.brief_completed_at is not null/);
  assert.match(normalized, /jsonb_array_elements\(c\.creative_directions\)/);
  assert.match(normalized, /where direction ->> 'key' = clean_key/);
  assert.match(normalized, /campaign brief is incomplete or campaign is unavailable/);
});
