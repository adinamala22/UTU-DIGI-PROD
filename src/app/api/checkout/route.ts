import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkoutSchema, serverQuote } from "@/lib/checkout";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { enabledGateways, getSettings } from "@/lib/settings";
import { getProvider } from "@/lib/payments";
import { appUrl, orderUrl } from "@/lib/orders";
import { orderAccessKey } from "@/lib/tokens";

export async function POST(req: Request) {
  if (!rateLimit(`checkout:${clientIp(req)}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details" }, { status: 400 });
  }
  const input = parsed.data;

  const settings = await getSettings();
  const gateways = enabledGateways(settings);
  if (!gateways.includes(input.gateway)) return NextResponse.json({ error: "Payment method unavailable" }, { status: 400 });

  const r = await serverQuote(input);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  if (!r.product.allowedGateways.includes(input.gateway)) {
    return NextResponse.json({ error: "This product can't be bought with that payment method" }, { status: 400 });
  }
  if (input.coupon && r.quote.couponMessage) return NextResponse.json({ error: r.quote.couponMessage }, { status: 400 });

  const order = await db.order.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone || null,
      city: input.city || null,
      items: r.quote.items,
      subtotal: r.quote.subtotal,
      discount: r.quote.discount,
      total: r.quote.total,
      couponCode: r.couponApplied,
      gateway: input.gateway,
      utmSource: input.utm?.utm_source,
      utmMedium: input.utm?.utm_medium,
      utmCampaign: input.utm?.utm_campaign,
    },
  });

  try {
    const provider = getProvider(input.gateway);
    const payment = await provider.createPayment({
      orderId: order.id,
      amountPaise: order.total,
      description: r.quote.items.map((i) => i.title).join(" + "),
      customer: { name: order.name, email: order.email, phone: order.phone },
      returnUrl: orderUrl(order.id),
    });
    await db.order.update({ where: { id: order.id }, data: { gatewayPaymentId: payment.paymentId } });
    const redirectUrl = payment.redirectUrl.startsWith("/")
      ? `${appUrl()}${payment.redirectUrl}?k=${orderAccessKey(order.id)}`
      : payment.redirectUrl;
    return NextResponse.json({ orderId: order.id, redirectUrl });
  } catch (e) {
    console.error("[checkout] gateway error", e);
    await db.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
    return NextResponse.json(
      { error: "Payment gateway is temporarily unavailable. Please try another payment method or retry shortly." },
      { status: 502 },
    );
  }
}
