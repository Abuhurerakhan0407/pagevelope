"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function BuilderRouteNormalizer() {
  const router = useRouter();
  const params = useSearchParams();
  const workspaceId = params.get("workspaceId")?.trim() ?? "";
  const campaignId = params.get("campaignId")?.trim() ?? "";
  const brandId = params.get("brandId")?.trim() ?? "";

  useEffect(() => {
    if (!workspaceId || !campaignId || brandId) return;
    const controller = new AbortController();

    fetch(`/api/campaigns/${encodeURIComponent(campaignId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Campaign route could not be normalized.");
        return response.json() as Promise<{ campaign?: { brand_id?: string } }>;
      })
      .then((payload) => {
        const resolvedBrandId = payload.campaign?.brand_id?.trim();
        if (!resolvedBrandId) return;
        const next = new URLSearchParams(params.toString());
        next.set("brandId", resolvedBrandId);
        router.replace(`/builder?${next.toString()}`);
      })
      .catch(() => {
        // Builder keeps its existing fail-closed/demo behavior if the route cannot be resolved.
      });

    return () => controller.abort();
  }, [brandId, campaignId, params, router, workspaceId]);

  return null;
}
