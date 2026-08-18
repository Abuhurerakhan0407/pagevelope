import Razorpay from "razorpay";
import { requireRazorpayServerConfig } from "./env";

export function getRazorpayClient(): Razorpay {
  const config = requireRazorpayServerConfig();

  return new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });
}