import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const where: Prisma.OrderWhereInput = status && status !== "ALL" ? { status: status as Prisma.OrderWhereInput["status"] } : {};
  const orders = await db.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 20000 });
  const header = ["order_id", "created_at", "name", "email", "phone", "city", "items", "subtotal", "discount", "total", "coupon", "gateway", "status", "settlement", "utr", "paid_at", "utm_source", "utm_medium", "utm_campaign"];
  const rows = orders.map((o) =>
    [
      o.id,
      o.createdAt.toISOString(),
      o.name,
      o.email,
      o.phone,
      o.city,
      (o.items as { title: string }[]).map((i) => i.title).join(" | "),
      (o.subtotal / 100).toFixed(2),
      (o.discount / 100).toFixed(2),
      (o.total / 100).toFixed(2),
      o.couponCode,
      o.gateway,
      o.status,
      o.settlementState,
      o.utr,
      o.paidAt?.toISOString(),
      o.utmSource,
      o.utmMedium,
      o.utmCampaign,
    ]
      .map(esc)
      .join(","),
  );
  return new Response([header.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
