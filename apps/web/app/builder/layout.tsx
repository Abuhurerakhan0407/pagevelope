import type { ReactNode } from "react";
import ReviewLauncher from "./review-launcher";

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ReviewLauncher />
    </>
  );
}
