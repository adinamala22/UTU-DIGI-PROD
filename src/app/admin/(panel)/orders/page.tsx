import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { PageHeader, StatusBadge } from "@/components/admin/ui";

const STATUSES = ["ALL", "FULFILLED", "PENDING", "REVIEW", "FAILED", "EXPIRED", "CANCELLED", "REVOKED"];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = sp.status && sp.status !== "ALL" ? sp.status : undefined;
  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status: status as Prisma.OrderWhereInput["status"] } : {}),
    ...(sp.settlement ? { settlementState: sp.settlement as "NOT_RECONCILED", status: "FULFILLED", gateway: "youpi" } : {}),
    ...(q
      ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { id: { endsWith: q.toLowerCase() } }, { utr: q }] }
      : {}),
  };
  const [orders, count] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50 }),
    db.order.count({ where }),
  ]);
  const qs = (o: Record<string, string | number | undefined>) =>
    "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

  return (
    <div>
      <PageHeader title="Orders" description={`${count} orders`}>
        <a href={`/api/admin/orders.csv${qs({})}`} className="btn-secondary"><Download className="h-4 w-4" /> Export CSV</a>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link key={s} href={qs({ status: s, page: undefined, settlement: undefined })} className={(sp.status ?? "ALL") === s ? "btn-primary !py-1 text-xs" : "btn-secondary !py-1 text-xs"}>
            {s}
          </Link>
        ))}
        <form className="ml-auto">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search email, name, #id, UTR" className="input !w-64" />
        </form>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Items</th>
              <th className="p-3">Total</th>
              <th className="p-3">Gateway</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-primary">#{o.id.slice(-8).toUpperCase()}</Link></td>
                <td className="p-3"><div className="text-white">{o.name}</div><div className="text-xs text-muted">{o.email}</div></td>
                <td className="max-w-56 truncate p-3 text-muted">{(o.items as { title: string }[]).map((i) => i.title).join(", ")}</td>
                <td className="p-3 font-semibold text-white">{formatINR(o.total)}</td>
                <td className="p-3 text-xs text-muted">{o.gateway}{o.utr && <div className="font-mono">UTR {o.utr}</div>}</td>
                <td className="space-y-1 p-3">
                  <StatusBadge status={o.status} />
                  {o.status === "FULFILLED" && o.gateway === "youpi" && <div><StatusBadge status={o.settlementState} /></div>}
                </td>
                <td className="p-3 text-xs text-muted">{o.createdAt.toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {!orders.length && (
              <tr><td colSpan={7} className="p-8 text-center text-muted">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {count > 50 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && <Link href={qs({ page: page - 1 })} className="btn-secondary">← Prev</Link>}
          {page * 50 < count && <Link href={qs({ page: page + 1 })} className="btn-secondary">Next →</Link>}
        </div>
      )}
    </div>
  );
}
