import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Check, Gift, Lock, ShieldCheck, Zap } from "lucide-react";
import { getFaqs, getProductBySlug, getTestimonials } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { formatINR } from "@/lib/money";
import { effectivePrice } from "@/lib/pricing";
import { VideoPlayer } from "@/components/store/VideoPlayer";
import { PriceTag } from "@/components/store/PriceTag";
import { Countdown } from "@/components/store/Countdown";
import { StockBar } from "@/components/store/StockBar";
import { StickyCta } from "@/components/store/Chrome";
import { RenderSection } from "@/components/store/sections/Sections";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return {};
  return { title: p.title, description: p.subtitle ?? undefined, openGraph: { images: p.images.slice(0, 1) } };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p || p.status !== "LIVE") notFound();
  const [settings, testimonials, faqs] = await Promise.all([getSettings(), getTestimonials(), getFaqs()]);
  const price = effectivePrice({ ...p, saleEndsAt: p.saleEndsAt ? new Date(p.saleEndsAt) : null });
  const soldOut = p.stockLimit != null && p.soldCount >= p.stockLimit;
  const bonusTotal = p.bonusItems.reduce((s, b) => s + (Number(b.value) || 0), 0);
  const data = { products: [p], videos: [], testimonials, faqs };

  return (
    <>
      <section className="section !pt-10">
        <Link href="/" className="text-sm text-muted hover:text-white">← All products</Link>
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-8">
            {p.videoUrl ? (
              <VideoPlayer url={p.videoUrl} title={`Watch: ${p.title}`} big className="border border-white/10 shadow-2xl" />
            ) : p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0]} alt={p.title} className="w-full rounded-[var(--radius)] border border-white/10" />
            ) : null}
            {p.images.length > (p.videoUrl ? 0 : 1) && (
              <div className="grid grid-cols-3 gap-3">
                {p.images.slice(p.videoUrl ? 0 : 1).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" className="aspect-video w-full rounded-xl object-cover" loading="lazy" />
                ))}
              </div>
            )}
            <div>
              {p.badge && <span className="rounded-full bg-urgency px-3 py-1 text-xs font-black uppercase tracking-wider text-white">🔥 {p.badge}</span>}
              <h1 className="mt-4 font-display text-4xl font-black leading-tight text-white md:text-5xl">{p.title}</h1>
              {p.subtitle && <p className="mt-3 text-lg text-muted">{p.subtitle}</p>}
            </div>
            {p.features.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {p.features.map((f) => (
                  <li key={f} className="card flex items-center gap-3 p-4 font-semibold text-white">
                    <Check className="h-5 w-5 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
            )}
            <div className="prose-store">
              <ReactMarkdown>{p.description}</ReactMarkdown>
            </div>
            {p.bonusItems.length > 0 && (
              <div className="card overflow-hidden">
                <div className="bg-brand px-6 py-3 font-black uppercase tracking-wider text-white">🎁 Everything included</div>
                {p.bonusItems.map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
                    <span className="flex items-center gap-3 text-white"><Gift className="h-4 w-4 text-accent" />{b.title}</span>
                    <span className="font-mono text-sm text-muted">{formatINR(Number(b.value) || 0)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-6 py-4 font-bold">
                  <span className="text-muted">Total value</span>
                  <span className="text-white line-through decoration-urgency decoration-2">{formatINR(bonusTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Sticky buy box */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative">
              <div className="absolute -inset-1 rounded-[calc(var(--radius)+4px)] bg-brand opacity-50 blur-lg" />
              <div className="card relative space-y-5 p-6">
                {p.saleEndsAt && new Date(p.saleEndsAt).getTime() > Date.now() && (
                  <div className="rounded-xl bg-urgency/10 p-4 text-center">
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-urgency">⚡ Launch price ends in</p>
                    <Countdown to={p.saleEndsAt} className="justify-center" />
                  </div>
                )}
                <PriceTag product={p} size="lg" />
                <StockBar limit={p.stockLimit} sold={p.soldCount} />
                {soldOut ? (
                  <button disabled className="btn-cta w-full">Sold out</button>
                ) : (
                  <Link href={`/checkout/${p.slug}`} className="btn-cta w-full">
                    Buy now <ArrowRight className="h-5 w-5" />
                  </Link>
                )}
                <ul className="space-y-2 text-sm text-muted">
                  <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-accent" /> Instant delivery after payment</li>
                  <li className="flex items-center gap-2"><Lock className="h-4 w-4 text-accent" /> Secure UPI / card checkout</li>
                  {p.guaranteeText && <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> {p.guaranteeText}</li>}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>
      <RenderSection type="testimonials" config={{ heading: "What buyers say" }} data={data} />
      <RenderSection type="faq" config={{ heading: "FAQ" }} data={data} />
      {settings.conversion.stickyCta && !soldOut && (
        <StickyCta href={`/checkout/${p.slug}`} label="Buy now" price={price} compareAt={p.compareAtPrice} />
      )}
    </>
  );
}
