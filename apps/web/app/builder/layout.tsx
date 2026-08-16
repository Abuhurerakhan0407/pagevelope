import { Suspense, type ReactNode } from "react";
import BuilderRouteNormalizer from "./route-normalizer";
import ReviewLauncher from "./review-launcher";

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <BuilderRouteNormalizer />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <ReviewLauncher />
      </Suspense>
    </>
  );
}
