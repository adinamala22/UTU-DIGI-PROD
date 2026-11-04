import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyRazorpayCheckout } from "@/lib/payments/razorpay";
import { checkOrderAccessKey } from "@/lib/tokens";
import { confirmPaid } from "@/lib/orders";

const schema = z.object({
  orderId: z.string(),
  k: z.string(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

/** Called by Checkout.js success handler. Signature check + server-side status re-check. */
export async function POST(req: Request) {
  const p = schema.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const d = p.data;
  if (!checkOrderAccessKey(d.orderId, d.k)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await db.order.findUnique({ where: { id: d.orderId } });
  if (!order || order.gateway !== "razorpay" || order.gatewayPaymentId !== d.razorpay_order_id) {
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }
  if (!verifyRazorpayCheckout(d.razorpay_order_id, d.razorpay_payment_id, d.razorpay_signature)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const status = await confirmPaid(order, d.razorpay_payment_id);
  return NextResponse.json({ ok: true, status });
}
