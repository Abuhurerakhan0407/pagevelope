import { trackServerEvent } from "@/lib/analytics/server";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { renderCampaignRelease, stableStringify } from "@pagevelope/email-renderer";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

type CreateCandidateBody = {
  workspaceId?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  if (!getSupabasePublicConfig()) {
    return NextResponse.json({ error: "Supabase is not configured in this environment." }, { status: 503 });
  }

  const { campaignId } = await context.params;
  let body: CreateCandidateBody;
  try {
    body = (await request.json()) as CreateCandidateBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
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
    .select("id,workspace_id,status,current_version_number,brief_completed_at,selected_direction_key")
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found in this workspace." }, { status: 404 });
  }

  if (!campaign.brief_completed_at || !campaign.selected_direction_key) {
    return NextResponse.json(
      { error: "Campaign brief and creative direction are required before release review.", code: "CAMPAIGN_GATE_REQUIRED" },
      { status: 409 },
    );
  }

  if (campaign.status !== "draft" && campaign.status !== "review") {
    return NextResponse.json(
      { error: "Only draft or review campaigns can create a release candidate.", code: "CAMPAIGN_NOT_EDITABLE" },
      { status: 409 },
    );
  }

  if (!Number.isInteger(campaign.current_version_number) || campaign.current_version_number < 1) {
    return NextResponse.json(
      { error: "Save an immutable campaign version before starting release review.", code: "VERSION_REQUIRED" },
      { status: 409 },
    );
  }

  const { data: version, error: versionError } = await supabase
    .from("campaign_versions")
    .select("version_number,source_json,source_sha256")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId)
    .eq("version_number", campaign.current_version_number)
    .maybeSingle();

  if (versionError || !version) {
    return NextResponse.json({ error: "Current campaign version is unavailable." }, { status: 409 });
  }

  let release;
  try {
    release = await renderCampaignRelease(version.source_json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign release render failed.";
    return NextResponse.json({ error: message, code: "RELEASE_BLOCKED" }, { status: 422 });
  }

  if (release.manifest.sourceFingerprint !== version.source_sha256) {
    return NextResponse.json(
      { error: "Persisted campaign fingerprint does not match deterministic renderer output.", code: "SOURCE_FINGERPRINT_MISMATCH" },
      { status: 409 },
    );
  }

  const manifestJson = release.manifest;
  const manifestSha256 = createHash("sha256")
    .update(stableStringify(manifestJson), "utf8")
    .digest("hex");

  const { data: candidateId, error: candidateError } = await supabase.rpc("create_release_candidate", {
    target_workspace_id: workspaceId,
    target_campaign_id: campaignId,
    target_version_number: version.version_number,
    source_sha256: version.source_sha256,
    manifest_sha256: manifestSha256,
    renderer_version: release.manifest.rendererVersion,
    qa_status: release.manifest.qa.status,
    manifest_json: manifestJson,
  });

  if (candidateError) {
    if (candidateError.code === "42501") {
      return NextResponse.json({ error: "You do not have permission to start release review." }, { status: 403 });
    }
    if (candidateError.code === "23505") {
      return NextResponse.json(
        { error: "This immutable campaign version already has a release candidate.", code: "CANDIDATE_EXISTS" },
        { status: 409 },
      );
    }
    if (candidateError.code === "40001") {
      return NextResponse.json(
        { error: "Campaign changed before release review started. Reload and render the current version.", code: "VERSION_CONFLICT" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Release candidate could not be created." }, { status: 422 });
  }

  await trackServerEvent("release_created", { workspaceId, userId: claimsData.claims.sub, properties: { campaignId, version: version.version_number } });
  await trackServerEvent("release_created", { workspaceId, userId: claimsData.claims.sub, properties: { campaignId, version: version.version_number } });
  return NextResponse.json(
    {
      candidateId,
      campaignId,
      version: version.version_number,
      sourceSha256: version.source_sha256,
      manifestSha256,
      manifest: release.manifest,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
