"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./motion-launcher.module.css";

export default function MotionLauncher() {
  const pathname = usePathname();
  const params = useSearchParams();
  const workspaceId = params.get("workspaceId")?.trim() ?? "";
  const brandId = params.get("brandId")?.trim() ?? "";
  const campaignId = params.get("campaignId")?.trim() ?? "";

  if (!workspaceId || !campaignId) return null;

  const query = new URLSearchParams({ workspaceId, campaignId });
  if (brandId) query.set("brandId", brandId);
  const inStudio = pathname.startsWith("/builder/motion");
  const href = `${inStudio ? "/builder" : "/builder/motion"}?${query.toString()}`;

  return (
    <aside className={styles.launcher}>
      <div>
        <span>Safe motion</span>
        <strong>{inStudio ? "Visual Builder" : "Motion Studio"}</strong>
        <small>{inStudio ? "Return to campaign blocks" : "GIF + Outlook first-frame proof"}</small>
      </div>
      <Link href={href}>{inStudio ? "Builder" : "Open"}</Link>
    </aside>
  );
}
