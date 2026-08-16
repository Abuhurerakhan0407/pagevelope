"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const REQUIRED_CLIENTS = new Set(["gmail-web", "apple-mail", "outlook-windows"]);

function reviewPath(workspaceId: string, candidateId: string) {
  return `/review/${encodeURIComponent(candidateId)}?workspaceId=${encodeURIComponent(workspaceId)}`;
}

function publishPath(workspaceId: string, candidateId: string) {
  return `/publish/${encodeURIComponent(candidateId)}?workspaceId=${encodeURIComponent(workspaceId)}`;
}

async function authenticatedClient() {
  if (!getSupabasePublicConfig()) redirect("/dashboard");
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");
  return supabase;
}

export async function recordInboxEvidenceAction(
  workspaceId: string,
  candidateId: string,
  formData: FormData,
) {
  const path = reviewPath(workspaceId, candidateId);
  const clientKey = String(formData.get("clientKey") ?? "").trim().toLowerCase();
  const provider = String(formData.get("provider") ?? "manual").trim() || "manual";
  const status = String(formData.get("status") ?? "").trim();
  const evidenceUrl = String(formData.get("evidenceUrl") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (
    !REQUIRED_CLIENTS.has(clientKey) ||
    !["pass", "fail"].includes(status) ||
    provider.length > 80 ||
    notes.length > 2000 ||
    (evidenceUrl && !evidenceUrl.startsWith("https://")) ||
    (status === "pass" && !evidenceUrl)
  ) {
    redirect(`${path}&error=invalid-evidence`);
  }

  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("record_inbox_evidence", {
    target_workspace_id: workspaceId,
    target_release_candidate_id: candidateId,
    client_key: clientKey,
    provider,
    check_status: status,
    evidence_url: evidenceUrl,
    notes,
  });

  if (error) {
    redirect(`${path}&error=${error.code === "42501" ? "review-access" : "evidence-save"}`);
  }

  revalidatePath(`/review/${candidateId}`);
  redirect(`${path}&saved=evidence`);
}

export async function recordApprovalAction(
  workspaceId: string,
  candidateId: string,
  formData: FormData,
) {
  const path = reviewPath(workspaceId, candidateId);
  const decision = String(formData.get("decision") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!["approved", "changes_requested"].includes(decision) || note.length > 2000) {
    redirect(`${path}&error=invalid-approval`);
  }

  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("record_campaign_approval", {
    target_workspace_id: workspaceId,
    target_release_candidate_id: candidateId,
    approval_decision: decision,
    approval_note: note,
  });

  if (error) {
    const code = error.code === "42501" ? "review-access" : error.code === "23505" ? "approval-immutable" : "approval-save";
    redirect(`${path}&error=${code}`);
  }

  revalidatePath(`/review/${candidateId}`);
  redirect(`${path}&saved=approval`);
}

export async function finalizeApprovalAction(
  workspaceId: string,
  candidateId: string,
) {
  const path = reviewPath(workspaceId, candidateId);
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("approve_release_candidate", {
    target_workspace_id: workspaceId,
    target_release_candidate_id: candidateId,
  });

  if (error) {
    const code = error.code === "42501" ? "review-access" : error.code === "23514" ? "release-not-ready" : error.code === "40001" ? "version-conflict" : "finalize-failed";
    redirect(`${path}&error=${code}`);
  }

  revalidatePath(`/review/${candidateId}`);
  revalidatePath(`/publish/${candidateId}`);
  redirect(publishPath(workspaceId, candidateId));
}
