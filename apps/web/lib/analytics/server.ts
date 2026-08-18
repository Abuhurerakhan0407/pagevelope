import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AnalyticsEvent, AnalyticsEventPayload } from "./events";

export async function trackServerEvent(
  event: AnalyticsEvent,
  payload: AnalyticsEventPayload = {}
) {
  try {
    const supabase = await createClient();

    // Get user ID if not provided
    let userId = payload.userId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    await supabase.from("analytics_events").insert({
      event_name: event,
      workspace_id: payload.workspaceId,
      user_id: userId,
      properties: payload.properties || {}
    });

  } catch (error) {
    console.error(`[Analytics Error] Failed to track server event '${event}':`, error);
  }
}
