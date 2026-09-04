export const ANALYTICS_EVENTS = [
  "signup",
  "workspace_created",
  "brand_created",
  "campaign_created",
  "render_success",
  "render_failed",
  "test_send_success",
  "test_send_failed",
  "release_created",
  "approval_submitted",
  "publish_success",
  "publish_failed",
  "subscription_created",
  "subscription_upgraded",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AnalyticsEventPayload {
  workspaceId?: string;
  properties?: Record<string, string | number | boolean | null>;
}

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return typeof value === "string" && ANALYTICS_EVENTS.includes(value as AnalyticsEvent);
}

export function parseAnalyticsEventPayload(value: unknown): AnalyticsEventPayload | null {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  if (candidate.workspaceId !== undefined && (typeof candidate.workspaceId !== "string" || !UUID.test(candidate.workspaceId))) return null;
  if (candidate.properties !== undefined) {
    if (!candidate.properties || typeof candidate.properties !== "object" || Array.isArray(candidate.properties)) return null;
    const entries = Object.entries(candidate.properties);
    if (entries.length > 20) return null;
    for (const [key, property] of entries) {
      if (!key || key.length > 80) return null;
      if (property !== null && !["string", "number", "boolean"].includes(typeof property)) return null;
      if (typeof property === "string" && property.length > 500) return null;
      if (typeof property === "number" && !Number.isFinite(property)) return null;
    }
  }

  return {
    workspaceId: candidate.workspaceId as string | undefined,
    properties: candidate.properties as AnalyticsEventPayload["properties"],
  };
}
