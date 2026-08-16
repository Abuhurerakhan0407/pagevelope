import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ candidateId: string }>;
};

type FinalizeBody = {
  workspaceId?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  if (!getSupabasePublicConfig()) {
    return NextResponse.json({ error: "Supabase is not configured in this environment." }, { status: 503 });
  }

  const { candidateId } = await context.params;
  let body: FinalizeBody;
  try {
    body = (await request.json()) as FinalizeBody;
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

  const { data, error } = await supabase.rpc("approve_release_candidate", {
    target_workspace_id: workspaceId,
    target_release_candidate_id: candidateId,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Reviewer access is required to finalize approval." }, { status: 403 });
    }
    if (error.code === "23514") {
      return NextResponse.json(
        { error: "Release candidate is still blocked by inbox or approval gates.", code: "RELEASE_NOT_READY" },
        { status: 409 },
      );
    }
    if (error.code === "40001") {
      return NextResponse.json(
        { error: "Campaign changed while approval was being finalized.", code: "VERSION_CONFLICT" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Release approval could not be finalized." }, { status: 422 });
  }

  return NextResponse.json(
    { approved: data === true, candidateId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
