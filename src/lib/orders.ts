import "server-only";
import { db } from "./db";
import { getSettings } from "./settings";
import { getProvider, type ParsedWebhook } from "./payments";
import { downloadToken, generateLicenseKey, orderAccessKey } from "./tokens";
import { renderOrderEmail, renderOrderText, sendEmail } from "./email";
import type { LineItem } from "./pricing";
import type { Order } from "@prisma/client";

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const orderUrl = (orderId: string) => `${appUrl()}/order/${orderId}?k=${orderAccessKey(orderId)}`;

const RETRYABLE = ["PENDING", "FAILED", "EXPIRED", "CANCELLED"];

/**
 * Creates entitlements for every item. Idempotent: safe to call multiple times.
 * Returns true if the order is (now) fulfilled.
 */
export async function issueEntitlements(orderId: string, opts: { sendMail?: boolean } = {}) {
  const settings = await getSettings();
  const expiry = new Date(Date.now() + settings.delivery.downloadExpiryDays * 86400_000);

  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { entitlements: true } });
    if (!order) throw new Error("Order not found");
    if (order.status === "FULFILLED") return { order, fresh: false };
    if (order.status !== "PAID") throw new Error(`Cannot fulfil order in status ${order.status}`);

    const items = order.items as LineItem[];
    for (const item of items) {
      if (order.entitlements.some((e) => e.productId === item.productId)) continue;
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;

      let licenseKey: string | null = null;
      if (product.deliveryType === "LICENSE") {
        const free = await tx.licenseKey.findFirst({ where: { productId: product.id, orderId: null }, orderBy: { createdAt: "asc" } });
        if (free) {
          const claimed = await tx.licenseKey.updateMany({
            where: { id: free.id, orderId: null },
            data: { orderId: order.id, claimedAt: new Date() },
          });
          if (claimed.count) licenseKey = free.key;
        }
        if (!licenseKey && product.autoLicense) {
          licenseKey = generateLicenseKey();
          await tx.licenseKey.create({ data: { productId: product.id, key: licenseKey, orderId: order.id, claimedAt: new Date() } });
        }
        if (!licenseKey) {
          await tx.auditLog.create({ data: { actor: "system", action: "license.pool_empty", target: product.id, meta: { orderId } } });
        }
      }

      await tx.entitlement.create({
        data: {
          orderId: order.id,
          productId: product.id,
          licenseKey,
          externalUrl: product.deliveryType === "LINK" ? product.externalUrl : null,
          expiresAt: product.deliveryType === "FILE" ? expiry : null,
          maxDownloads: settings.delivery.maxDownloads,
        },
      });
      await tx.product.update({ where: { id: product.id }, data: { soldCount: { increment: 1 } } });
    }

    if (order.couponCode) {
      await tx.coupon.updateMany({ where: { code: order.couponCode }, data: { usedCount: { increment: 1 } } });
    }
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: "FULFILLED", fulfilledAt: new Date() },
    });
    return { order: updated, fresh: true };
  });

  if (result.fresh && opts.sendMail !== false) await sendOrderEmail(orderId);
  return true;
}

export async function getDeliverables(orderId: string) {
  const ents = await db.entitlement.findMany({ where: { orderId }, include: { product: true } });
  return ents.map((e) => ({
    id: e.id,
    title: e.product.title,
    type: e.product.deliveryType,
    revoked: e.revoked,
    expiresAt: e.expiresAt,
    downloadsLeft: Math.max(0, e.maxDownloads - e.downloadCount),
    downloadUrl: e.product.deliveryType === "FILE" ? `${appUrl()}/api/download/${downloadToken(e.id)}` : undefined,
    externalUrl: e.externalUrl ?? undefined,
    licenseKey: e.licenseKey ?? undefined,
  }));
}

export async function sendOrderEmail(orderId: string) {
  const [order, settings, items] = await Promise.all([
    db.order.findUniqueOrThrow({ where: { id: orderId } }),
    getSettings(),
    getDeliverables(orderId),
  ]);
  const opts = {
    storeName: settings.store.name,
    logoUrl: settings.store.logoUrl,
    primary: settings.theme.primary,
    primary2: settings.theme.primary2,
    name: order.name,
    email: order.email,
    orderId: order.id,
    paidAt: order.paidAt,
    lines: ((order.items as LineItem[] | null) ?? []).map((l) => ({ title: l.title, price: l.price })),
    subtotal: order.subtotal,
    discount: order.discount,
    couponCode: order.couponCode,
    total: order.total,
    utr: order.utr,
    orderUrl: orderUrl(order.id),
    items: items.filter((i) => !i.revoked),
    supportWhatsapp: settings.store.supportWhatsapp,
    supportEmail: settings.store.supportEmail,
    mainSiteUrl: settings.store.mainSiteUrl,
    expiryDays: settings.delivery.downloadExpiryDays,
  };
  const title = items.length === 1 ? items[0].title : `your ${settings.store.name} order`;
  const res = await sendEmail(
    order.email,
    `✅ Your access to ${title} is ready`,
    renderOrderEmail(opts),
    renderOrderText(opts),
    settings.store.supportEmail || undefined,
  );
  if (res.ok) await db.order.update({ where: { id: orderId }, data: { emailSentAt: new Date() } });
  return res;
}

/**
 * Verify with the gateway (never trust the webhook body alone) and mark paid.
 * Returns the new status.
 */
export async function confirmPaid(order: Order, utr?: string) {
  if (!RETRYABLE.includes(order.status)) return order.status;
  if (!order.gatewayPaymentId) throw new Error("Order has no gateway payment id");
  const remote = await getProvider(order.gateway).getStatus(order.gatewayPaymentId);
  const mismatch =
    !remote.paid || remote.amountPaise !== order.total || (remote.orderId && remote.orderId !== order.id);
  if (mismatch) {
    if (remote.paid) {
      await db.order.update({ where: { id: order.id }, data: { status: "REVIEW" } });
      await db.auditLog.create({
        data: { actor: "system", action: "payment.mismatch", target: order.id, meta: { remote, expected: order.total } },
      });
      return "REVIEW";
    }
    return order.status;
  }
  const moved = await db.order.updateMany({
    where: { id: order.id, status: { in: RETRYABLE as Order["status"][] } },
    data: { status: "PAID", paidAt: new Date(), utr: utr ?? remote.utr ?? order.utr },
  });
  if (moved.count) await issueEntitlements(order.id);
  return "FULFILLED";
}

export async function applyWebhook(gateway: string, evt: ParsedWebhook) {
  const order = evt.orderId
    ? await db.order.findUnique({ where: { id: evt.orderId } })
    : evt.paymentId
      ? await db.order.findFirst({ where: { gatewayPaymentId: evt.paymentId } })
      : null;
  if (!order) return { ok: false, reason: "order not found" };
  if (order.gateway !== gateway) return { ok: false, reason: "gateway mismatch" };
  if (evt.paymentId && order.gatewayPaymentId && evt.paymentId !== order.gatewayPaymentId && gateway === "youpi") {
    return { ok: false, reason: "payment id mismatch" };
  }

  switch (evt.event) {
    case "paid":
      return { ok: true, status: await confirmPaid(order, evt.utr) };
    case "reconciled": {
      await db.order.update({ where: { id: order.id }, data: { settlementState: "RECONCILED", utr: evt.utr ?? order.utr } });
      const status = order.status === "PENDING" ? await confirmPaid(order, evt.utr) : order.status;
      return { ok: true, status };
    }
    case "review":
      if (["PENDING", "PAID"].includes(order.status)) {
        await db.order.update({ where: { id: order.id }, data: { status: "REVIEW", utr: evt.utr ?? order.utr } });
      }
      return { ok: true, status: "REVIEW" };
    case "failed":
    case "expired":
    case "cancelled": {
      const status = evt.event.toUpperCase() as "FAILED" | "EXPIRED" | "CANCELLED";
      await db.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status } });
      return { ok: true, status };
    }
    default:
      return { ok: true, status: order.status };
  }
}

export async function revokeOrder(orderId: string) {
  await db.$transaction([
    db.entitlement.updateMany({ where: { orderId }, data: { revoked: true } }),
    db.order.update({ where: { id: orderId }, data: { status: "REVOKED" } }),
  ]);
}

/** Admin approves a REVIEW order (e.g. after checking UTR in bank app). */
export async function approveOrder(orderId: string) {
  const moved = await db.order.updateMany({
    where: { id: orderId, status: { in: ["REVIEW", "PENDING", "FAILED", "EXPIRED", "CANCELLED", "REVOKED"] } },
    data: { status: "PAID", paidAt: new Date() },
  });
  await db.entitlement.updateMany({ where: { orderId }, data: { revoked: false } });
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (moved.count) {
    // previously-revoked orders already have entitlements: just mark fulfilled
    const has = await db.entitlement.count({ where: { orderId } });
    if (has) await db.order.update({ where: { id: orderId }, data: { status: "FULFILLED", fulfilledAt: order.fulfilledAt ?? new Date() } });
    else await issueEntitlements(orderId);
  }
}
