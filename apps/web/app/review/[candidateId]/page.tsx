import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  finalizeApprovalAction,
  recordApprovalAction,
  recordInboxEvidenceAction,
} from "./actions";
import styles from "./review.module.css";

type PageProps = {
  params: Promise<{ candidateId: string }>;
  searchParams: Promise<{ workspaceId?: string; error?: string; saved?: string }>;
};

type Candidate = {
  id: string;
  campaign_id: string;
  version_number: number;
  source_sha256: string;
  manifest_sha256: string;
  renderer_version: string;
  qa_status: "PASS" | "WARN";
  manifest_json: unknown;
  created_at: string;
};

type Evidence = {
  id: string;
  client_key: string;
  provider: string;
  status: "pass" | "fail";
  evidence_url: string | null;
  notes: string | null;
  checked_at: string;
};

type Approval = {
  id: string;
  decision: "approved" | "changes_requested";
  note: string | null;
  created_by: string;
  created_at: string;
};

type Readiness = {
  ready: boolean;
  campaign_id: string;
  version_number: number;
  current_version: boolean;
  qa_status: string;
  required_clients: string[];
  passed_client_count: number;
  required_client_count: number;
  approval_count: number;
  changes_requested_count: number;
};

const clientLabels: Record<string, string> = {
  "gmail-web": "Gmail Web",
  "apple-mail": "Apple Mail",
  "outlook-windows": "Outlook Windows",
};

const errors: Record<string, string> = {
  "invalid-evidence": "Evidence is incomplete. Passing checks require an HTTPS evidence URL.",
  "review-access": "Reviewer, admin, or owner access is required for this action.",
  "evidence-save": "Inbox evidence could not be recorded.",
  "invalid-approval": "Choose an approval decision and keep the note under 2,000 characters.",
  "approval-immutable": "Your decision is immutable for this release candidate. A changed campaign needs a new version and candidate.",
  "approval-save": "Approval decision could not be recorded.",
  "release-not-ready": "Release is still blocked by inbox evidence or approval requirements.",
  "version-conflict": "The campaign changed after this release candidate was created. Create a fresh candidate from the current version.",
  "finalize-failed": "Approval could not be finalized.",
};

const savedMessages: Record<string, string> = {
  evidence: "Inbox evidence recorded and audit logged.",
  approval: "Immutable reviewer decision recorded.",
  finalized: "Campaign advanced to approved. Publishing remains a separate gate.",
};

export const dynamic = "force-dynamic";

export default async function ReleaseReviewPage({ params, searchParams }: PageProps) {
  const { candidateId } = await params;
  const query = await searchParams;
  const workspaceId = query.workspaceId?.trim() ?? "";

  if (!workspaceId || !getSupabasePublicConfig()) redirect("/dashboard");

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const [candidateResult, evidenceResult, approvalResult, readinessResult] = await Promise.all([
    supabase
      .from("campaign_release_candidates")
      .select("id,campaign_id,version_number,source_sha256,manifest_sha256,renderer_version,qa_status,manifest_json,created_at")
      .eq("workspace_id", workspaceId)
      .eq("id", candidateId)
      .maybeSingle(),
    supabase
      .from("inbox_evidence")
      .select("id,client_key,provider,status,evidence_url,notes,checked_at")
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

  if (candidateResult.error || !candidateResult.data) redirect("/dashboard");
  if (evidenceResult.error || approvalResult.error || readinessResult.error || !readinessResult.data) {
    redirect("/dashboard");
  }

  const candidate = candidateResult.data as Candidate;
  const evidence = (evidenceResult.data ?? []) as Evidence[];
  const approvals = (approvalResult.data ?? []) as Approval[];
  const readiness = readinessResult.data as Readiness;
  const latestEvidence = new Map<string, Evidence>();
  for (const item of evidence) {
    if (!latestEvidence.has(item.client_key)) latestEvidence.set(item.client_key, item);
  }

  const recordEvidence = recordInboxEvidenceAction.bind(null, workspaceId, candidateId);
  const recordApproval = recordApprovalAction.bind(null, workspaceId, candidateId);
  const finalizeApproval = finalizeApprovalAction.bind(null, workspaceId, candidateId);
  const builderUrl = `/builder?workspaceId=${encodeURIComponent(workspaceId)}&campaignId=${encodeURIComponent(candidate.campaign_id)}`;

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard"><span>P</span>Pagevelope</Link>
        <div className={styles.topActions}>
          <Link className={styles.secondary} href={builderUrl}>Back to builder</Link>
          <span className={readiness.ready ? styles.readyBadge : styles.blockedBadge}>
            {readiness.ready ? "READY TO APPROVE" : "RELEASE BLOCKED"}
          </span>
        </div>
      </header>

      <section className={styles.content}>
        {query.error && errors[query.error] ? <p className={`${styles.notice} ${styles.error}`}>{errors[query.error]}</p> : null}
        {query.saved && savedMessages[query.saved] ? <p className={styles.notice}>{savedMessages[query.saved]}</p> : null}

        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Inbox Lab · immutable release candidate</p>
            <h1>Review before anything leaves Pagevelope.</h1>
            <p className={styles.subtitle}>Renderer evidence, real inbox proof and reviewer approval must all agree on the same immutable campaign version.</p>
          </div>
          <div className={styles.versionCard}>
            <span>Campaign version</span>
            <strong>v{candidate.version_number}</strong>
            <small>{readiness.current_version ? "Current" : "Stale — recreate candidate"}</small>
          </div>
        </div>

        <section className={styles.gateGrid}>
          <article className={styles.gateCard}>
            <span>Renderer QA</span>
            <strong>{candidate.qa_status}</strong>
            <small>Renderer {candidate.renderer_version}</small>
          </article>
          <article className={styles.gateCard}>
            <span>Inbox clients</span>
            <strong>{readiness.passed_client_count}/{readiness.required_client_count}</strong>
            <small>Passing evidence required</small>
          </article>
          <article className={styles.gateCard}>
            <span>Approvals</span>
            <strong>{readiness.approval_count}</strong>
            <small>{readiness.changes_requested_count ? `${readiness.changes_requested_count} changes requested` : "No rejection recorded"}</small>
          </article>
          <article className={styles.gateCard}>
            <span>Source fingerprint</span>
            <strong className={styles.hash}>{candidate.source_sha256.slice(0, 12)}…</strong>
            <small>Manifest {candidate.manifest_sha256.slice(0, 12)}…</small>
          </article>
        </section>

        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.eyebrow}>Evidence</p>
                <h2>Required inbox clients</h2>
              </div>
              <span>{readiness.passed_client_count === readiness.required_client_count ? "All clients passed" : "Evidence incomplete"}</span>
            </div>

            <div className={styles.clientList}>
              {readiness.required_clients.map((clientKey) => {
                const latest = latestEvidence.get(clientKey);
                return (
                  <article className={styles.clientCard} key={clientKey}>
                    <div className={styles.clientHead}>
                      <div>
                        <strong>{clientLabels[clientKey] ?? clientKey}</strong>
                        <span>{latest ? `${latest.provider} · ${new Date(latest.checked_at).toLocaleString("en-IN")}` : "No evidence yet"}</span>
                      </div>
                      <span className={latest?.status === "pass" ? styles.pass : latest?.status === "fail" ? styles.fail : styles.pending}>
                        {latest?.status?.toUpperCase() ?? "PENDING"}
                      </span>
                    </div>
                    {latest?.evidence_url ? <a className={styles.evidenceLink} href={latest.evidence_url} target="_blank" rel="noreferrer">Open latest evidence ↗</a> : null}
                    {latest?.notes ? <p className={styles.notes}>{latest.notes}</p> : null}

                    <form action={recordEvidence} className={styles.form}>
                      <input type="hidden" name="clientKey" value={clientKey} />
                      <input type="hidden" name="provider" value="manual" />
                      <div className={styles.twoCol}>
                        <label>
                          <span>Result</span>
                          <select name="status" defaultValue="pass">
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                          </select>
                        </label>
                        <label>
                          <span>Evidence URL</span>
                          <input name="evidenceUrl" type="url" placeholder="https://…" />
                        </label>
                      </div>
                      <label>
                        <span>Review note</span>
                        <input name="notes" type="text" maxLength={2000} placeholder="What was checked?" />
                      </label>
                      <button className={styles.secondaryButton} type="submit">Record evidence</button>
                    </form>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className={styles.side}>
            <section className={styles.sideCard}>
              <p className={styles.eyebrow}>Approval</p>
              <h2>Immutable decision</h2>
              <p>One reviewer decision per candidate. Requesting changes permanently blocks this candidate; edit the campaign and create a new version instead.</p>

              {approvals.length ? (
                <div className={styles.approvalList}>
                  {approvals.map((approval) => (
                    <div className={styles.approvalRow} key={approval.id}>
                      <strong>{approval.decision === "approved" ? "Approved" : "Changes requested"}</strong>
                      <span>{new Date(approval.created_at).toLocaleString("en-IN")}</span>
                      {approval.note ? <small>{approval.note}</small> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <form action={recordApproval} className={styles.form}>
                <label>
                  <span>Decision</span>
                  <select name="decision" defaultValue="approved">
                    <option value="approved">Approve candidate</option>
                    <option value="changes_requested">Request changes</option>
                  </select>
                </label>
                <label>
                  <span>Note</span>
                  <textarea name="note" rows={4} maxLength={2000} placeholder="Optional review note" />
                </label>
                <button className={styles.secondaryButton} type="submit">Record decision</button>
              </form>
            </section>

            <section className={`${styles.sideCard} ${styles.finalCard}`}>
              <p className={styles.eyebrow}>Final gate</p>
              <h2>{readiness.ready ? "Ready to approve" : "Still blocked"}</h2>
              <ul>
                <li><span>{readiness.current_version ? "✓" : "!"}</span> Candidate matches current version</li>
                <li><span>{candidate.qa_status === "PASS" || candidate.qa_status === "WARN" ? "✓" : "!"}</span> Renderer QA is non-blocking</li>
                <li><span>{readiness.passed_client_count === readiness.required_client_count ? "✓" : "!"}</span> Required inbox evidence passes</li>
                <li><span>{readiness.approval_count > 0 && readiness.changes_requested_count === 0 ? "✓" : "!"}</span> Reviewer approval is clean</li>
              </ul>
              <form action={finalizeApproval}>
                <button className={styles.primaryButton} type="submit" disabled={!readiness.ready}>Finalize approval</button>
              </form>
              <small>Finalizing changes campaign status to approved. It does not send or publish the campaign.</small>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
