import "server-only";
import { Resend } from "resend";
import { formatINR } from "./money";

type Delivered = { title: string; downloadUrl?: string; externalUrl?: string; licenseKey?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderOrderEmail(opts: {
  storeName: string;
  name: string;
  orderId: string;
  total: number;
  orderUrl: string;
  items: Delivered[];
  supportWhatsapp?: string;
  expiryDays: number;
}) {
  const rows = opts.items
    .map((i) => {
      const action = i.downloadUrl
        ? `<a href="${esc(i.downloadUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7e5bff,#4f7dff);color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:700">Download now</a>`
        : i.externalUrl
          ? `<a href="${esc(i.externalUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7e5bff,#4f7dff);color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:700">Get access</a>`
          : "";
      const key = i.licenseKey
        ? `<div style="margin-top:8px;font-family:monospace;background:#0f0f23;color:#4ade80;padding:10px;border-radius:8px">${esc(i.licenseKey)}</div>`
        : "";
      return `<tr><td style="padding:16px;border-bottom:1px solid #222"><div style="font-weight:700;color:#fff;margin-bottom:8px">${esc(i.title)}</div>${action}${key}</td></tr>`;
    })
    .join("");
  const wa = opts.supportWhatsapp
    ? `<p style="color:#9ca3af">Need help? <a style="color:#a78bfa" href="https://wa.me/${esc(opts.supportWhatsapp)}">WhatsApp us</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#0a0a0b;font-family:Inter,Arial,sans-serif;color:#e5e7eb">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<h1 style="margin:0 0 4px;font-size:24px;background:linear-gradient(135deg,#a855f7,#3b82f6);-webkit-background-clip:text;color:#a78bfa">You're in, ${esc(opts.name.split(" ")[0])}! 🎉</h1>
<p style="color:#9ca3af">Order <b>#${esc(opts.orderId.slice(-8).toUpperCase())}</b> · ${formatINR(opts.total)}</p>
<table width="100%" style="background:#12121a;border-radius:14px;border-collapse:collapse">${rows}</table>
<p style="color:#9ca3af;font-size:13px">Download links expire in ${opts.expiryDays} days. You can always revisit your <a style="color:#a78bfa" href="${esc(opts.orderUrl)}">order page</a>.</p>
${wa}
<p style="color:#6b7280;font-size:12px">${esc(opts.storeName)}</p>
</div></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:dev] to=${to} subject="${subject}" (set RESEND_API_KEY to send)`);
    return { ok: true, dev: true };
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "URL Tune Up <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  if (error) {
    console.error("[email] send failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
