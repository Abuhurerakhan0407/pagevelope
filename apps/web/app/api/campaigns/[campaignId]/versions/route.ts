import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { validateCampaignDocument } from "@pagevelope/editor-schema";
import { stableStringify } from "@pagevelope/email-renderer";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

type SaveBody = {
  workspaceId?: unknown;
  expectedVersion?: unknown;
  source?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  if (!getSupabasePublicConfig()) {
    return NextResponse.json({ error: "Supabase is not configured in this environment." }, { status: 503 });
  }

  const { campaignId } = await context.params;
  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const expectedVersion = body.expectedVersion;
  if (
    !workspaceId ||
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    return NextResponse.json({ error: "workspaceId and a non-negative expectedVersion are required." }, { status: 400 });
  }

  const validation = validateCampaignDocument(body.source);
  if (!validation.success || !validation.data) {
    return NextResponse.json({ error: "Campaign source failed schema validation.", issues: validation.issues }, { status: 422 });
  }

  if (validation.data.id !== campaignId) {
    return NextResponse.json({ error: "Campaign source id does not match the route campaign." }, { status: 422 });
  }

  const canonicalSource = stableStringify(validation.data);
  const sourceSha256 = createHash("sha256").update(canonicalSource, "utf8").digest("hex");

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("save_campaign_version", {
    target_workspace_id: workspaceId,
    target_campaign_id: campaignId,
    expected_current_version: expectedVersion,
    source_json: validation.data,
    source_sha256: sourceSha256,
  });

  if (error) {
    if (error.code === "40001") {
      return NextResponse.json(
        { error: "This campaign changed in another session. Reload before saving again.", code: "VERSION_CONFLICT" },
        { status: 409 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ error: "You do not have permission to edit this campaign." }, { status: 403 });
    }
    return NextResponse.json({ error: "Campaign version could not be saved." }, { status: 422 });
  }

  return NextResponse.json(
    {
      version: Number(data),
      sourceSha256,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
