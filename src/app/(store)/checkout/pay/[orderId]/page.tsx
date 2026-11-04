import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkOrderAccessKey } from "@/lib/tokens";
import { getSettings } from "@/lib/settings";
import { orderUrl } from "@/lib/orders";
import { RazorpayLauncher } from "./RazorpayLauncher";

export const metadata = { robots: { index: false } };

export default async function PayPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ k?: string }> }) {
  const { orderId } = await params;
  const { k } = await searchParams;
  if (!checkOrderAccessKey(orderId, k)) notFound();
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.gateway !== "razorpay" || !order.gatewayPaymentId) notFound();
  if (order.status !== "PENDING") redirect(orderUrl(order.id));
  const s = await getSettings();
  return (
    <section className="section text-center">
      <RazorpayLauncher
        keyId={process.env.RAZORPAY_KEY_ID!}
        rzpOrderId={order.gatewayPaymentId}
        orderId={order.id}
        accessKey={k!}
        amount={order.total}
        name={s.store.name}
        description={(order.items as { title: string }[]).map((i) => i.title).join(" + ")}
        prefill={{ name: order.name, email: order.email, contact: order.phone ?? "" }}
        color={s.theme.primary}
        logo={s.store.logoUrl}
        returnUrl={orderUrl(order.id)}
      />
    </section>
  );
}
