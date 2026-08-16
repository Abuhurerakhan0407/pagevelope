import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  if (!getSupabasePublicConfig()) {
    return NextResponse.json({ error: "Supabase is not configured in this environment." }, { status: 503 });
  }

  const { campaignId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,current_version_number")
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found in this workspace." }, { status: 404 });
  }

  const { data: candidate, error } = await supabase
    .from("campaign_release_candidates")
    .select("id,version_number,qa_status,renderer_version,created_at")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId)
    .eq("version_number", campaign.current_version_number)
    .maybeSingle();

  if (error || !candidate) {
    return NextResponse.json({ error: "Current campaign version has no release candidate." }, { status: 404 });
  }

  return NextResponse.json(
    { candidateId: candidate.id, candidate, currentVersion: campaign.current_version_number },
    { headers: { "Cache-Control": "no-store" } },
  );
}
