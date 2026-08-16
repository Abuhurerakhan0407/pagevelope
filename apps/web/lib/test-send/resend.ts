type ResendTestConfig = {
  apiKey: string;
  from: string;
  replyTo?: string;
};

export class ResendConfigurationError extends Error {
  constructor() {
    super("Resend test delivery is not configured.");
    this.name = "ResendConfigurationError";
  }
}

export class ResendDeliveryError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Resend test delivery failed.");
    this.name = "ResendDeliveryError";
    this.code = code;
  }
}

export function getResendTestConfig(): ResendTestConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const replyTo = process.env.RESEND_REPLY_TO?.trim();

  if (!apiKey || !from) throw new ResendConfigurationError();

  return {
    apiKey,
    from,
    ...(replyTo ? { replyTo } : {}),
  };
}

function failureCode(status: number): string {
  if (status === 401 || status === 403) return "provider_auth";
  if (status === 408 || status === 429) return "provider_rate_limit";
  if (status >= 500) return "provider_unavailable";
  return "provider_rejected";
}

export async function sendResendTestEmail(input: {
  attemptId: string;
  recipient: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ messageId: string }> {
  const config = getResendTestConfig();

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `pagevelope-test-${input.attemptId}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.recipient],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new ResendDeliveryError("provider_network");
  }

  if (!response.ok) {
    throw new ResendDeliveryError(failureCode(response.status));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ResendDeliveryError("provider_invalid_response");
  }

  const messageId =
    typeof payload === "object" && payload !== null && "id" in payload && typeof payload.id === "string"
      ? payload.id.trim()
      : "";

  if (!messageId || messageId.length > 200) {
    throw new ResendDeliveryError("provider_invalid_response");
  }

  return { messageId };
}
