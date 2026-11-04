import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { CouponManager } from "./CouponManager";

export default async function CouponsPage() {
  const [rows, products] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    db.product.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Coupons" description="Percent or flat discounts. Use one as your exit-intent offer under Settings." />
      <CouponManager
        products={products}
        rows={rows.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          // Show flat values in rupees in the editor
          value: c.type === "FLAT" ? c.value / 100 : c.value,
          maxUses: c.maxUses,
          usedCount: c.usedCount,
          expiresAt: c.expiresAt?.toISOString() ?? null,
          productIds: c.productIds,
          active: c.active,
        }))}
      />
    </div>
  );
}
