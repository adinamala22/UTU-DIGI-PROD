import { hmacHex, safeEqualHex, WebhookError, type PaymentProvider } from "./provider";

const API = "https://api.razorpay.com/v1";

function auth() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

/** Verifies the checkout.js success handler payload (order_id|payment_id signed with key secret). */
export function verifyRazorpayCheckout(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  return !!secret && safeEqualHex(signature, hmacHex(secret, `${orderId}|${paymentId}`));
}

export const razorpay: PaymentProvider = {
  id: "razorpay",

  async createPayment(input) {
    const res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: "INR",
        receipt: input.orderId.slice(0, 40),
        notes: { orderId: input.orderId },
      }),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Razorpay order failed: ${data.error?.description ?? res.status}`);
    // Our own page opens Razorpay Checkout.js for this order
    return { paymentId: data.id, redirectUrl: `/checkout/pay/${input.orderId}` };
  },

  verifyWebhook(rawBody, h) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new WebhookError("RAZORPAY_WEBHOOK_SECRET not configured", 500);
    const sig = h.get("x-razorpay-signature");
    if (!sig || !safeEqualHex(sig, hmacHex(secret, rawBody))) throw new WebhookError("Bad signature");
    const payload = JSON.parse(rawBody);
    const rawEvent: string = payload.event;
    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;
    const event =
      rawEvent === "payment.captured" || rawEvent === "order.paid" ? "paid" : "ignored";
    return {
      deliveryId: h.get("x-razorpay-event-id") ?? `${rawEvent}:${payment?.id ?? order?.id}`,
      rawEvent,
      event,
      orderId: payment?.notes?.orderId ?? order?.notes?.orderId,
      paymentId: payment?.order_id ?? order?.id,
      amountPaise: payment?.amount ?? order?.amount_paid,
      utr: payment?.acquirer_data?.rrn ?? payment?.id,
      payload,
    };
  },

  async getStatus(rzpOrderId) {
    const res = await fetch(`${API}/orders/${encodeURIComponent(rzpOrderId)}`, {
      headers: { Authorization: auth() },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Razorpay status failed (${res.status})`);
    const d = await res.json();
    return {
      paymentId: d.id,
      orderId: d.notes?.orderId,
      amountPaise: d.amount_paid || d.amount,
      status: d.status,
      paid: d.status === "paid",
    };
  },
};
