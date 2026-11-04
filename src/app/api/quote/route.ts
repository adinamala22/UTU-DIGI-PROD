import { NextResponse } from "next/server";
import { quoteSchema, serverQuote } from "@/lib/checkout";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!rateLimit(`quote:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = quoteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const r = await serverQuote(parsed.data);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ...r.quote, couponApplied: r.couponApplied });
}
