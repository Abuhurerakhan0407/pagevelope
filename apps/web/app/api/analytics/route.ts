import { NextResponse } from "next/server";
import { trackServerEvent } from "@/lib/analytics/server";

export async function POST(request: Request) {
  try {
    const { event, payload } = await request.json();

    if (!event) {
      return NextResponse.json({ error: "Missing event name" }, { status: 400 });
    }

    await trackServerEvent(event, payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to track event" }, { status: 500 });
  }
}
