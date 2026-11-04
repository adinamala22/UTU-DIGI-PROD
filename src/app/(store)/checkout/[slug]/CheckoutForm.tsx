"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Lock, ShieldCheck, Tag, Zap } from "lucide-react";
import type { PublicProduct } from "@/lib/catalog";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Countdown } from "@/components/store/Countdown";

type Quote = { items: { productId: string; title: string; price: number; bump?: boolean }[]; subtotal: number; discount: number; total: number; couponMessage: string | null; couponApplied: string | null };
type Gateway = { id: "youpi" | "razorpay"; name: string; hint: string };

export function CheckoutForm({
  product,
  bump,
  gateways,
  guarantee,
}: {
  product: PublicProduct;
  bump: (PublicProduct & { bumpPrice: number | null }) | null;
  gateways: Gateway[];
  guarantee?: string | null;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "" });
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [withBump, setWithBump] = useState(false);
  const [gateway, setGateway] = useState<Gateway["id"] | undefined>(gateways[0]?.id);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchQuote = useCallback(
    async (code: string, b: boolean) => {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: product.slug, bump: b, coupon: code }),
      });
      const q = await res.json();
      if (!res.ok) {
        setError(q.error);
        return null;
      }
      setQuote(q);
      return q as Quote;
    },
    [product.slug],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem("utu_coupon") || new URLSearchParams(location.search).get("coupon") || "";
    if (saved) setCoupon(saved);
    fetchQuote(saved, false).then((q) => {
      if (saved && q?.couponApplied) setAppliedCoupon(q.couponApplied);
    });
  }, [fetchQuote]);

  async function applyCoupon() {
    setCouponMsg(null);
    const q = await fetchQuote(coupon, withBump);
    if (q?.couponMessage) {
      setCouponMsg(q.couponMessage);
      setAppliedCoupon("");
    } else if (q?.couponApplied) {
      setAppliedCoupon(q.couponApplied);
      setCouponMsg(`🎉 ${q.couponApplied} applied! You save ${formatINR(q.discount)}`);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!gateway) return;
    setBusy(true);
    setError(null);
    const utm = Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => k.startsWith("utm_")));
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, slug: product.slug, bump: withBump, coupon: appliedCoupon, gateway, utm }),
    });
    const data = await res.json().catch(() => ({ error: "Something went wrong" }));
    if (!res.ok) {
      setError(data.error);
      setBusy(false);
      return;
    }
    if (typeof window !== "undefined" && "fbq" in window) (window as unknown as { fbq: (...a: unknown[]) => void }).fbq("track", "InitiateCheckout", { value: (quote?.total ?? 0) / 100, currency: "INR" });
    sessionStorage.removeItem("utu_coupon");
    window.location.href = data.redirectUrl;
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const saleLive = product.saleEndsAt && new Date(product.saleEndsAt).getTime() > Date.now();

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        {saleLive && (
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-urgency/30 bg-urgency/10 p-4 text-sm font-bold text-white">
            ⏰ Your launch price is reserved for <Countdown to={product.saleEndsAt} variant="inline" className="text-urgency" />
          </div>
        )}
        <div className="card space-y-4 p-6">
          <h1 className="font-display text-2xl font-black text-white">1. Where should we send it?</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" value={form.name} onChange={set("name")} autoComplete="name" required />
            <Field label="Email (product is sent here)" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
            <Field label="WhatsApp number" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="98765 43210" />
            <Field label="City (optional)" value={form.city} onChange={set("city")} autoComplete="address-level2" />
          </div>
        </div>

        {bump && (
          <label
            className={cn(
              "relative block cursor-pointer rounded-[var(--radius)] border-2 border-dashed p-5 transition",
              withBump ? "border-success bg-success/10" : "border-accent/60 bg-accent/5 hover:bg-accent/10",
            )}
          >
            <span className="absolute -top-3 left-4 rounded-full bg-accent px-3 py-0.5 text-xs font-black uppercase text-black">One-time offer</span>
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                checked={withBump}
                onChange={(e) => {
                  setWithBump(e.target.checked);
                  fetchQuote(appliedCoupon, e.target.checked);
                }}
                className="mt-1 h-6 w-6 accent-[var(--c-success)]"
              />
              <div>
                <p className="font-black text-white">
                  YES! Add <span className="text-gradient">{bump.title}</span> for just {formatINR(bump.bumpPrice ?? bump.price)}
                  {bump.compareAtPrice && <span className="ml-2 text-sm text-muted line-through">{formatINR(bump.compareAtPrice)}</span>}
                </p>
                {bump.subtitle && <p className="mt-1 text-sm text-muted">{bump.subtitle}</p>}
                <p className="mt-1 text-xs font-bold text-accent">This offer is only available on this page.</p>
              </div>
            </div>
          </label>
        )}

        <div className="card space-y-3 p-6">
          <h2 className="font-display text-2xl font-black text-white">2. Choose payment</h2>
          {gateways.length === 0 && <p className="text-urgency">Payments are not configured yet.</p>}
          {gateways.map((g) => (
            <label
              key={g.id}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition",
                gateway === g.id ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/30",
              )}
            >
              <input type="radio" name="gateway" checked={gateway === g.id} onChange={() => setGateway(g.id)} className="h-5 w-5 accent-[var(--c-primary)]" />
              <div>
                <p className="font-bold text-white">{g.name}</p>
                <p className="text-sm text-muted">{g.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card space-y-4 p-6">
          <h2 className="font-display text-xl font-black text-white">Order summary</h2>
          <div className="space-y-3">
            {(quote?.items ?? [{ productId: product.id, title: product.title, price: product.price }]).map((i) => (
              <div key={i.productId} className="flex justify-between gap-4 text-sm">
                <span className="text-white">{i.title}{"bump" in i && i.bump && <span className="ml-1 text-xs text-accent">(add-on)</span>}</span>
                <span className="font-semibold text-white">{formatINR(i.price)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" className="input !pl-9 uppercase" />
            </div>
            <button type="button" onClick={applyCoupon} className="btn-secondary">Apply</button>
          </div>
          {couponMsg && <p className={cn("text-sm font-semibold", appliedCoupon ? "text-success" : "text-urgency")}>{couponMsg}</p>}
          <div className="space-y-2 border-t border-white/10 pt-4 text-sm">
            {quote && quote.discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span>−{formatINR(quote.discount)}</span>
              </div>
            )}
            <div className="flex items-end justify-between">
              <span className="font-bold text-white">Total</span>
              <AnimatePresence mode="popLayout">
                <motion.span key={quote?.total} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-4xl font-black text-white">
                  {formatINR(quote?.total ?? product.price)}
                </motion.span>
              </AnimatePresence>
            </div>
            {product.compareAtPrice && quote && product.compareAtPrice > quote.total && (
              <p className="text-right text-xs font-bold text-success">You&apos;re saving {formatINR(product.compareAtPrice - quote.total)} today</p>
            )}
          </div>
          {error && <p className="rounded-lg bg-urgency/10 p-3 text-sm font-semibold text-urgency">{error}</p>}
          <button type="submit" disabled={busy || !gateway} className="btn-cta w-full">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
            {busy ? "Securing your order…" : `Pay ${formatINR(quote?.total ?? product.price)}`}
          </button>
          <ul className="space-y-1.5 text-xs text-muted">
            <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-accent" /> Instant access on screen + email</li>
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> One-time payment, no subscription</li>
            {guarantee && <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-success" /> {guarantee}</li>}
          </ul>
        </div>
      </aside>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input {...props} className="input !py-3 !text-base" />
    </label>
  );
}
