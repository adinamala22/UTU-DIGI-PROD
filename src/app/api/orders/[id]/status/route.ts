import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkOrderAccessKey } from "@/lib/tokens";
import { confirmPaid, getDeliverables } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/**
 * Polled by the order page. If the order is still pending after ~15s we also
 * pull the status from the gateway, in case a webhook was delayed or lost.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = new URL(req.url).searchParams.get("k");
  if (!checkOrderAccessKey(id, k)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!rateLimit(`status:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: "Slow down" }, { status: 429 });

  let order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (order.status === "PENDING" && order.gatewayPaymentId && Date.now() - order.createdAt.getTime() > 15_000) {
    try {
      await confirmPaid(order);
      order = (await db.order.findUnique({ where: { id } }))!;
    } catch (e) {
      console.warn("[status] gateway pull failed", (e as Error).message);
    }
  }

  const deliverables = order.status === "FULFILLED" ? await getDeliverables(id) : [];
  return NextResponse.json({
    status: order.status,
    total: order.total,
    deliverables: deliverables.filter((d) => !d.revoked),
  });
}
