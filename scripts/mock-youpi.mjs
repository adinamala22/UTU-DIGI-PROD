// Dev-only mock of the YouPI-PG merchant API + webhooks.
// Usage: node scripts/mock-youpi.mjs   (reads YOUPI_WEBHOOK_SECRET and APP_URL from .env)
// Implements: POST /api/v1/payments, GET /api/v1/payments/:id,
//             GET /checkout/:id (fake checkout page), POST /simulate/:id/:event
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const SECRET = process.env.YOUPI_WEBHOOK_SECRET || env.YOUPI_WEBHOOK_SECRET;
const APP = (process.env.APP_URL || env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const PORT = Number(process.env.MOCK_PORT || 6100);
const payments = new Map();

const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((r) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => r(d)); });

async function sendWebhook(p, event, overrides = {}) {
  const payload = {
    event,
    settlementState: event === "RECONCILED" ? "RECONCILED" : "NOT_RECONCILED",
    orderId: p.orderId,
    paymentId: p.paymentId,
    amount: p.amount,
    amountPaise: p.amountPaise,
    currency: "INR",
    method: "UPI",
    utr: p.utr,
    completedAt: new Date().toISOString(),
    deliveryId: crypto.randomUUID(),
    timestamp: Date.now(),
    ...overrides,
  };
  const raw = JSON.stringify(payload);
  const ts = String(Date.now());
  const res = await fetch(`${APP}/api/webhooks/youpi`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Event": event,
      "X-Gateway-Delivery-Id": payload.deliveryId,
      "X-Gateway-Timestamp": ts,
      "X-Gateway-Signature": "sha256=" + crypto.createHmac("sha256", SECRET).update(raw).digest("hex"),
      "X-Gateway-Signature-V2": crypto.createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex"),
    },
    body: raw,
  });
  return { status: res.status, body: await res.json().catch(() => null), deliveryId: payload.deliveryId };
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean);

    if (req.method === "POST" && url.pathname === "/api/v1/payments") {
      const b = JSON.parse((await readBody(req)) || "{}");
      if (!b.orderId || !b.amount) return json(res, 400, { error: "orderId and amount required" });
      const existing = [...payments.values()].find((p) => p.orderId === b.orderId);
      if (existing) return json(res, 200, existing.public());
      const paymentId = crypto.randomUUID();
      const p = {
        paymentId,
        orderId: b.orderId,
        amount: b.amount,
        amountPaise: Math.round(Number(b.amount) * 100),
        status: "ACTIVE",
        utr: String(Math.floor(1e11 + Math.random() * 9e11)),
        returnUrl: b.returnUrl,
        public() {
          return { paymentId, orderId: this.orderId, amount: this.amount, amountPaise: this.amountPaise, currency: "INR", status: this.status, queuePosition: 0, checkoutUrl: `http://localhost:${PORT}/checkout/${paymentId}` };
        },
      };
      payments.set(paymentId, p);
      console.log(`[mock-youpi] created ${paymentId} for order ${b.orderId} ₹${b.amount}`);
      return json(res, 201, p.public());
    }

    if (req.method === "GET" && parts[0] === "api" && parts[2] === "payments" && parts[3]) {
      const p = payments.get(parts[3]);
      if (!p) return json(res, 404, { error: "not found" });
      return json(res, 200, { ...p.public(), method: "UPI", utr: p.utr, verificationLevel: 1 });
    }

    if (req.method === "GET" && parts[0] === "checkout" && parts[1]) {
      const p = payments.get(parts[1]);
      if (!p) return json(res, 404, { error: "not found" });
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<!doctype html><body style="font-family:system-ui;background:#0a0a0b;color:#fff;text-align:center;padding:60px">
        <h2>MOCK YouPI checkout</h2><p>Order ${p.orderId}: ₹${p.amount}</p>
        <form method="post" action="/simulate/${p.paymentId}/OBSERVED_SUCCESS"><button style="font-size:20px;padding:12px 24px">✅ Simulate UPI payment</button></form><br>
        <form method="post" action="/simulate/${p.paymentId}/EXPIRED"><button>Simulate expiry</button></form></body>`);
    }

    if (req.method === "POST" && parts[0] === "simulate" && parts[1]) {
      const p = payments.get(parts[1]);
      if (!p) return json(res, 404, { error: "not found" });
      const event = parts[2] || "OBSERVED_SUCCESS";
      p.status = event;
      const r = await sendWebhook(p, event);
      console.log(`[mock-youpi] webhook ${event} → ${r.status}`, r.body);
      if (req.headers["content-type"]?.includes("application/json") || url.searchParams.has("json")) return json(res, 200, r);
      res.writeHead(303, { Location: p.returnUrl });
      return res.end();
    }

    json(res, 404, { error: "not found" });
  })
  .listen(PORT, () => console.log(`[mock-youpi] listening on http://localhost:${PORT} → webhooks to ${APP}`));
