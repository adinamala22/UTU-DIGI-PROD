import crypto from "node:crypto";

export type GatewayId = "youpi" | "razorpay";

export type CreatePaymentInput = {
  orderId: string;
  amountPaise: number;
  description: string;
  customer: { name: string; email: string; phone?: string | null };
  returnUrl: string;
};

export type CreatePaymentResult = { paymentId: string; redirectUrl: string };

export type NormalizedEvent =
  | "paid" // money observed: fulfil
  | "reconciled" // settlement confirmed against bank statement
  | "review" // gateway flagged for manual review: do not fulfil
  | "failed"
  | "expired"
  | "cancelled"
  | "ignored";

export type ParsedWebhook = {
  deliveryId: string;
  rawEvent: string;
  event: NormalizedEvent;
  orderId?: string;
  paymentId?: string;
  amountPaise?: number;
  utr?: string;
  payload: unknown;
};

export type RemoteStatus = {
  paymentId: string;
  orderId?: string;
  amountPaise: number;
  status: string;
  paid: boolean;
  utr?: string;
};

export interface PaymentProvider {
  id: GatewayId;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Throws WebhookError if the signature is invalid. */
  verifyWebhook(rawBody: string, headers: Headers): ParsedWebhook;
  getStatus(paymentId: string): Promise<RemoteStatus>;
}

export class WebhookError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function hmacHex(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string) {
  const strip = (s: string) => s.trim().replace(/^sha256=/i, "").toLowerCase();
  const ba = Buffer.from(strip(a), "utf8");
  const bb = Buffer.from(strip(b), "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
