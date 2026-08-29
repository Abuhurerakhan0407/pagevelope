import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AnalyticsEvent, AnalyticsEventPayload } from "./events";

export async function trackServerEvent(
  event: AnalyticsEvent,
  payload: AnalyticsEventPayload = {}
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { ok: false as const, reason: "unauthenticated" as const };

    const { error } = await supabase.from("analytics_events").insert({
      event_name: event,
      workspace_id: payload.workspaceId,
      user_id: user.id,
      properties: payload.properties || {}
    });

    if (error) throw error;

    return { ok: true as const };
  } catch (error) {
    console.error(`[Analytics Error] Failed to track server event '${event}':`, error);
    return { ok: false as const, reason: "insert_failed" as const };
  }
}
