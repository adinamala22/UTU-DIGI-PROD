import "server-only";
import { z } from "zod";
import { db } from "./db";
import { buildQuote, isPurchasable } from "./pricing";

export const quoteSchema = z.object({
  slug: z.string().min(1).max(100),
  bump: z.boolean().optional().default(false),
  coupon: z.string().trim().max(40).optional().default(""),
});

export const checkoutSchema = quoteSchema.extend({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  city: z.string().trim().max(40).optional().default(""),
  gateway: z.enum(["youpi", "razorpay"]),
  utm: z.record(z.string(), z.string().max(100)).optional(),
});

/** Server-authoritative quote. Never trusts client prices. */
export async function serverQuote(input: z.infer<typeof quoteSchema>) {
  const product = await db.product.findUnique({ where: { slug: input.slug } });
  if (!product || !isPurchasable(product)) return { error: "This product is not available right now." as const };
  const bump =
    product.orderBumpProductId && product.orderBumpProductId !== product.id
      ? await db.product.findUnique({ where: { id: product.orderBumpProductId } })
      : null;
  const coupon = input.coupon ? await db.coupon.findUnique({ where: { code: input.coupon.toUpperCase() } }) : undefined;
  const quote = buildQuote({ product, bump, includeBump: input.bump, coupon });
  return { product, bump, quote, couponApplied: !!coupon && !quote.couponMessage ? coupon.code : null };
}
