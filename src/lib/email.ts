import { Resend } from "resend";
import { formatINR } from "./money";

export type Delivered = {
  title: string;
  type?: string;
  downloadUrl?: string;
  externalUrl?: string;
  licenseKey?: string;
  downloadsLeft?: number;
};

export type OrderEmailOpts = {
  storeName: string;
  logoUrl?: string;
  primary?: string;
  primary2?: string;
  name: string;
  email: string;
  orderId: string;
  paidAt?: Date | null;
  lines: { title: string; price: number }[];
  subtotal: number;
  discount: number;
  couponCode?: string | null;
  total: number;
  utr?: string | null;
  orderUrl: string;
  items: Delivered[];
  supportWhatsapp?: string;
  supportEmail?: string;
  mainSiteUrl?: string;
  expiryDays: number;
};

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Bulletproof button: table-based so it renders in Outlook/Gmail. bg-color fallback under the gradient. */
function button(href: string, label: string, c1: string, c2: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" bgcolor="${c1}" style="border-radius:12px;background:${c1};background-image:linear-gradient(135deg,${c1},${c2})">
<a href="${esc(href)}" target="_blank" style="display:block;padding:16px 24px;font-family:${FONT};font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:.3px">${esc(label)} &rarr;</a>
</td></tr></table>`;
}

function itemCard(i: Delivered, c1: string, c2: string, expiryDays: number) {
  const kind = i.downloadUrl ? "DOWNLOAD" : i.licenseKey ? "LICENSE KEY" : i.externalUrl ? "INSTANT ACCESS" : "DIGITAL PRODUCT";
  const parts: string[] = [];
  if (i.externalUrl) parts.push(button(i.externalUrl, "Access your product", c1, c2));
  if (i.downloadUrl) {
    parts.push(button(i.downloadUrl, "Download now", c1, c2));
    parts.push(
      `<p style="margin:10px 0 0;font-family:${FONT};font-size:12px;color:#6b7280;text-align:center">Link valid for ${expiryDays} days${i.downloadsLeft != null ? ` &middot; ${i.downloadsLeft} downloads left` : ""}</p>`,
    );
  }
  if (i.licenseKey) {
    parts.push(`<p style="margin:${parts.length ? "16px" : "0"} 0 6px;font-family:${FONT};font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Your license key</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background:#0f0f1a;border-radius:10px;padding:14px 16px;font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:16px;font-weight:700;color:#4ade80;letter-spacing:1px;word-break:break-all">${esc(i.licenseKey)}</td></tr></table>`);
  }
  if (i.externalUrl && !i.downloadUrl) {
    parts.push(
      `<p style="margin:10px 0 0;font-family:${FONT};font-size:12px;color:#6b7280;text-align:center;word-break:break-all">Button not working? Copy this link:<br><a href="${esc(i.externalUrl)}" style="color:${c1}">${esc(i.externalUrl)}</a></p>`,
    );
  }
  return `<tr><td style="padding:0 0 16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:14px"><tr><td style="padding:22px">
<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:800;color:${c1};letter-spacing:1.5px">${kind}</p>
<p style="margin:0 0 16px;font-family:${FONT};font-size:18px;font-weight:800;color:#111827;line-height:1.3">${esc(i.title)}</p>
${parts.join("\n")}
</td></tr></table></td></tr>`;
}

export function renderOrderEmail(o: OrderEmailOpts) {
  const c1 = o.primary || "#7e5bff";
  const c2 = o.primary2 || "#4f7dff";
  const first = esc(o.name.trim().split(/\s+/)[0] || "there");
  const shortId = esc(o.orderId.slice(-8).toUpperCase());
  const date = (o.paidAt ?? new Date()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const logo = o.logoUrl
    ? `<img src="${esc(o.logoUrl)}" alt="${esc(o.storeName)}" height="36" style="height:36px;width:auto;border:0;display:block;margin:0 auto">`
    : `<span style="font-family:${FONT};font-size:20px;font-weight:900;color:#ffffff;letter-spacing:.3px">${esc(o.storeName)}</span>`;

  const row = (l: string, r: string, strong = false) =>
    `<tr><td style="padding:6px 0;font-family:${FONT};font-size:14px;color:${strong ? "#111827" : "#4b5563"};${strong ? "font-weight:800;" : ""}">${l}</td><td align="right" style="padding:6px 0;font-family:${FONT};font-size:14px;color:${strong ? "#111827" : "#4b5563"};${strong ? "font-weight:800;" : ""}">${r}</td></tr>`;
  const summary = [
    ...o.lines.map((l) => row(esc(l.title), formatINR(l.price))),
    o.discount > 0 ? row(`Discount${o.couponCode ? ` (${esc(o.couponCode)})` : ""}`, `&minus;${formatINR(o.discount)}`) : "",
    `<tr><td colspan="2" style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;padding:4px 0">&nbsp;</td></tr>`,
    row("Total paid", formatINR(o.total), true),
  ].join("");

  const support = [
    o.supportWhatsapp ? `<a href="https://wa.me/${esc(o.supportWhatsapp)}" style="color:${c1};text-decoration:none;font-weight:700">WhatsApp</a>` : "",
    o.supportEmail ? `<a href="mailto:${esc(o.supportEmail)}" style="color:${c1};text-decoration:none;font-weight:700">${esc(o.supportEmail)}</a>` : "",
  ].filter(Boolean).join(" &nbsp;&middot;&nbsp; ");

  const preheader = `Your access to ${o.items.map((i) => i.title).join(", ")} is ready inside.`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Your order is ready</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px">

<!-- header -->
<tr><td align="center" bgcolor="#0a0a0b" style="background:#0a0a0b;background-image:linear-gradient(135deg,#0a0a0b,#1a1a2e 60%,#16213e);border-radius:18px 18px 0 0;padding:28px 24px 36px">
${logo}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 0"><tr><td bgcolor="#16a34a" style="background:#16a34a;border-radius:999px;padding:6px 14px;font-family:${FONT};font-size:12px;font-weight:800;color:#ffffff;letter-spacing:1px">&#10003; PAYMENT CONFIRMED</td></tr></table>
<h1 style="margin:16px 0 8px;font-family:${FONT};font-size:30px;line-height:1.2;font-weight:900;color:#ffffff">You&rsquo;re in, ${first}! &#127881;</h1>
<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.5;color:#c4c8d4">Your purchase is ready. Your access ${o.items.length > 1 ? "links are" : "link is"} below.</p>
</td></tr>

<!-- body -->
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:28px 24px 8px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${o.items.length ? o.items.map((i) => itemCard(i, c1, c2, o.expiryDays)).join("\n") : `<tr><td style="padding:0 0 16px;font-family:${FONT};font-size:15px;color:#4b5563">Your order is being prepared. Open your order page below to see your access.</td></tr>`}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:4px 0 24px;font-family:${FONT};font-size:14px;color:#4b5563">
You can come back to everything anytime from your <a href="${esc(o.orderUrl)}" style="color:${c1};font-weight:700">order page</a>. Bookmark it or keep this email.
</td></tr></table>
</td></tr>

<!-- receipt -->
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 24px 28px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;border-radius:14px"><tr><td style="padding:20px">
<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;font-weight:800;color:#6b7280;letter-spacing:1.5px">RECEIPT</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${row("Order", `#${shortId}`)}${row("Date", date)}${o.utr ? row("UPI ref (UTR)", esc(o.utr)) : ""}${row("Email", esc(o.email))}
<tr><td colspan="2" style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;padding:4px 0">&nbsp;</td></tr>
${summary}
</table></td></tr></table>
</td></tr>

<!-- support -->
<tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;border-radius:0 0 18px 18px;border-top:1px solid #f3f4f6;padding:22px 24px 26px">
<p style="margin:0 0 6px;font-family:${FONT};font-size:15px;font-weight:800;color:#111827">Need a hand?</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:#4b5563">Just reply to this email${support ? ` or reach us on ${support}` : ""}. Real humans, fast replies.</p>
</td></tr>

<!-- footer -->
<tr><td align="center" style="padding:20px 24px;font-family:${FONT};font-size:12px;line-height:1.6;color:#9ca3af">
You received this email because you bought from ${esc(o.storeName)}.<br>
${o.mainSiteUrl ? `<a href="${esc(o.mainSiteUrl)}" style="color:#9ca3af">${esc(o.mainSiteUrl.replace(/^https?:\/\//, ""))}</a> &middot; ` : ""}Please don&rsquo;t share your access links. They&rsquo;re personal to you.
</td></tr>

</table></td></tr></table></body></html>`;
}

/** Plain-text alternative, which improves deliverability and works in text-only clients. */
export function renderOrderText(o: OrderEmailOpts) {
  const lines = [
    `You're in, ${o.name.trim().split(/\s+/)[0] || "there"}! Payment confirmed.`,
    "",
    ...o.items.flatMap((i) => [
      `== ${i.title} ==`,
      i.externalUrl ? `Access: ${i.externalUrl}` : "",
      i.downloadUrl ? `Download (valid ${o.expiryDays} days): ${i.downloadUrl}` : "",
      i.licenseKey ? `License key: ${i.licenseKey}` : "",
      "",
    ]),
    `Order page: ${o.orderUrl}`,
    "",
    `Order #${o.orderId.slice(-8).toUpperCase()} | Total paid: ${formatINR(o.total)}${o.utr ? ` | UTR ${o.utr}` : ""}`,
    "",
    `Need help? Reply to this email${o.supportWhatsapp ? ` or WhatsApp https://wa.me/${o.supportWhatsapp}` : ""}.`,
    o.storeName,
  ];
  return lines.filter((l, idx, a) => !(l === "" && a[idx - 1] === "")).join("\n");
}

export async function sendEmail(to: string, subject: string, html: string, text?: string, replyTo?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:dev] to=${to} subject="${subject}" (set RESEND_API_KEY to send)`);
    return { ok: true, dev: true };
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "URL Tune Up <purchase@urltuneup.com>",
    to,
    subject,
    html,
    ...(text ? { text } : {}),
    ...(replyTo ? { replyTo } : {}),
  });
  if (error) {
    console.error("[email] send failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
