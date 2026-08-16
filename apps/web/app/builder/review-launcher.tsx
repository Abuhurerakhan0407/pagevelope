"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import styles from "./review-launcher.module.css";

type CandidateResponse = {
  candidateId?: string;
  code?: string;
  error?: string;
};

export default function ReviewLauncher() {
  const router = useRouter();
  const params = useSearchParams();
  const workspaceId = params.get("workspaceId")?.trim() ?? "";
  const brandId = params.get("brandId")?.trim() ?? "";
  const campaignId = params.get("campaignId")?.trim() ?? "";
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");

  if (!workspaceId || !campaignId) return null;

  async function resolveExistingCandidate() {
    const response = await fetch(
      `/api/campaigns/${encodeURIComponent(campaignId)}/release-candidates/latest?workspaceId=${encodeURIComponent(workspaceId)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as CandidateResponse;
    if (!response.ok || !payload.candidateId) {
      throw new Error(payload.error || "Existing release candidate could not be opened.");
    }
    return payload.candidateId;
  }

  async function startReview() {
    if (state === "working") return;
    setState("working");
    setError("");

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/release-candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const payload = (await response.json()) as CandidateResponse;

      let candidateId = payload.candidateId;
      if (!response.ok) {
        if (response.status === 409 && payload.code === "CANDIDATE_EXISTS") {
          candidateId = await resolveExistingCandidate();
        } else {
          throw new Error(payload.error || "Release review could not be started.");
        }
      }

      if (!candidateId) throw new Error("Release review did not return a candidate id.");

      const query = new URLSearchParams({ workspaceId });
      if (brandId) query.set("brandId", brandId);
      router.push(`/review/${encodeURIComponent(candidateId)}?${query.toString()}`);
    } catch (caught) {
      setState("error");
      setError(caught instanceof Error ? caught.message : "Release review could not be started.");
    }
  }

  return (
    <aside className={styles.launcher} aria-live="polite">
      <div>
        <span className={styles.kicker}>Release workflow</span>
        <strong>Latest saved version</strong>
        <small>Renderer → Inbox Lab → approval</small>
      </div>
      <button type="button" onClick={startReview} disabled={state === "working"}>
        {state === "working" ? "Preparing…" : "Start review"}
      </button>
      {state === "error" ? <p>{error}</p> : null}
    </aside>
  );
}
