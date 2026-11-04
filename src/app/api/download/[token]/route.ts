import { db } from "@/lib/db";
import { parseDownloadToken } from "@/lib/tokens";
import { deliverFile } from "@/lib/storage";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

function page(msg: string, status: number) {
  return new Response(
    `<!doctype html><html><body style="background:#0a0a0b;color:#e5e7eb;font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center"><div><h1>${msg}</h1><p style="color:#9ca3af">Need help? Reply to your order email or WhatsApp us.</p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!rateLimit(`dl:${clientIp(req)}`, 20, 60_000)) return page("Too many downloads, please wait a minute.", 429);
  const id = parseDownloadToken((await params).token);
  if (!id) return page("Invalid download link", 404);

  const ent = await db.entitlement.findUnique({ where: { id }, include: { product: true, order: true } });
  if (!ent || ent.revoked || ent.order.status !== "FULFILLED") return page("This download link is no longer active", 410);
  if (ent.expiresAt && ent.expiresAt < new Date()) return page("This download link has expired", 410);
  if (!ent.product.fileKey) return page("File not available yet", 404);

  // Atomic increment guarded by the max-downloads limit
  const counted = await db.entitlement.updateMany({
    where: { id, downloadCount: { lt: ent.maxDownloads } },
    data: { downloadCount: { increment: 1 } },
  });
  if (!counted.count) return page("Download limit reached", 410);

  return deliverFile(ent.product.fileKey, ent.product.fileName || `${ent.product.slug}.zip`);
}
