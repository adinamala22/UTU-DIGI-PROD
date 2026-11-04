import type { GatewayId, PaymentProvider } from "./provider";
import { youpi } from "./youpi";
import { razorpay } from "./razorpay";

export const providers: Record<GatewayId, PaymentProvider> = { youpi, razorpay };

export function getProvider(id: string): PaymentProvider {
  const p = providers[id as GatewayId];
  if (!p) throw new Error(`Unknown gateway ${id}`);
  return p;
}

export const GATEWAY_LABELS: Record<GatewayId, { name: string; hint: string }> = {
  youpi: { name: "UPI (Scan & Pay)", hint: "GPay, PhonePe, Paytm, any UPI app" },
  razorpay: { name: "Cards / UPI / Netbanking", hint: "Secured by Razorpay" },
};

export * from "./provider";
