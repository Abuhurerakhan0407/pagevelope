import { NextResponse } from "next/server";
import { trackServerEvent } from "@/lib/analytics/server";
import { isAnalyticsEvent, parseAnalyticsEventPayload } from "@/lib/analytics/events";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 16_384) {
      return NextResponse.json({ error: "Analytics event is too large" }, { status: 413 });
    }
    const body: unknown = JSON.parse(rawBody);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { event, payload } = body as Record<string, unknown>;
    const parsedPayload = parseAnalyticsEventPayload(payload);

    if (!isAnalyticsEvent(event) || !parsedPayload) {
      return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
    }

    const result = await trackServerEvent(event, parsedPayload);
    if (!result.ok) {
      const status = result.reason === "unauthenticated" ? 401 : 503;
      return NextResponse.json({ error: "Analytics event was not accepted" }, { status });
    }

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error("Failed to track event:", error);
    return NextResponse.json({ error: "Failed to track event" }, { status: 500 });
  }
}
