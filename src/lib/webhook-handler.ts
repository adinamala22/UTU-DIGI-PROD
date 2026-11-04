import "server-only";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { getProvider, WebhookError } from "./payments";
import { applyWebhook } from "./orders";

/** Shared webhook pipeline: verify signature on raw body → dedupe → apply → record. */
export async function handleWebhook(gateway: "youpi" | "razorpay", req: Request) {
  const raw = await req.text();
  let evt;
  try {
    evt = getProvider(gateway).verifyWebhook(raw, req.headers);
  } catch (e) {
    const status = e instanceof WebhookError ? e.status : 400;
    console.warn(`[webhook:${gateway}] rejected: ${(e as Error).message}`);
    return NextResponse.json({ error: (e as Error).message }, { status });
  }

  // Idempotency on delivery id
  let record;
  try {
    record = await db.webhookEvent.create({
      data: { provider: gateway, deliveryId: evt.deliveryId, event: evt.rawEvent, payload: evt.payload as Prisma.InputJsonValue },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await db.webhookEvent.findUnique({ where: { provider_deliveryId: { provider: gateway, deliveryId: evt.deliveryId } } });
      if (existing?.processedAt) return NextResponse.json({ ok: true, duplicate: true });
      record = existing!;
    } else throw e;
  }

  try {
    const result = await applyWebhook(gateway, evt);
    await db.webhookEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date(), error: result.ok ? null : result.reason },
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error(`[webhook:${gateway}] processing failed`, e);
    await db.webhookEvent.update({ where: { id: record.id }, data: { error: String((e as Error).message).slice(0, 500) } });
    // 500 so the gateway retries
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
