import { NextResponse } from "next/server";
import { renderCampaignRelease } from "@pagevelope/email-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const release = await renderCampaignRelease(input);

    return NextResponse.json(
      {
        html: release.html,
        plainText: release.plainText,
        mjml: release.mjml,
        manifest: release.manifest,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign render failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
