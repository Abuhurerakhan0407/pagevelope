export type RazorpayPublicConfig = {
  keyId: string;
};

export type RazorpayServerConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

export function getRazorpayPublicConfig(): RazorpayPublicConfig | null {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();

  if (!keyId) return null;

  return { keyId };
}

export function getRazorpayServerConfig(): RazorpayServerConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (!keyId || !keySecret || !webhookSecret) return null;

  return { keyId, keySecret, webhookSecret };
}

export function requireRazorpayServerConfig(): RazorpayServerConfig {
  const config = getRazorpayServerConfig();

  if (!config) {
    throw new Error(
      "Razorpay billing is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET before enabling checkout.",
    );
  }

  return config;
}