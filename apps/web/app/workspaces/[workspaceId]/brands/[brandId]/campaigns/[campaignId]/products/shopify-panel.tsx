"use client";

import { useState } from "react";
import styles from "./products.module.css";

type SyncResponse = {
  synced?: number;
  failed?: number;
  nextCursor?: string | null;
  hasNextPage?: boolean;
  error?: string;
};

export function ShopifyPanel({
  workspaceId,
  brandId,
  connectedShop,
}: {
  workspaceId: string;
  brandId: string;
  connectedShop: string | null;
}) {
  const [shop, setShop] = useState(connectedShop ?? "");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [message, setMessage] = useState(connectedShop ? `Connected · ${connectedShop}` : "Connect a Shopify store to import real products.");

  const connectUrl = shop.trim()
    ? `/api/integrations/shopify/start?workspaceId=${encodeURIComponent(workspaceId)}&brandId=${encodeURIComponent(brandId)}&shop=${encodeURIComponent(shop.trim())}`
    : "";

  async function syncProducts(nextCursor: string | null) {
    if (state === "syncing") return;
    setState("syncing");
    try {
      const response = await fetch("/api/integrations/shopify/sync-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, brandId, cursor: nextCursor }),
      });
      const payload = await response.json() as SyncResponse;
      if (!response.ok && response.status !== 207) {
        setState("error");
        setMessage(payload.error ?? "Shopify sync failed.");
        return;
      }
      setCursor(payload.nextCursor ?? null);
      setHasMore(Boolean(payload.hasNextPage));
      setState(payload.failed ? "error" : "success");
      setMessage(`${payload.synced ?? 0} products synced${payload.failed ? ` · ${payload.failed} failed` : ""}.`);
      window.location.reload();
    } catch {
      setState("error");
      setMessage("Shopify sync request could not reach Pagevelope.");
    }
  }

  return (
    <div className={styles.shopifyNote}>
      <span>Shopify</span>
      <strong>{connectedShop ? "Store connected" : "Connect product catalog"}</strong>
      <p>{message}</p>
      {connectedShop ? (
        <>
          <button type="button" onClick={() => syncProducts(hasMore ? cursor : null)} disabled={state === "syncing"}>
            {state === "syncing" ? "Syncing…" : hasMore ? "Sync next 50 products" : "Sync products"}
          </button>
          <small>Read-only product access. Manual products stay untouched.</small>
        </>
      ) : (
        <>
          <input
            value={shop}
            onChange={(event) => setShop(event.target.value)}
            placeholder="your-store.myshopify.com"
            aria-label="Shopify store domain"
          />
          <a href={connectUrl || undefined} aria-disabled={!connectUrl}>Connect Shopify</a>
          <small>Workspace owner/admin authorization required.</small>
        </>
      )}
    </div>
  );
}
