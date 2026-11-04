import { describe, expect, it, beforeAll } from "vitest";
import crypto from "node:crypto";
import { mapYoupiEvent, verifyYoupiSignature, youpi } from "@/lib/payments/youpi";
import { verifyRazorpayCheckout, razorpay } from "@/lib/payments/razorpay";
import { WebhookError } from "@/lib/payments/provider";
import { checkOrderAccessKey, downloadToken, generateLicenseKey, orderAccessKey, parseDownloadToken } from "@/lib/tokens";

const SECRET = "whsec_test";
const hmac = (s: string, d: string) => crypto.createHmac("sha256", s).update(d).digest("hex");

beforeAll(() => {
  process.env.YOUPI_API_URL = "http://localhost:6100";
  process.env.YOUPI_WEBHOOK_SECRET = SECRET;
  process.env.RAZORPAY_KEY_SECRET = "rzp_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "rzp_wh";
  process.env.AUTH_SECRET = "x".repeat(64);
});

describe("YouPI webhook signature", () => {
  const body = JSON.stringify({ event: "OBSERVED_SUCCESS", orderId: "o1", paymentId: "p1", amountPaise: 99900, method: "UPI", utr: "123456789012" });

  it("accepts valid v1 signature (sha256= prefix)", () => {
    const h = new Headers({ "x-gateway-signature": `sha256=${hmac(SECRET, body)}` });
    expect(() => verifyYoupiSignature(body, h, SECRET)).not.toThrow();
  });

  it("accepts valid v2 signature with fresh timestamp", () => {
    const ts = String(Date.now());
    const h = new Headers({ "x-gateway-signature-v2": hmac(SECRET, `${ts}.${body}`), "x-gateway-timestamp": ts });
    expect(() => verifyYoupiSignature(body, h, SECRET)).not.toThrow();
  });

  it("rejects stale v2 timestamp", () => {
    const ts = String(Date.now() - 10 * 60_000);
    const h = new Headers({ "x-gateway-signature-v2": hmac(SECRET, `${ts}.${body}`), "x-gateway-timestamp": ts });
    expect(() => verifyYoupiSignature(body, h, SECRET)).toThrow(WebhookError);
  });

  it("rejects tampered body", () => {
    const h = new Headers({ "x-gateway-signature": `sha256=${hmac(SECRET, body)}` });
    expect(() => verifyYoupiSignature(body.replace("99900", "100"), h, SECRET)).toThrow(/Bad signature/);
  });

  it("rejects missing signature", () => {
    expect(() => verifyYoupiSignature(body, new Headers(), SECRET)).toThrow();
  });

  it("parses event via provider", () => {
    const h = new Headers({ "x-gateway-signature": `sha256=${hmac(SECRET, body)}`, "x-gateway-delivery-id": "d1", "x-gateway-event": "OBSERVED_SUCCESS" });
    const evt = youpi.verifyWebhook(body, h);
    expect(evt).toMatchObject({ deliveryId: "d1", event: "paid", orderId: "o1", amountPaise: 99900, utr: "123456789012" });
  });
});

describe("YouPI event mapping", () => {
  it("UPI observed with UTR is paid", () => expect(mapYoupiEvent("OBSERVED_SUCCESS", { method: "UPI", utr: "1" })).toBe("paid"));
  it("observed without UTR goes to review", () => expect(mapYoupiEvent("OBSERVED_SUCCESS", { method: "UPI" })).toBe("review"));
  it("COD success is ignored for digital goods", () => expect(mapYoupiEvent("SUCCESS", { method: "COD" })).toBe("ignored"));
  it("reconciled", () => expect(mapYoupiEvent("RECONCILED", { method: "UPI" })).toBe("reconciled"));
  it("manual review", () => expect(mapYoupiEvent("MANUAL_REVIEW", {})).toBe("review"));
  it("expired", () => expect(mapYoupiEvent("EXPIRED", {})).toBe("expired"));
});

describe("Razorpay", () => {
  it("verifies checkout signature", () => {
    const sig = hmac("rzp_secret", "order_1|pay_1");
    expect(verifyRazorpayCheckout("order_1", "pay_1", sig)).toBe(true);
    expect(verifyRazorpayCheckout("order_1", "pay_2", sig)).toBe(false);
  });
  it("verifies webhook and maps payment.captured", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 99900, notes: { orderId: "o1" } } } } });
    const h = new Headers({ "x-razorpay-signature": hmac("rzp_wh", body), "x-razorpay-event-id": "evt_1" });
    expect(razorpay.verifyWebhook(body, h)).toMatchObject({ event: "paid", orderId: "o1", paymentId: "order_1", amountPaise: 99900 });
  });
});

describe("tokens", () => {
  it("order access key round-trip", () => {
    const k = orderAccessKey("order123");
    expect(checkOrderAccessKey("order123", k)).toBe(true);
    expect(checkOrderAccessKey("order124", k)).toBe(false);
    expect(checkOrderAccessKey("order123", null)).toBe(false);
  });
  it("download token round-trip and tamper detection", () => {
    const t = downloadToken("ent1");
    expect(parseDownloadToken(t)).toBe("ent1");
    expect(parseDownloadToken(t.replace("ent1", "ent2"))).toBeNull();
    expect(parseDownloadToken("garbage")).toBeNull();
  });
  it("license key format", () => {
    expect(generateLicenseKey()).toMatch(/^UTU-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});
