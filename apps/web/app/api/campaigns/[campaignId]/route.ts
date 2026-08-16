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
    .select("id,workspace_id,brand_id,name,status,schema_version,current_version_number,updated_at")
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found in this workspace." }, { status: 404 });
  }

  const [{ data: brand, error: brandError }, { data: version, error: versionError }] = await Promise.all([
    supabase
      .from("brands")
      .select("id,name,slug,primary_color,accent_color,background_color,text_color,font_family,website_url,company_name,legal_address")
      .eq("workspace_id", workspaceId)
      .eq("id", campaign.brand_id)
      .maybeSingle(),
    campaign.current_version_number > 0
      ? supabase
          .from("campaign_versions")
          .select("version_number,source_json,source_sha256,created_at")
          .eq("workspace_id", workspaceId)
          .eq("campaign_id", campaignId)
          .eq("version_number", campaign.current_version_number)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (brandError || !brand) {
    return NextResponse.json({ error: "Campaign brand is unavailable." }, { status: 409 });
  }
  if (versionError) {
    return NextResponse.json({ error: "Campaign version could not be loaded." }, { status: 409 });
  }

  return NextResponse.json(
    {
      campaign,
      brand,
      latestVersion: version,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
