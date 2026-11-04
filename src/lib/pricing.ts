// Pure pricing logic. Prices are always recomputed on the server from DB rows.

export type PricedProduct = {
  id: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  salePrice: number | null;
  saleEndsAt: Date | null;
  stockLimit: number | null;
  soldCount: number;
  status: string;
  orderBumpProductId?: string | null;
  orderBumpPrice?: number | null;
};

export type CouponLike = {
  code: string;
  type: string; // PERCENT | FLAT
  value: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  productIds: string[];
  active: boolean;
};

/** Current price. When the sale deadline passes the price reverts (honest urgency). */
export function effectivePrice(p: PricedProduct, now = new Date()) {
  if (p.saleEndsAt && p.saleEndsAt.getTime() <= now.getTime()) {
    return p.salePrice ?? p.compareAtPrice ?? p.price;
  }
  return p.price;
}

export function saleActive(p: PricedProduct, now = new Date()) {
  return !!p.saleEndsAt && p.saleEndsAt.getTime() > now.getTime();
}

export function stockLeft(p: Pick<PricedProduct, "stockLimit" | "soldCount">) {
  if (p.stockLimit == null) return null;
  return Math.max(0, p.stockLimit - p.soldCount);
}

export function isPurchasable(p: PricedProduct) {
  const left = stockLeft(p);
  return p.status === "LIVE" && (left == null || left > 0);
}

export function couponError(c: CouponLike | null, productIds: string[], now = new Date()): string | null {
  if (!c || !c.active) return "Invalid coupon code";
  if (c.expiresAt && c.expiresAt.getTime() < now.getTime()) return "This coupon has expired";
  if (c.maxUses != null && c.usedCount >= c.maxUses) return "This coupon has been fully redeemed";
  if (c.productIds.length && !productIds.some((id) => c.productIds.includes(id)))
    return "Coupon not valid for this product";
  return null;
}

export type LineItem = { productId: string; title: string; price: number; bump?: boolean };

export function buildQuote(opts: {
  product: PricedProduct;
  bump?: PricedProduct | null;
  includeBump?: boolean;
  coupon?: CouponLike | null;
  now?: Date;
}) {
  const now = opts.now ?? new Date();
  const items: LineItem[] = [
    { productId: opts.product.id, title: opts.product.title, price: effectivePrice(opts.product, now) },
  ];
  if (opts.includeBump && opts.bump && isPurchasable(opts.bump)) {
    items.push({
      productId: opts.bump.id,
      title: opts.bump.title,
      price: opts.product.orderBumpPrice ?? effectivePrice(opts.bump, now),
      bump: true,
    });
  }
  const subtotal = items.reduce((s, i) => s + i.price, 0);

  let discount = 0;
  let couponMessage: string | null = null;
  if (opts.coupon !== undefined) {
    couponMessage = couponError(opts.coupon, items.map((i) => i.productId), now);
    if (!couponMessage && opts.coupon) {
      const c = opts.coupon;
      // Coupon applies to eligible items only
      const eligible = items
        .filter((i) => !c.productIds.length || c.productIds.includes(i.productId))
        .reduce((s, i) => s + i.price, 0);
      discount = c.type === "FLAT" ? Math.min(c.value, eligible) : Math.round((eligible * Math.min(c.value, 100)) / 100);
    }
  }
  // UPI minimum ₹1
  const total = Math.max(100, subtotal - discount);
  discount = subtotal - total;
  return { items, subtotal, discount, total, couponMessage };
}
