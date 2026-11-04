import {
  hmacHex,
  safeEqualHex,
  WebhookError,
  type NormalizedEvent,
  type PaymentProvider,
  type ParsedWebhook,
} from "./provider";
import { toRupeeString } from "../money";

/**
 * YouPI-PG adapter (https://github.com/youpi-pg/YouPI-PG).
 * Endpoints per its openapi.yaml / docs/MERCHANT_INTEGRATION.md:
 *   POST /api/v1/payments        -> { paymentId, checkoutUrl, ... }
 *   GET  /api/v1/payments/{id}   -> { status, amountPaise, orderId, ... }
 * Webhooks are signed with HMAC-SHA256 (merchant webhookSecret):
 *   X-Gateway-Signature:    sha256=hex(hmac(rawBody))
 *   X-Gateway-Signature-V2: hex(hmac(`${X-Gateway-Timestamp}.${rawBody}`))
 */

const TOLERANCE_MS = 5 * 60 * 1000;

function cfg() {
  const base = process.env.YOUPI_API_URL?.replace(/\/$/, "");
  if (!base) throw new Error("YOUPI_API_URL is not configured");
  return {
    base,
    merchantId: process.env.YOUPI_MERCHANT_ID || "",
    secret: process.env.YOUPI_WEBHOOK_SECRET || "",
  };
}

function headers(extra: Record<string, string> = {}) {
  const { merchantId } = cfg();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(merchantId ? { "X-Merchant-Id": merchantId } : {}),
    ...extra,
  };
}

export function mapYoupiEvent(event: string, payload: { method?: string; utr?: string }): NormalizedEvent {
  switch (event) {
    case "OBSERVED_SUCCESS":
      // Only treat UPI observations with a UTR as paid. Anything else goes to review.
      return (payload.method ?? "UPI").toUpperCase() === "UPI" && payload.utr ? "paid" : "review";
    case "RECONCILED":
      return (payload.method ?? "UPI").toUpperCase() === "UPI" ? "reconciled" : "review";
    case "MANUAL_REVIEW":
      return "review";
    case "FAILED":
      return "failed";
    case "EXPIRED":
      return "expired";
    case "CANCELLED":
      return "cancelled";
    default:
      return "ignored"; // e.g. SUCCESS (COD/counter) is not valid for digital goods
  }
}

export function verifyYoupiSignature(rawBody: string, h: Headers, secret: string, now = Date.now()) {
  if (!secret) throw new WebhookError("YOUPI_WEBHOOK_SECRET not configured", 500);
  const v2 = h.get("x-gateway-signature-v2");
  const ts = h.get("x-gateway-timestamp");
  if (v2 && ts) {
    const tsMs = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
    if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > TOLERANCE_MS) throw new WebhookError("Stale webhook");
    if (!safeEqualHex(v2, hmacHex(secret, `${ts}.${rawBody}`))) throw new WebhookError("Bad signature");
    return;
  }
  const v1 = h.get("x-gateway-signature");
  if (!v1 || !safeEqualHex(v1, hmacHex(secret, rawBody))) throw new WebhookError("Bad signature");
}

export const youpi: PaymentProvider = {
  id: "youpi",

  async createPayment(input) {
    const { base } = cfg();
    const res = await fetch(`${base}/api/v1/payments`, {
      method: "POST",
      headers: headers({ "Idempotency-Key": input.orderId }),
      body: JSON.stringify({
        orderId: input.orderId,
        amount: toRupeeString(input.amountPaise),
        currency: "INR",
        description: input.description.slice(0, 140),
        customer: { name: input.customer.name, email: input.customer.email, phoneNumber: input.customer.phone ?? undefined },
        returnUrl: input.returnUrl,
        metadata: { source: "utu-store" },
      }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.checkoutUrl) {
      throw new Error(`YouPI create failed (${res.status}): ${data.error?.message ?? data.message ?? data.error ?? "unknown"}`);
    }
    return { paymentId: data.paymentId, redirectUrl: data.checkoutUrl };
  },

  verifyWebhook(rawBody, h): ParsedWebhook {
    verifyYoupiSignature(rawBody, h, cfg().secret);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new WebhookError("Invalid JSON");
    }
    const rawEvent = String(h.get("x-gateway-event") ?? payload.event ?? "");
    const deliveryId = String(h.get("x-gateway-delivery-id") ?? payload.deliveryId ?? "");
    if (!deliveryId) throw new WebhookError("Missing delivery id");
    return {
      deliveryId,
      rawEvent,
      event: mapYoupiEvent(rawEvent, payload as { method?: string; utr?: string }),
      orderId: payload.orderId as string | undefined,
      paymentId: payload.paymentId as string | undefined,
      amountPaise: payload.amountPaise != null ? Number(payload.amountPaise) : undefined,
      utr: (payload.utr as string) || undefined,
      payload,
    };
  },

  async getStatus(paymentId) {
    const { base } = cfg();
    const res = await fetch(`${base}/api/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`YouPI status failed (${res.status})`);
    const d = await res.json();
    return {
      paymentId: d.paymentId,
      orderId: d.orderId,
      amountPaise: Number(d.amountPaise ?? Math.round(Number(d.amount) * 100)),
      status: d.status,
      paid: ["OBSERVED_SUCCESS", "RECONCILED"].includes(d.status),
      utr: d.utr,
    };
  },
};
