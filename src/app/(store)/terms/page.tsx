import { getSettings } from "@/lib/settings";

export const metadata = { title: "Terms & Refund Policy" };

export default async function Terms() {
  const s = await getSettings();
  return (
    <section className="section max-w-3xl">
      <h1 className="h2">Terms &amp; Refund Policy</h1>
      <div className="prose-store mt-8">
        <p>
          All products sold on {s.store.name} are digital goods delivered instantly after payment. By purchasing you get a personal,
          non-transferable license to use the product. Reselling or redistributing the files is not permitted.
        </p>
        <h2>Refunds</h2>
        <p>
          Because products are delivered instantly, refunds are handled case by case. If a product doesn&apos;t work as described,
          contact us within 7 days at {s.store.supportEmail} and we&apos;ll fix it or refund you.
        </p>
        <h2>Payments</h2>
        <p>
          UPI payments are confirmed automatically, usually within a minute. In rare cases a payment is held for manual verification;
          your order will be delivered as soon as it is confirmed.
        </p>
        <p className="text-sm">Replace this page&apos;s content with your own legal text before going live.</p>
      </div>
    </section>
  );
}
