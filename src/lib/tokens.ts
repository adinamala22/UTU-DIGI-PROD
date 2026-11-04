import crypto from "node:crypto";

function key(purpose: string) {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not set");
  return crypto.createHmac("sha256", s).update(purpose).digest();
}

function sign(purpose: string, value: string) {
  return crypto.createHmac("sha256", key(purpose)).update(value).digest("base64url").slice(0, 32);
}

function eq(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Secret key that grants access to an order page (included in return URL + email). */
export const orderAccessKey = (orderId: string) => sign("order", orderId);
export const checkOrderAccessKey = (orderId: string, k?: string | null) => !!k && eq(k, orderAccessKey(orderId));

/** Download token = entitlementId.signature (revocation/expiry enforced in DB). */
export const downloadToken = (entitlementId: string) => `${entitlementId}.${sign("dl", entitlementId)}`;
export function parseDownloadToken(token: string) {
  const [id, sig] = token.split(".");
  if (!id || !sig || !eq(sig, sign("dl", id))) return null;
  return id;
}

export function generateLicenseKey(prefix = "UTU") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(16);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${prefix}-${chars.match(/.{4}/g)!.join("-")}`;
}
