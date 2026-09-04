import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const eventsSource = readFileSync(new URL("../../apps/web/lib/analytics/events.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../../apps/web/lib/analytics/server.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../apps/web/app/api/analytics/route.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../../supabase/migrations/20260829083947_launch_security_hardening.sql", import.meta.url), "utf8");

test("analytics events schema compiles and resolves", () => {
  assert.match(eventsSource, /ANALYTICS_EVENTS/);
  assert.match(eventsSource, /isAnalyticsEvent/);
  assert.match(eventsSource, /entries\.length > 20/);
  assert.match(routeSource, /parseAnalyticsEventPayload/);
  assert.match(routeSource, /rawBody\.length > 16_384/);
  assert.match(routeSource, /Invalid analytics event/);
});

test("analytics actor identity comes from verified server auth", () => {
  assert.match(serverSource, /supabase\.auth\.getUser\(\)/);
  assert.match(serverSource, /user_id: user\.id/);
  assert.doesNotMatch(serverSource, /payload\.userId/);
});

test("analytics writes are append-only and tenant scoped", () => {
  assert.match(migrationSource, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migrationSource, /private\.is_workspace_member\(workspace_id\)/);
  assert.match(migrationSource, /revoke update, delete, truncate on public\.analytics_events from authenticated/);
  assert.match(migrationSource, /analytics_events_known_name_check/);
});
