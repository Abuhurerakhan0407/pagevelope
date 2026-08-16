import type { ReactNode } from "react";
import BuilderRouteNormalizer from "./route-normalizer";
import ReviewLauncher from "./review-launcher";

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BuilderRouteNormalizer />
      {children}
      <ReviewLauncher />
    </>
  );
}
