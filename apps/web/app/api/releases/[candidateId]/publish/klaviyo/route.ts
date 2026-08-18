import { trackServerEvent } from "@/lib/analytics/server";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { renderCampaignRelease, stableStringify } from "@pagevelope/email-renderer";
import { assignTemplateToCampaignMessage } from "@/lib/klaviyo/client";
import { KLAVIYO_API_REVISION, requireKlaviyoServerConfig } from "@/lib/klaviyo/config";
import { getWorkspaceKlaviyoAccess } from "@/lib/klaviyo/credentials";
import { upsertCodeTemplate } from "@/lib/klaviyo/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };
type PublishBody = { workspaceId?: unknown; campaignMessageId?: unknown };

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function templateName(campaignName: string, version: number, sourceSha: string): string {
  return `Pagevelope · ${campaignName} · v${version} · ${sourceSha.slice(0, 12)}`.slice(0, 180);
}

export async function POST(request: Request, context: RouteContext) {
  const { candidateId } = await context.params;
  let body: PublishBody;
  try {
    body = await request.json() as PublishBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const campaignMessageId = typeof body.campaignMessageId === "string" ? body.campaignMessageId.trim() : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership || !["owner", "admin", "editor"].includes(membership.role)) {
    return NextResponse.json({ error: "Workspace edit access is required to publish." }, { status: 403 });
  }

  const { data: existingReceipt } = await supabase
    .from("campaign_publish_receipts")
    .select("id,campaign_id,external_template_id,external_campaign_id,external_message_id,published_at")
    .eq("workspace_id", workspaceId)
    .eq("release_candidate_id", candidateId)
    .maybeSingle();
  if (existingReceipt) {
    return NextResponse.json({ receipt: existingReceipt, idempotent: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("campaign_release_candidates")
    .select("id,campaign_id,version_number,source_sha256,manifest_sha256,manifest_json")
    .eq("workspace_id", workspaceId)
    .eq("id", candidateId)
    .maybeSingle();
  if (candidateError || !candidate) return NextResponse.json({ error: "Release candidate not found." }, { status: 404 });

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,name,status,current_version_number")
    .eq("workspace_id", workspaceId)
    .eq("id", candidate.campaign_id)
    .maybeSingle();
  if (campaignError || !campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  if (campaign.status !== "approved" || campaign.current_version_number !== candidate.version_number) {
    return NextResponse.json({ error: "Only the current approved campaign version can publish.", code: "APPROVAL_REQUIRED" }, { status: 409 });
  }

  const { data: version, error: versionError } = await supabase
    .from("campaign_versions")
    .select("source_json,source_sha256")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaign.id)
    .eq("version_number", candidate.version_number)
    .maybeSingle();
  if (versionError || !version) return NextResponse.json({ error: "Immutable campaign version is unavailable." }, { status: 409 });
  if (version.source_sha256 !== candidate.source_sha256) {
    return NextResponse.json({ error: "Release candidate source fingerprint is stale.", code: "SOURCE_MISMATCH" }, { status: 409 });
  }

  let release;
  try {
    release = await renderCampaignRelease(version.source_json);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Release render failed.", code: "RENDER_BLOCKED" }, { status: 422 });
  }

  const generatedManifestSha = sha256(stableStringify(release.manifest));
  if (release.manifest.sourceFingerprint !== candidate.source_sha256 || generatedManifestSha !== candidate.manifest_sha256) {
    return NextResponse.json({ error: "Deterministic release evidence no longer matches the approved candidate.", code: "RELEASE_EVIDENCE_MISMATCH" }, { status: 409 });
  }

  let access;
  try {
    access = await getWorkspaceKlaviyoAccess(workspaceId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Klaviyo connection unavailable.", code: "KLAVIYO_CONNECTION_REQUIRED" }, { status: 409 });
  }

  let template;
  let assignment: Awaited<ReturnType<typeof assignTemplateToCampaignMessage>> | null = null;
  try {
    template = await upsertCodeTemplate(access.accessToken, {
      name: templateName(campaign.name, candidate.version_number, candidate.source_sha256),
      html: release.html,
      text: release.plainText,
    });
    if (campaignMessageId) {
      assignment = await assignTemplateToCampaignMessage(access.accessToken, {
        templateId: template.templateId,
        messageId: campaignMessageId,
      });
    }
  } catch (error) {
    await trackServerEvent("publish_failed", { workspaceId, userId, properties: { provider: "klaviyo", error: error instanceof Error ? error.message : "Klaviyo template publishing failed." } });
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Klaviyo template publishing failed.",
      code: "KLAVIYO_PUBLISH_FAILED",
    }, { status: 502 });
  }

  const admin = createAdminClient(requireKlaviyoServerConfig().supabaseServiceRoleKey);
  const { data: receiptId, error: receiptError } = await admin.rpc("record_klaviyo_publish_receipt_server", {
    target_workspace_id: workspaceId,
    target_release_candidate_id: candidateId,
    target_connection_id: access.connectionId,
    provider_revision: KLAVIYO_API_REVISION,
    external_template_id: template.templateId,
    external_campaign_id: assignment?.campaignId ?? "",
    external_message_id: assignment?.messageId ?? "",
    actor_user_id: userId,
  });

  if (receiptError) {
    return NextResponse.json({ error: "Klaviyo was updated, but the immutable publish receipt could not be recorded. Do not retry blindly.", code: "RECEIPT_WRITE_FAILED" }, { status: 500 });
  }

  await trackServerEvent("publish_success", { workspaceId, userId, properties: { provider: "klaviyo", templateId: template.templateId, campaignId: campaign.id } });
  return NextResponse.json({
    receiptId,
    campaignId: campaign.id,
    releaseCandidateId: candidateId,
    provider: "klaviyo",
    providerRevision: KLAVIYO_API_REVISION,
    templateId: template.templateId,
    templateOperation: template.operation,
    campaignMessageId: assignment?.messageId ?? null,
    externalCampaignId: assignment?.campaignId ?? null,
    sourceSha256: candidate.source_sha256,
    manifestSha256: candidate.manifest_sha256,
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
