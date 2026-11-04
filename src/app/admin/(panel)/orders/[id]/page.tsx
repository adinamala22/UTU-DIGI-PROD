import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { orderUrl } from "@/lib/orders";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { OrderActions } from "./OrderActions";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { entitlements: { include: { product: { select: { title: true } } } } } });
  if (!order) notFound();
  const [events, logs] = await Promise.all([
    db.webhookEvent.findMany({
      where: { OR: [{ payload: { path: ["orderId"], equals: id } }, { payload: { path: ["payload", "payment", "entity", "notes", "orderId"], equals: id } }] },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.auditLog.findMany({ where: { target: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const items = order.items as { title: string; price: number; bump?: boolean }[];

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm text-muted hover:text-white">← Orders</Link>
      <PageHeader title={`Order #${order.id.slice(-8).toUpperCase()}`} description={order.createdAt.toLocaleString("en-IN")}>
        <OrderActions id={order.id} status={order.status} settlement={order.settlementState} gateway={order.gateway} />
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Summary" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Info k="Status" v={<StatusBadge status={order.status} />} />
            <Info k="Settlement" v={<StatusBadge status={order.settlementState} />} />
            <Info k="Customer" v={<>{order.name}<br /><span className="text-muted">{order.email}</span></>} />
            <Info k="Phone / City" v={`${order.phone ?? "-"} / ${order.city ?? "-"}`} />
            <Info k="Gateway" v={order.gateway} />
            <Info k="Gateway payment id" v={<span className="font-mono text-xs">{order.gatewayPaymentId ?? "-"}</span>} />
            <Info k="UTR" v={<span className="font-mono">{order.utr ?? "-"}</span>} />
            <Info k="Paid at" v={order.paidAt?.toLocaleString("en-IN") ?? "-"} />
            <Info k="Email sent" v={order.emailSentAt?.toLocaleString("en-IN") ?? "-"} />
            <Info k="UTM" v={[order.utmSource, order.utmMedium, order.utmCampaign].filter(Boolean).join(" / ") || "-"} />
          </dl>
          <table className="mt-6 w-full text-sm">
            <tbody>
              {items.map((i, n) => (
                <tr key={n} className="border-t border-white/5">
                  <td className="py-2 text-white">{i.title}{i.bump && <span className="ml-2 text-xs text-accent">bump</span>}</td>
                  <td className="py-2 text-right text-white">{formatINR(i.price)}</td>
                </tr>
              ))}
              {order.discount > 0 && (
                <tr className="border-t border-white/5"><td className="py-2 text-green-400">Discount ({order.couponCode})</td><td className="py-2 text-right text-green-400">−{formatINR(order.discount)}</td></tr>
              )}
              <tr className="border-t border-white/10 font-bold"><td className="py-2 text-white">Total</td><td className="py-2 text-right text-white">{formatINR(order.total)}</td></tr>
            </tbody>
          </table>
          <p className="mt-4 break-all text-xs text-muted">Customer order page: <a className="text-primary" href={orderUrl(order.id)} target="_blank">{orderUrl(order.id)}</a></p>
        </Panel>
        <Panel title="Entitlements">
          {!order.entitlements.length && <p className="text-sm text-muted">None issued yet.</p>}
          <ul className="space-y-3 text-sm">
            {order.entitlements.map((e) => (
              <li key={e.id} className="rounded-lg bg-black/30 p-3">
                <div className="font-semibold text-white">{e.product.title}</div>
                {e.licenseKey && <div className="font-mono text-xs text-green-300">{e.licenseKey}</div>}
                {e.externalUrl && <div className="truncate text-xs text-muted">{e.externalUrl}</div>}
                <div className="text-xs text-muted">
                  {e.downloadCount}/{e.maxDownloads} downloads{e.expiresAt && ` · expires ${e.expiresAt.toLocaleDateString("en-IN")}`}
                  {e.revoked && <span className="ml-2 text-red-400">REVOKED</span>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Gateway webhooks">
          {!events.length && <p className="text-sm text-muted">No webhooks received.</p>}
          <ul className="space-y-2 text-xs">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 rounded bg-black/30 p-2">
                <span className="font-mono text-white">{e.event}</span>
                <span className={e.error ? "text-red-400" : "text-muted"}>{e.error ?? (e.processedAt ? "processed" : "pending")}</span>
                <span className="text-muted">{e.createdAt.toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Activity">
          {!logs.length && <p className="text-sm text-muted">No admin activity.</p>}
          <ul className="space-y-2 text-xs">
            {logs.map((l) => (
              <li key={l.id} className="flex justify-between gap-2"><span className="text-white">{l.action}</span><span className="text-muted">{l.actor} · {l.createdAt.toLocaleString("en-IN")}</span></li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted">{k}</dt>
      <dd className="mt-0.5 text-white">{v}</dd>
    </div>
  );
}
