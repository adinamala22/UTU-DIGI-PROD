import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { toPublicProduct } from "@/lib/catalog";
import { enabledGateways, getSettings } from "@/lib/settings";
import { isPurchasable } from "@/lib/pricing";
import { GATEWAY_LABELS } from "@/lib/payments";
import { CheckoutForm } from "./CheckoutForm";

export const metadata = { title: "Secure checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug } });
  if (!product || !isPurchasable(product)) notFound();
  const bump = product.orderBumpProductId ? await db.product.findUnique({ where: { id: product.orderBumpProductId } }) : null;
  const settings = await getSettings();
  const gateways = enabledGateways(settings)
    .filter((g) => product.allowedGateways.includes(g))
    .map((id) => ({ id, ...GATEWAY_LABELS[id] }));
  const def = settings.payments.defaultGateway;
  gateways.sort((a, b) => Number(b.id === def) - Number(a.id === def));

  return (
    <section className="section !pt-10">
      <CheckoutForm
        product={toPublicProduct(product)}
        bump={bump && bump.status === "LIVE" ? { ...toPublicProduct(bump), bumpPrice: product.orderBumpPrice } : null}
        gateways={gateways}
        guarantee={product.guaranteeText}
      />
    </section>
  );
}
