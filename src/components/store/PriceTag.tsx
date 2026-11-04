"use client";
import { useState } from "react";
import { formatINR, percentOff } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PublicProduct } from "@/lib/catalog";

export function currentPrice(p: Pick<PublicProduct, "price" | "salePrice" | "compareAtPrice" | "saleEndsAt">, now = Date.now()) {
  if (p.saleEndsAt && new Date(p.saleEndsAt).getTime() <= now) return p.salePrice ?? p.compareAtPrice ?? p.price;
  return p.price;
}

export function PriceTag({ product, size = "md", className }: { product: PublicProduct; size?: "sm" | "md" | "lg"; className?: string }) {
  const [now] = useState(() => Date.now());
  const price = currentPrice(product, now);
  const off = percentOff(price, product.compareAtPrice);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <span className={cn("font-display font-black text-white", size === "lg" ? "text-5xl md:text-6xl" : size === "md" ? "text-3xl" : "text-2xl")}>
        {formatINR(price)}
      </span>
      {product.compareAtPrice && product.compareAtPrice > price && (
        <>
          <span className={cn("relative font-semibold text-muted", size === "lg" ? "text-2xl" : "text-lg")}>
            {formatINR(product.compareAtPrice)}
            <span className="absolute left-0 right-0 top-1/2 h-0.5 -rotate-6 bg-urgency" />
          </span>
          <span className="rounded-full bg-urgency px-3 py-1 text-xs font-black uppercase tracking-wider text-white">Save {off}%</span>
        </>
      )}
    </div>
  );
}
