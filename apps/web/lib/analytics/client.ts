"use client";

import { AnalyticsEvent, AnalyticsEventPayload } from "./events";

export function trackClientEvent(
  event: AnalyticsEvent,
  payload: AnalyticsEventPayload = {}
) {
  fetch("/api/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event,
      payload,
    }),
  }).catch((error) => {
    console.error(`[Analytics Error] Failed to track client event '${event}':`, error);
  });
}
