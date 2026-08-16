import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ candidateId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  if (!getSupabasePublicConfig()) {
    return NextResponse.json({ error: "Supabase is not configured in this environment." }, { status: 503 });
  }

  const { candidateId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId")?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const [{ data: candidate, error: candidateError }, { data: evidence, error: evidenceError }, { data: approvals, error: approvalsError }, readinessResult] = await Promise.all([
    supabase
      .from("campaign_release_candidates")
      .select("id,campaign_id,version_number,source_sha256,manifest_sha256,renderer_version,qa_status,manifest_json,created_at")
      .eq("workspace_id", workspaceId)
      .eq("id", candidateId)
      .maybeSingle(),
    supabase
      .from("inbox_evidence")
      .select("id,client_key,provider,status,evidence_url,notes,checked_at,created_at")
      .eq("workspace_id", workspaceId)
      .eq("release_candidate_id", candidateId)
      .order("checked_at", { ascending: false }),
    supabase
      .from("campaign_approvals")
      .select("id,decision,note,created_by,created_at")
      .eq("workspace_id", workspaceId)
      .eq("release_candidate_id", candidateId)
      .order("created_at", { ascending: false }),
    supabase.rpc("release_candidate_readiness", {
      target_workspace_id: workspaceId,
      target_release_candidate_id: candidateId,
    }),
  ]);

  if (candidateError || !candidate) {
    return NextResponse.json({ error: "Release candidate not found in this workspace." }, { status: 404 });
  }
  if (evidenceError || approvalsError || readinessResult.error) {
    if (readinessResult.error?.code === "42501") {
      return NextResponse.json({ error: "You do not have access to this release candidate." }, { status: 403 });
    }
    return NextResponse.json({ error: "Release review state could not be loaded." }, { status: 422 });
  }

  return NextResponse.json(
    {
      candidate,
      evidence: evidence ?? [],
      approvals: approvals ?? [],
      readiness: readinessResult.data,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
