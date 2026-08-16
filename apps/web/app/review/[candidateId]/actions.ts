"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { renderCampaignRelease, stableStringify } from "@pagevelope/email-renderer";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getResendTestConfig,
  ResendConfigurationError,
  ResendDeliveryError,
  sendResendTestEmail,
} from "@/lib/test-send/resend";

const REQUIRED_CLIENTS = new Set(["gmail-web", "apple-mail", "outlook-windows"]);
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

async function completeTestAttempt(
  serviceRoleKey: string,
  workspaceId: string,
  attemptId: string,
  status: "sent" | "failed",
  providerMessageId: string,
  failureCode: string,
) {
  const admin = createAdminClient(serviceRoleKey);
  return admin.rpc("complete_test_send_attempt", {
    target_workspace_id: workspaceId,
    target_attempt_id: attemptId,
    terminal_status: status,
    target_provider_message_id: providerMessageId,
    target_failure_code: failureCode,
  });
}

export async function sendTestEmailAction(
  workspaceId: string,
  candidateId: string,
  formData: FormData,
) {
  const path = reviewPath(workspaceId, candidateId);
  const recipient = String(formData.get("recipientEmail") ?? "").trim().toLowerCase();

  if (recipient.length < 3 || recipient.length > 320 || !EMAIL_PATTERN.test(recipient)) {
    redirect(`${path}&error=invalid-test-email`);
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  try {
    getResendTestConfig();
  } catch (error) {
    if (error instanceof ResendConfigurationError) redirect(`${path}&error=test-send-not-configured`);
    throw error;
  }
  if (!serviceRoleKey) redirect(`${path}&error=test-send-not-configured`);

  const supabase = await authenticatedClient();
  const { data: attemptData, error: attemptError } = await supabase.rpc("create_test_send_attempt", {
    target_workspace_id: workspaceId,
    target_release_candidate_id: candidateId,
    target_recipient_email: recipient,
  });

  if (attemptError || typeof attemptData !== "string") {
    const code =
      attemptError?.code === "42501"
        ? "test-send-access"
        : attemptError?.code === "54000"
          ? "test-send-rate-limit"
          : attemptError?.code === "40001"
            ? "version-conflict"
            : attemptError?.code === "23514"
              ? "inbox-required"
              : "test-send-create";
    redirect(`${path}&error=${code}`);
  }

  const attemptId = attemptData;
  const [{ data: candidate, error: candidateError }, { data: campaign, error: campaignError }] = await Promise.all([
    supabase
      .from("campaign_release_candidates")
      .select("id,campaign_id,version_number,source_sha256,manifest_sha256")
      .eq("workspace_id", workspaceId)
      .eq("id", candidateId)
      .maybeSingle(),
    supabase
      .from("campaigns")
      .select("id,current_version_number,status")
      .eq("workspace_id", workspaceId)
      .eq("id", candidateId)
      .maybeSingle(),
  ]);

  if (candidateError || !candidate) {
    await completeTestAttempt(serviceRoleKey, workspaceId, attemptId, "failed", "", "release_integrity");
    redirect(`${path}&error=release-integrity`);
  }

  // Fetch the campaign separately using the candidate's immutable relationship. The first
  // parallel campaign lookup above intentionally never authorizes a send because candidate
  // ids and campaign ids are distinct; it only keeps this path fail-closed under malformed input.
  const { data: currentCampaign, error: currentCampaignError } = await supabase
    .from("campaigns")
    .select("id,current_version_number,status")
    .eq("workspace_id", workspaceId)
    .eq("id", candidate.campaign_id)
    .maybeSingle();

  if (
    campaignError ||
    campaign ||
    currentCampaignError ||
    !currentCampaign ||
    currentCampaign.status !== "review" ||
    currentCampaign.current_version_number !== candidate.version_number
  ) {
    await completeTestAttempt(serviceRoleKey, workspaceId, attemptId, "failed", "", "version_conflict");
    redirect(`${path}&error=version-conflict`);
  }

  const { data: version, error: versionError } = await supabase
    .from("campaign_versions")
    .select("version_number,source_json,source_sha256")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", candidate.campaign_id)
    .eq("version_number", candidate.version_number)
    .maybeSingle();

  if (versionError || !version || version.source_sha256 !== candidate.source_sha256) {
    await completeTestAttempt(serviceRoleKey, workspaceId, attemptId, "failed", "", "release_integrity");
    redirect(`${path}&error=release-integrity`);
  }

  let release;
  try {
    release = await renderCampaignRelease(version.source_json);
  } catch {
    await completeTestAttempt(serviceRoleKey, workspaceId, attemptId, "failed", "", "release_integrity");
    redirect(`${path}&error=release-integrity`);
  }

  const manifestSha256 = createHash("sha256")
    .update(stableStringify(release.manifest), "utf8")
    .digest("hex");

  if (
    release.manifest.sourceFingerprint !== candidate.source_sha256 ||
    manifestSha256 !== candidate.manifest_sha256
  ) {
    await completeTestAttempt(serviceRoleKey, workspaceId, attemptId, "failed", "", "release_integrity");
    redirect(`${path}&error=release-integrity`);
  }

  let providerMessageId: string;
  try {
    const sent = await sendResendTestEmail({
      attemptId,
      recipient,
      subject: `[TEST] ${release.source.subject}`,
      html: release.html,
      text: release.plainText,
    });
    providerMessageId = sent.messageId;
  } catch (error) {
    const failureCode = error instanceof ResendDeliveryError ? error.code : "provider_error";
    const { error: completionError } = await completeTestAttempt(
      serviceRoleKey,
      workspaceId,
      attemptId,
      "failed",
      "",
      failureCode,
    );
    redirect(`${path}&error=${completionError ? "test-send-record-failed" : "test-send-provider"}`);
  }

  const { error: completionError } = await completeTestAttempt(
    serviceRoleKey,
    workspaceId,
    attemptId,
    "sent",
    providerMessageId,
    "",
  );
  if (completionError) redirect(`${path}&error=test-send-record-failed`);

  revalidatePath(`/review/${candidateId}`);
  redirect(`${path}&saved=test-send`);
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
    const code =
      error.code === "42501"
        ? "review-access"
        : error.code === "23505"
          ? "approval-immutable"
          : error.code === "23514"
            ? "test-send-required"
            : "approval-save";
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
