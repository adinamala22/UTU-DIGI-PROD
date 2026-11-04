// End-to-end payment flow against a running store (APP_URL) + mock YouPI (npm run mock:youpi).
// Usage: npx tsx --env-file=.env scripts/e2e-youpi.ts
import crypto from "node:crypto";
import { orderAccessKey } from "../src/lib/tokens";

const APP = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const MOCK = "http://localhost:6100";
const SLUG = process.argv[2] || "ai-agency-automation-vault";
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : ` → ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

async function checkout(extra: Record<string, unknown> = {}) {
  const r = await post(`${APP}/api/checkout`, {
    slug: SLUG,
    name: "Ravi Kumar",
    email: "ravi@example.com",
    phone: "9876543210",
    city: "Pune",
    gateway: "youpi",
    ...extra,
  });
  const d = await r.json();
  return { ...d, status: r.status, paymentId: String(d.redirectUrl ?? "").split("/").pop() };
}
const status = async (orderId: string) => (await fetch(`${APP}/api/orders/${orderId}/status?k=${orderAccessKey(orderId)}`)).json();

async function main() {
  // 1. Happy path with coupon
  const o = await checkout({ coupon: "STAYWITHUS10" });
  check("checkout creates order + YouPI redirect", o.status === 200 && o.redirectUrl?.startsWith(MOCK), o);
  check("status pending before payment", (await status(o.orderId)).status === "PENDING");
  check("wrong access key is rejected", (await fetch(`${APP}/api/orders/${o.orderId}/status?k=bad`)).status === 404);

  const sim = await (await post(`${MOCK}/simulate/${o.paymentId}/OBSERVED_SUCCESS?json=1`, {})).json();
  check("signed OBSERVED_SUCCESS webhook accepted", sim.status === 200 && sim.body?.status === "FULFILLED", sim);
  const s = await status(o.orderId);
  check("order fulfilled with deliverable", s.status === "FULFILLED" && s.deliverables?.length === 1, s);

  const rec = await (await post(`${MOCK}/simulate/${o.paymentId}/RECONCILED?json=1`, {})).json();
  check("RECONCILED webhook accepted", rec.status === 200, rec);

  // 2. Forged webhook (bad signature)
  const forged = JSON.stringify({ event: "OBSERVED_SUCCESS", orderId: o.orderId, paymentId: o.paymentId, amountPaise: 100, method: "UPI", utr: "1" });
  const bad = await post(`${APP}/api/webhooks/youpi`, forged, { "X-Gateway-Signature": "sha256=" + "0".repeat(64), "X-Gateway-Delivery-Id": "forged-1" });
  check("forged signature rejected (400)", bad.status === 400, bad.status);

  // 3. Validly-signed but spoofed "paid" for an order the gateway says is unpaid → stays pending
  const o2 = await checkout();
  const raw = JSON.stringify({ event: "OBSERVED_SUCCESS", orderId: o2.orderId, paymentId: o2.paymentId, amountPaise: 1, method: "UPI", utr: "999" });
  const sig = crypto.createHmac("sha256", process.env.YOUPI_WEBHOOK_SECRET!).update(raw).digest("hex");
  const spoof = await post(`${APP}/api/webhooks/youpi`, raw, { "X-Gateway-Signature": `sha256=${sig}`, "X-Gateway-Delivery-Id": `spoof-${Date.now()}`, "X-Gateway-Event": "OBSERVED_SUCCESS" });
  const spoofRes = await spoof.json();
  check("webhook not confirmed by gateway status re-check does not fulfil", (await status(o2.orderId)).status === "PENDING", spoofRes);

  // 4. Duplicate delivery id is idempotent
  const dup = await post(`${APP}/api/webhooks/youpi`, raw, { "X-Gateway-Signature": `sha256=${sig}`, "X-Gateway-Delivery-Id": "dup-1", "X-Gateway-Event": "OBSERVED_SUCCESS" });
  const dup2 = await post(`${APP}/api/webhooks/youpi`, raw, { "X-Gateway-Signature": `sha256=${sig}`, "X-Gateway-Delivery-Id": "dup-1", "X-Gateway-Event": "OBSERVED_SUCCESS" });
  check("duplicate delivery id deduplicated", dup.status === 200 && (await dup2.json()).duplicate === true);

  // 5. Expiry
  const o3 = await checkout();
  await post(`${MOCK}/simulate/${o3.paymentId}/EXPIRED?json=1`, {});
  check("EXPIRED webhook marks order expired", (await status(o3.orderId)).status === "EXPIRED");

  // 6. Client cannot set price
  const o4 = await checkout({ total: 1, price: 1 });
  const p4 = await (await fetch(`${MOCK}/api/v1/payments/${o4.paymentId}`)).json();
  check("server-side price used (client price ignored)", p4.amountPaise > 100, p4);

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
