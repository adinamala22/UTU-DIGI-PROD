"use client";
import { ContentManager } from "@/components/admin/ContentManager";

type Coupon = { id: string; code: string; type: string; value: number; maxUses: number | null; usedCount: number; expiresAt: string | null; productIds: string[]; active: boolean };

export function CouponManager({ rows, products }: { rows: Coupon[]; products: { id: string; title: string }[] }) {
  return (
    <ContentManager
      model="coupon"
      sortable={false}
      rows={rows}
      defaults={{ code: "", type: "PERCENT", value: 10, maxUses: null, expiresAt: null, productIds: [], active: true }}
      title={(r) => `${r.code}: ${r.type === "PERCENT" ? `${r.value}% off` : `₹${r.value} off`}`}
      summary={(r) =>
        [
          `${r.usedCount ?? 0}${r.maxUses ? `/${r.maxUses}` : ""} used`,
          r.expiresAt ? `expires ${new Date(String(r.expiresAt)).toLocaleDateString("en-IN")}` : "no expiry",
          (r.productIds as string[])?.length ? `${(r.productIds as string[]).length} product(s)` : "all products",
          r.active ? "" : "INACTIVE",
        ]
          .filter(Boolean)
          .join(" · ")
      }
      fields={[
        { key: "code", label: "Code", type: "text" },
        { key: "type", label: "Type", type: "select", options: [{ value: "PERCENT", label: "Percent off" }, { value: "FLAT", label: "Flat ₹ off" }] },
        { key: "value", label: "Value (% or ₹)", type: "number" },
        { key: "maxUses", label: "Max uses", type: "number", help: "Blank = unlimited" },
        { key: "expiresAt", label: "Expires on", type: "date" },
        { key: "productIds", label: "Limit to products", type: "multiselect", help: "None selected = all products", options: products.map((p) => ({ value: p.id, label: p.title })) },
        { key: "active", label: "Active", type: "boolean" },
      ]}
    />
  );
}
