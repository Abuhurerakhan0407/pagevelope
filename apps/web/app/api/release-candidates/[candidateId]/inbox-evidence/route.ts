import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_CLIENTS = new Set(["gmail-web", "apple-mail", "outlook-windows"]);

type RouteContext = {
  params: Promise<{ candidateId: string }>;
};

type EvidenceBody = {
  workspaceId?: unknown;
  clientKey?: unknown;
  provider?: unknown;
  status?: unknown;
  evidenceUrl?: unknown;
  notes?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  if (!getSupabasePublicConfig()) {
    return NextResponse.json({ error: "Supabase is not configured in this environment." }, { status: 503 });
  }

  const { candidateId } = await context.params;
  let body: EvidenceBody;
  try {
    body = (await request.json()) as EvidenceBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
  const clientKey = typeof body.clientKey === "string" ? body.clientKey.trim().toLowerCase() : "";
  const provider = typeof body.provider === "string" && body.provider.trim() ? body.provider.trim() : "manual";
  const status = body.status === "pass" || body.status === "fail" ? body.status : "";
  const evidenceUrl = typeof body.evidenceUrl === "string" ? body.evidenceUrl.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!workspaceId || !REQUIRED_CLIENTS.has(clientKey) || !status || provider.length > 80 || notes.length > 2000) {
    return NextResponse.json({ error: "Invalid inbox evidence payload." }, { status: 400 });
  }
  if (evidenceUrl && !evidenceUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Evidence URL must use HTTPS." }, { status: 400 });
  }
  if (status === "pass" && !evidenceUrl) {
    return NextResponse.json({ error: "Passing inbox checks require an HTTPS evidence URL." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: evidenceId, error } = await supabase.rpc("record_inbox_evidence", {
    target_workspace_id: workspaceId,
    target_release_candidate_id: candidateId,
    client_key: clientKey,
    provider,
    check_status: status,
    evidence_url: evidenceUrl,
    notes,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Reviewer access is required to record inbox evidence." }, { status: 403 });
    }
    if (error.code === "23514" || error.code === "22023") {
      return NextResponse.json({ error: "Inbox evidence failed release validation." }, { status: 422 });
    }
    return NextResponse.json({ error: "Inbox evidence could not be recorded." }, { status: 422 });
  }

  return NextResponse.json({ evidenceId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
