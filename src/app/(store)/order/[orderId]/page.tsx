import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkOrderAccessKey } from "@/lib/tokens";
import { getSettings } from "@/lib/settings";
import { OrderStatus } from "./OrderStatus";

export const metadata = { title: "Your order", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ k?: string }> }) {
  const { orderId } = await params;
  const { k } = await searchParams;
  if (!checkOrderAccessKey(orderId, k)) notFound();
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();
  const s = await getSettings();
  return (
    <section className="section !pt-12">
      <OrderStatus
        orderId={order.id}
        accessKey={k!}
        initialStatus={order.status}
        total={order.total}
        email={order.email}
        items={(order.items as { title: string }[]).map((i) => i.title)}
        supportWhatsapp={s.store.supportWhatsapp}
      />
    </section>
  );
}
