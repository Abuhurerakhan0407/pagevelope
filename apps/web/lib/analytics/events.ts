export type AnalyticsEvent =
  | "signup"
  | "workspace_created"
  | "brand_created"
  | "campaign_created"
  | "render_success"
  | "render_failed"
  | "test_send_success"
  | "test_send_failed"
  | "release_created"
  | "approval_submitted"
  | "publish_success"
  | "publish_failed"
  | "subscription_created"
  | "subscription_upgraded";

export interface AnalyticsEventPayload {
  userId?: string;
  workspaceId?: string;
  properties?: Record<string, string | number | boolean | null>;
}
