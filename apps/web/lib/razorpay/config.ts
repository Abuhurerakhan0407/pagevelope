export type PlanId = "STARTER" | "PRO" | "AGENCY";

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  currency: "USD";
  tier: "starter" | "pro" | "agency";
  razorpayPlanId: string | undefined;
};

export function getPlans(): Plan[] {
  return [
    {
      id: "STARTER",
      name: "Starter",
      priceCents: 4900,
      currency: "USD",
      tier: "starter",
      razorpayPlanId: process.env.RAZORPAY_PLAN_ID_STARTER?.trim() || undefined,
    },
    {
      id: "PRO",
      name: "Pro",
      priceCents: 14900,
      currency: "USD",
      tier: "pro",
      razorpayPlanId: process.env.RAZORPAY_PLAN_ID_PRO?.trim() || undefined,
    },
    {
      id: "AGENCY",
      name: "Agency",
      priceCents: 39900,
      currency: "USD",
      tier: "agency",
      razorpayPlanId: process.env.RAZORPAY_PLAN_ID_AGENCY?.trim() || undefined,
    },
  ];
}

export function getPlan(planId: string): Plan | undefined {
  return getPlans().find((plan) => plan.id === planId);
}

export function getPlanByRazorpayId(razorpayPlanId: string): Plan | undefined {
  return getPlans().find((plan) => plan.razorpayPlanId === razorpayPlanId);
}

export function isPlanCheckoutReady(plan: Plan): boolean {
  return Boolean(plan.razorpayPlanId);
}