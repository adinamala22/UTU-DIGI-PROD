import { describe, expect, it } from "vitest";
import { buildQuote, couponError, effectivePrice, isPurchasable, stockLeft, type CouponLike, type PricedProduct } from "@/lib/pricing";

const now = new Date("2026-11-04T12:00:00Z");
const base: PricedProduct = {
  id: "p1",
  title: "Vault",
  price: 99900,
  compareAtPrice: 499900,
  salePrice: 199900,
  saleEndsAt: new Date("2026-11-05T12:00:00Z"),
  stockLimit: 100,
  soldCount: 87,
  status: "LIVE",
  orderBumpProductId: "p2",
  orderBumpPrice: 19900,
};
const bump: PricedProduct = { ...base, id: "p2", title: "Prompts", price: 29900, saleEndsAt: null, stockLimit: null, soldCount: 0 };
const coupon = (c: Partial<CouponLike> = {}): CouponLike => ({
  code: "SAVE10",
  type: "PERCENT",
  value: 10,
  maxUses: null,
  usedCount: 0,
  expiresAt: null,
  productIds: [],
  active: true,
  ...c,
});

describe("effectivePrice", () => {
  it("uses launch price before deadline", () => expect(effectivePrice(base, now)).toBe(99900));
  it("reverts to salePrice after deadline", () => expect(effectivePrice(base, new Date("2026-11-06T00:00:00Z"))).toBe(199900));
  it("falls back to compareAt when no salePrice", () =>
    expect(effectivePrice({ ...base, salePrice: null }, new Date("2026-11-06T00:00:00Z"))).toBe(499900));
});

describe("stock", () => {
  it("computes stock left", () => expect(stockLeft(base)).toBe(13));
  it("unlimited is null", () => expect(stockLeft({ stockLimit: null, soldCount: 5 })).toBeNull());
  it("sold out is not purchasable", () => expect(isPurchasable({ ...base, soldCount: 100 })).toBe(false));
  it("draft is not purchasable", () => expect(isPurchasable({ ...base, status: "DRAFT" })).toBe(false));
});

describe("buildQuote", () => {
  it("single product", () => {
    const q = buildQuote({ product: base, now });
    expect(q.total).toBe(99900);
    expect(q.items).toHaveLength(1);
  });
  it("adds order bump at bump price", () => {
    const q = buildQuote({ product: base, bump, includeBump: true, now });
    expect(q.items[1]).toMatchObject({ productId: "p2", price: 19900, bump: true });
    expect(q.total).toBe(119800);
  });
  it("percent coupon across items", () => {
    const q = buildQuote({ product: base, bump, includeBump: true, coupon: coupon(), now });
    expect(q.discount).toBe(11980);
    expect(q.total).toBe(107820);
  });
  it("flat coupon capped to eligible amount and ₹1 minimum", () => {
    const q = buildQuote({ product: base, coupon: coupon({ type: "FLAT", value: 10_000_000 }), now });
    expect(q.total).toBe(100);
  });
  it("product-restricted coupon only discounts eligible items", () => {
    const q = buildQuote({ product: base, bump, includeBump: true, coupon: coupon({ productIds: ["p2"], value: 50 }), now });
    expect(q.discount).toBe(9950);
  });
  it("invalid coupon gives message and no discount", () => {
    const q = buildQuote({ product: base, coupon: null, now });
    expect(q.couponMessage).toBe("Invalid coupon code");
    expect(q.discount).toBe(0);
  });
});

describe("couponError", () => {
  it("expired", () => expect(couponError(coupon({ expiresAt: new Date("2026-01-01") }), ["p1"], now)).toMatch(/expired/));
  it("exhausted", () => expect(couponError(coupon({ maxUses: 5, usedCount: 5 }), ["p1"], now)).toMatch(/fully redeemed/));
  it("wrong product", () => expect(couponError(coupon({ productIds: ["zzz"] }), ["p1"], now)).toMatch(/not valid/));
  it("inactive", () => expect(couponError(coupon({ active: false }), ["p1"], now)).toMatch(/Invalid/));
});
