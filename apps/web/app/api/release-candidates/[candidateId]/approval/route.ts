import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ candidateId: string }>;
};

type ApprovalBody = {
  workspaceId?: unknown;
  decision?: unknown;
  note?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  if (!getSupabasePublicConfig()) {
    return NextResponse.json({ error: "Supabase is not configured in this environment." }, { status: 503 });
  }

  const { candidateId } = await context.params;
  let body: ApprovalBody;
  try {
    body = (await request.json()) as ApprovalBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const decision = body.decision === "approved" || body.decision === "changes_requested" ? body.decision : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!workspaceId || !decision || note.length > 2000) {
    return NextResponse.json({ error: "Invalid approval payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: approvalId, error } = await supabase.rpc("record_campaign_approval", {
    target_workspace_id: workspaceId,
    target_release_candidate_id: candidateId,
    approval_decision: decision,
    approval_note: note,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Reviewer access is required to approve campaigns." }, { status: 403 });
    }
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Your decision for this release candidate is immutable.", code: "APPROVAL_EXISTS" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Approval decision could not be recorded." }, { status: 422 });
  }

  return NextResponse.json({ approvalId, decision }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
