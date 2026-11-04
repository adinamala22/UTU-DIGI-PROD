import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/RevenueChart";

const PAID = ["FULFILLED", "PAID"] as const;

async function revenueSince(d: Date) {
  const r = await db.order.aggregate({ where: { status: { in: [...PAID] }, paidAt: { gte: d } }, _sum: { total: true }, _count: true });
  return { revenue: r._sum.total ?? 0, orders: r._count };
}

export default async function Dashboard() {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d7 = new Date(Date.now() - 7 * 86400_000);
  const d30 = new Date(Date.now() - 30 * 86400_000);

  const [today, week, month, created30, unreconciled, review, recent, paid30] = await Promise.all([
    revenueSince(startToday),
    revenueSince(d7),
    revenueSince(d30),
    db.order.count({ where: { createdAt: { gte: d30 } } }),
    db.order.count({ where: { status: "FULFILLED", settlementState: "NOT_RECONCILED", gateway: "youpi" } }),
    db.order.count({ where: { status: "REVIEW" } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.order.findMany({ where: { status: { in: [...PAID] }, paidAt: { gte: d30 } }, select: { total: true, paidAt: true, items: true } }),
  ]);

  // Daily series
  const days = new Map<string, { revenue: number; orders: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    days.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }
  const top = new Map<string, { title: string; count: number; revenue: number }>();
  for (const o of paid30) {
    const k = o.paidAt!.toISOString().slice(0, 10);
    const d = days.get(k);
    if (d) {
      d.revenue += o.total / 100;
      d.orders++;
    }
    for (const it of o.items as { productId: string; title: string; price: number }[]) {
      const t = top.get(it.productId) ?? { title: it.title, count: 0, revenue: 0 };
      t.count++;
      t.revenue += it.price;
      top.set(it.productId, t);
    }
  }
  const series = [...days].map(([day, v]) => ({ day: day.slice(5), ...v }));
  const topProducts = [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const conv = created30 ? Math.round((month.orders / created30) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Last 30 days at a glance" />
      {(unreconciled > 0 || review > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
          <AlertTriangle className="h-5 w-5" />
          {review > 0 && <Link href="/admin/orders?status=REVIEW" className="underline">{review} order(s) need manual review</Link>}
          {unreconciled > 0 && (
            <Link href="/admin/orders?settlement=NOT_RECONCILED" className="underline">
              {unreconciled} UPI order(s) delivered but not yet reconciled with bank statement
            </Link>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Today" value={formatINR(today.revenue)} sub={`${today.orders} orders`} />
        <Stat label="Last 7 days" value={formatINR(week.revenue)} sub={`${week.orders} orders`} />
        <Stat label="Last 30 days" value={formatINR(month.revenue)} sub={`${month.orders} orders`} />
        <Stat label="Checkout → paid" value={`${conv}%`} sub={`${created30} checkouts started`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Revenue" className="lg:col-span-2">
          <RevenueChart data={series} />
        </Panel>
        <Panel title="Top products">
          {topProducts.length === 0 && <p className="text-sm text-muted">No sales yet.</p>}
          <ul className="space-y-3">
            {topProducts.map((p) => (
              <li key={p.title} className="flex justify-between gap-2 text-sm">
                <span className="truncate text-white">{p.title}</span>
                <span className="shrink-0 text-muted">{p.count} · {formatINR(p.revenue)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-xs text-primary">View all →</Link>}>
        <OrdersMini orders={recent} />
      </Panel>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );
}

function OrdersMini({ orders }: { orders: { id: string; name: string; email: string; total: number; status: string; createdAt: Date; gateway: string }[] }) {
  if (!orders.length) return <p className="text-sm text-muted">No orders yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-white/5">
              <td className="py-2"><Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-primary">#{o.id.slice(-8).toUpperCase()}</Link></td>
              <td className="py-2 text-white">{o.name}<span className="ml-2 text-muted">{o.email}</span></td>
              <td className="py-2 text-white">{formatINR(o.total)}</td>
              <td className="py-2"><StatusBadge status={o.status} /></td>
              <td className="py-2 text-right text-xs text-muted">{o.createdAt.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
