"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/auth";
import { saveSettings as persistSettings, type SiteSettings } from "@/lib/settings";
import { uploadPrivate, uploadPublic } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { toPaise } from "@/lib/money";
import { approveOrder, revokeOrder, sendOrderEmail } from "@/lib/orders";
import { SECTION_DEFS } from "@/lib/sections";

type Result = { ok: true; id?: string; url?: string } | { ok: false; error: string };
const fail = (e: unknown): Result => ({ ok: false, error: e instanceof z.ZodError ? e.issues[0].message : (e as Error).message });

/* ------------------------------ Products ------------------------------ */

const optRupees = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : toPaise(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Invalid price");

const productSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(140),
  slug: z.string().trim().max(80).optional(),
  subtitle: z.string().trim().max(240).optional(),
  description: z.string().max(20000).default(""),
  price: z.string().trim().transform((v) => toPaise(v)).refine((v) => v >= 100, "Price must be at least ₹1"),
  compareAtPrice: optRupees,
  salePrice: optRupees,
  saleEndsAt: z.string().trim().transform((v) => (v ? new Date(v) : null)),
  stockLimit: z.string().trim().transform((v) => (v === "" ? null : Math.max(0, parseInt(v, 10)))),
  badge: z.string().trim().max(30).optional(),
  videoUrl: z.string().trim().max(300).optional(),
  status: z.enum(["DRAFT", "LIVE", "ARCHIVED"]),
  deliveryType: z.enum(["FILE", "LINK", "LICENSE"]),
  externalUrl: z.string().trim().max(500).optional(),
  autoLicense: z.boolean(),
  allowedGateways: z.array(z.enum(["youpi", "razorpay"])).min(1, "Select at least one gateway"),
  features: z.array(z.string().trim().min(1)).max(20),
  bonusItems: z.array(z.object({ title: z.string().trim().min(1), value: z.number().int().min(0) })).max(20),
  images: z.array(z.string().max(500)).max(12),
  orderBumpProductId: z.string().optional(),
  orderBumpPrice: optRupees,
  guaranteeText: z.string().trim().max(120).optional(),
});

export async function saveProduct(fd: FormData): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const json = JSON.parse(String(fd.get("data") ?? "{}"));
    const d = productSchema.parse(json);

    // New image uploads
    const images = [...d.images];
    for (const f of fd.getAll("newImages")) {
      if (f instanceof File && f.size > 0) images.push(await uploadPublic(f));
    }
    // Product file upload
    let fileKey: string | undefined;
    let fileName: string | undefined;
    const file = fd.get("productFile");
    if (file instanceof File && file.size > 0) {
      const up = await uploadPrivate(file);
      fileKey = up.key;
      fileName = up.fileName;
    }

    const slug = slugify(d.slug || d.title);
    if (!slug) throw new Error("Slug is required");
    if (d.externalUrl && !/^https?:\/\//.test(d.externalUrl)) throw new Error("External URL must start with http(s)://");

    const data = {
      title: d.title,
      slug,
      subtitle: d.subtitle || null,
      description: d.description,
      price: d.price,
      compareAtPrice: d.compareAtPrice,
      salePrice: d.salePrice,
      saleEndsAt: d.saleEndsAt,
      stockLimit: d.stockLimit,
      badge: d.badge || null,
      videoUrl: d.videoUrl || null,
      status: d.status,
      deliveryType: d.deliveryType,
      externalUrl: d.externalUrl || null,
      autoLicense: d.autoLicense,
      allowedGateways: d.allowedGateways,
      features: d.features,
      bonusItems: d.bonusItems,
      images,
      orderBumpProductId: d.orderBumpProductId && d.orderBumpProductId !== d.id ? d.orderBumpProductId : null,
      orderBumpPrice: d.orderBumpPrice,
      guaranteeText: d.guaranteeText || null,
      ...(fileKey ? { fileKey, fileName } : {}),
    };
    if (d.status === "LIVE" && d.deliveryType === "LINK" && !d.externalUrl) throw new Error("Add an external URL for link delivery");

    const product = d.id
      ? await db.product.update({ where: { id: d.id }, data })
      : await db.product.create({ data: { ...data, sortOrder: await db.product.count() } });
    if (product.status === "LIVE" && product.deliveryType === "FILE" && !product.fileKey) {
      throw new Error("Saved, but upload a product file before customers can download it");
    }
    await audit(admin.email, d.id ? "product.update" : "product.create", product.id, { title: product.title });
    revalidatePath("/", "layout");
    return { ok: true, id: product.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "That URL slug is already used" };
    return fail(e);
  }
}

export async function deleteProduct(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const orders = await db.entitlement.count({ where: { productId: id } });
  if (orders > 0) {
    await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit(admin.email, "product.archive", id);
    return { ok: true };
  }
  await db.product.delete({ where: { id } });
  await audit(admin.email, "product.delete", id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function duplicateProduct(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const p = await db.product.findUniqueOrThrow({ where: { id } });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt, updatedAt, soldCount, slug, title, bonusItems, ...rest } = p;
  const copy = await db.product.create({
    data: { ...rest, bonusItems: bonusItems ?? [], title: `${title} (copy)`, slug: `${slug}-copy-${Date.now().toString(36)}`, status: "DRAFT", soldCount: 0 },
  });
  await audit(admin.email, "product.duplicate", copy.id);
  return { ok: true, id: copy.id };
}

export async function reorder(model: "product" | "video" | "testimonial" | "faq", ids: string[]): Promise<Result> {
  await requireAdmin();
  const delegate = {
    product: db.product,
    video: db.video,
    testimonial: db.testimonial,
    faq: db.faq,
  }[model] as unknown as { update: (a: { where: { id: string }; data: { sortOrder: number } }) => Prisma.PrismaPromise<unknown> };
  await db.$transaction(ids.map((id, i) => delegate.update({ where: { id }, data: { sortOrder: i } })));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function importLicenseKeys(productId: string, text: string): Promise<Result & { added?: number }> {
  const admin = await requireAdmin();
  const keys = [...new Set(text.split(/[\r\n,]+/).map((k) => k.trim()).filter(Boolean))].slice(0, 10000);
  const res = await db.licenseKey.createMany({ data: keys.map((key) => ({ productId, key })), skipDuplicates: true });
  await audit(admin.email, "license.import", productId, { count: res.count });
  return { ok: true, added: res.count };
}

/* ------------------------------ Page builder ------------------------------ */

const sectionSchema = z.array(
  z.object({
    type: z.string().refine((t) => SECTION_DEFS.some((d) => d.type === t), "Unknown section"),
    enabled: z.boolean(),
    config: z.record(z.string(), z.unknown()),
  }),
);

export async function saveSections(page: string, sections: unknown): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const list = sectionSchema.parse(sections);
    await db.$transaction([
      db.pageSection.deleteMany({ where: { page } }),
      db.pageSection.createMany({
        data: list.map((s, i) => ({ page, type: s.type, enabled: s.enabled, sortOrder: i, config: s.config as Prisma.InputJsonValue })),
      }),
    ]);
    await audit(admin.email, "sections.save", page, { count: list.length });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------ Content (videos, testimonials, faq, coupons) ------------------------------ */

const contentSchemas = {
  video: z.object({
    title: z.string().trim().min(1).max(140),
    url: z.string().trim().regex(/(youtube\.com|youtu\.be|vimeo\.com)/, "Must be a YouTube or Vimeo URL"),
    caption: z.string().trim().max(300).nullable().optional(),
    featured: z.boolean().default(false),
    enabled: z.boolean().default(true),
  }),
  testimonial: z.object({
    name: z.string().trim().min(1).max(80),
    role: z.string().trim().max(80).nullable().optional(),
    avatarUrl: z.string().trim().max(500).nullable().optional(),
    quote: z.string().trim().min(1).max(600),
    rating: z.coerce.number().int().min(1).max(5).default(5),
    enabled: z.boolean().default(true),
  }),
  faq: z.object({
    question: z.string().trim().min(1).max(200),
    answer: z.string().trim().min(1).max(2000),
    enabled: z.boolean().default(true),
  }),
  coupon: z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Code: 3-30 letters/numbers"),
    type: z.enum(["PERCENT", "FLAT"]),
    value: z.coerce.number().positive(),
    maxUses: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable()),
    expiresAt: z.string().nullable().optional(),
    productIds: z.array(z.string()).default([]),
    active: z.boolean().default(true),
  }),
};
export type ContentModel = keyof typeof contentSchemas;

export async function saveContent(model: ContentModel, id: string | null, raw: unknown): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const parsed = contentSchemas[model].parse(raw) as Record<string, unknown>;
    if (model === "coupon") {
      if (parsed.type === "PERCENT" && Number(parsed.value) > 100) throw new Error("Percent must be ≤ 100");
      parsed.value = parsed.type === "FLAT" ? toPaise(Number(parsed.value)) : Math.round(Number(parsed.value));
      parsed.expiresAt = parsed.expiresAt ? new Date(String(parsed.expiresAt)) : null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (db as any)[model];
    if (model === "video" && parsed.featured) await db.video.updateMany({ where: id ? { NOT: { id } } : {}, data: { featured: false } });
    const row = id ? await delegate.update({ where: { id }, data: parsed }) : await delegate.create({ data: parsed });
    await audit(admin.email, `${model}.${id ? "update" : "create"}`, row.id);
    revalidatePath("/", "layout");
    return { ok: true, id: row.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "Already exists" };
    return fail(e);
  }
}

export async function deleteContent(model: ContentModel, id: string): Promise<Result> {
  const admin = await requireAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)[model].delete({ where: { id } });
  await audit(admin.email, `${model}.delete`, id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------ Settings / theme ------------------------------ */

export async function saveSettingsAction(patch: Partial<SiteSettings>): Promise<Result> {
  const admin = await requireAdmin();
  try {
    await persistSettings(patch);
    await audit(admin.email, "settings.update", Object.keys(patch).join(","));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadImageAction(fd: FormData): Promise<Result> {
  await requireAdmin();
  try {
    const f = fd.get("file");
    if (!(f instanceof File) || !f.size) throw new Error("No file");
    if (f.size > 5 * 1024 * 1024) throw new Error("Max 5MB");
    return { ok: true, url: await uploadPublic(f) };
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------ Orders ------------------------------ */

export async function orderAction(id: string, action: "approve" | "revoke" | "resend" | "reconcile"): Promise<Result> {
  const admin = await requireAdmin();
  try {
    if (action === "approve") await approveOrder(id);
    if (action === "revoke") await revokeOrder(id);
    if (action === "resend") {
      const r = await sendOrderEmail(id);
      if (!r.ok) throw new Error("Email failed to send");
    }
    if (action === "reconcile") await db.order.update({ where: { id }, data: { settlementState: "RECONCILED" } });
    await audit(admin.email, `order.${action}`, id);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
