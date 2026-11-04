import "server-only";
import { cache } from "react";
import { db } from "./db";
import { sectionDef } from "./sections";
import type { Product } from "@prisma/client";

export type BonusItem = { title: string; value: number };

/** Serializable product for client components. */
export function toPublicProduct(p: Product) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    description: p.description,
    images: p.images,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    salePrice: p.salePrice,
    saleEndsAt: p.saleEndsAt?.toISOString() ?? null,
    stockLimit: p.stockLimit,
    soldCount: p.soldCount,
    badge: p.badge,
    videoUrl: p.videoUrl,
    features: p.features,
    bonusItems: (Array.isArray(p.bonusItems) ? p.bonusItems : []) as BonusItem[],
    guaranteeText: p.guaranteeText,
    status: p.status,
    deliveryType: p.deliveryType,
  };
}
export type PublicProduct = ReturnType<typeof toPublicProduct>;

export const getLiveProducts = cache(async () => {
  const rows = await db.product.findMany({ where: { status: "LIVE" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return rows.map(toPublicProduct);
});

export const getProductBySlug = cache(async (slug: string) => {
  const p = await db.product.findUnique({ where: { slug } });
  return p ? toPublicProduct(p) : null;
});

export async function getSections(page = "home", includeDisabled = false) {
  const rows = await db.pageSection.findMany({
    where: { page, ...(includeDisabled ? {} : { enabled: true }) },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    enabled: r.enabled,
    config: { ...(sectionDef(r.type)?.defaults ?? {}), ...(r.config as object) } as Record<string, unknown>,
  }));
}

export const getVideos = cache(() => db.video.findMany({ where: { enabled: true }, orderBy: [{ featured: "desc" }, { sortOrder: "asc" }] }));
export const getTestimonials = cache(() => db.testimonial.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }));
export const getFaqs = cache(() => db.faq.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }));

/** Real recent purchases for social-proof toasts (first name + city only). */
export async function getRecentPurchases(limit = 12) {
  const rows = await db.order.findMany({
    where: { status: "FULFILLED", fulfilledAt: { gte: new Date(Date.now() - 14 * 86400_000) } },
    orderBy: { fulfilledAt: "desc" },
    take: limit,
    select: { name: true, city: true, items: true, fulfilledAt: true },
  });
  return rows.map((r) => ({
    name: r.name.split(" ")[0].slice(0, 20),
    city: r.city ?? null,
    product: ((r.items as { title: string }[])[0]?.title ?? "").slice(0, 60),
    at: r.fulfilledAt!.toISOString(),
  }));
}
