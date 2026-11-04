"use client";
import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronDown, Gift, ShieldCheck, Star, Sparkles } from "lucide-react";
import type { PublicProduct } from "@/lib/catalog";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Countdown } from "../Countdown";
import { VideoPlayer } from "../VideoPlayer";
import { PriceTag, currentPrice } from "../PriceTag";
import { StockBar } from "../StockBar";
import { ProductCard } from "../ProductCard";
import { Reveal } from "../Engagement";

export type SectionData = {
  products: PublicProduct[];
  videos: { id: string; title: string; url: string; caption: string | null; featured: boolean }[];
  testimonials: { id: string; name: string; role: string | null; avatarUrl: string | null; quote: string; rating: number }[];
  faqs: { id: string; question: string; answer: string }[];
};

type Cfg = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const pick = (d: SectionData, slug: unknown) => d.products.find((p) => p.slug === slug) ?? d.products[0];
const buyHref = (p?: PublicProduct) => (p ? `/checkout/${p.slug}` : "/#products");

export function RenderSection({ type, config, data }: { type: string; config: Cfg; data: SectionData }) {
  switch (type) {
    case "hero":
      return <Hero c={config} p={pick(data, config.productSlug)} />;
    case "ticker":
      return <Ticker items={(config.items as string[]) ?? []} />;
    case "scarcity":
      return <Scarcity c={config} p={pick(data, config.productSlug)} />;
    case "products":
      return <Products c={config} products={data.products} />;
    case "video":
      return <Videos c={config} videos={data.videos} />;
    case "valueStack":
      return <ValueStack c={config} p={pick(data, config.productSlug)} />;
    case "testimonials":
      return <Testimonials c={config} items={data.testimonials} />;
    case "guarantee":
      return <Guarantee c={config} />;
    case "faq":
      return <Faq c={config} items={data.faqs} />;
    case "finalCta":
      return <FinalCta c={config} p={pick(data, config.productSlug)} />;
    default:
      return null;
  }
}

function Hero({ c, p }: { c: Cfg; p?: PublicProduct }) {
  const headline = str(c.headline);
  const highlight = str(c.highlight);
  const video = str(c.videoUrl) || p?.videoUrl;
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/30 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-accent/20 blur-[120px]" />
      <div className="section relative grid items-center gap-12 !pt-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          {str(c.eyebrow) && (
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-urgency/40 bg-urgency/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white"
            >
              <span className="h-2 w-2 animate-ping rounded-full bg-urgency" />
              {str(c.eyebrow)}
            </motion.span>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="mt-6 font-display text-5xl font-black leading-[0.95] tracking-tight text-white md:text-7xl"
          >
            {headline} {highlight && <span className="text-gradient">{highlight}</span>}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-6 max-w-xl text-lg text-muted md:text-xl">
            {str(c.subheadline)}
          </motion.p>
          {p && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-8 space-y-6">
              <PriceTag product={p} size="lg" />
              {c.showCountdown !== false && p.saleEndsAt && (
                <div>
                  <p className="mb-2 text-sm font-bold uppercase tracking-widest text-urgency">⏰ Price jumps to {formatINR(p.salePrice ?? p.compareAtPrice ?? p.price)} in</p>
                  <Countdown to={p.saleEndsAt} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4">
                <Link href={buyHref(p)} className="btn-cta">
                  {str(c.ctaText) || "Get instant access"} <ArrowRight className="h-5 w-5" />
                </Link>
                <a href="#videos" className="btn-ghost">▶ Watch demo</a>
              </div>
              {str(c.trustLine) && <p className="text-sm text-muted">{str(c.trustLine)}</p>}
            </motion.div>
          )}
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.9, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.2, type: "spring" }} className="relative">
          <div className="absolute -inset-4 rounded-[calc(var(--radius)+16px)] bg-brand opacity-40 blur-2xl" />
          {video ? (
            <VideoPlayer url={video} big className="relative border border-white/10 shadow-2xl" />
          ) : p?.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0]} alt={p.title} className="relative w-full rounded-[var(--radius)] border border-white/10 shadow-2xl" />
          ) : (
            <div className="card relative flex aspect-video items-center justify-center p-8 text-center font-display text-3xl font-black text-white">{p?.title}</div>
          )}
          {p?.stockLimit != null && (
            <div className="card absolute -bottom-6 -left-4 w-64 animate-float p-4 shadow-2xl md:-left-10">
              <StockBar limit={p.stockLimit} sold={p.soldCount} label="{left} left" />
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function Ticker({ items }: { items: string[] }) {
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <div className="relative -rotate-1 overflow-hidden border-y border-white/10 bg-brand py-4">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {[...row, ...row].map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-xl font-black uppercase tracking-wider text-white md:text-2xl">
            {t} <Sparkles className="h-5 w-5 text-white/70" />
          </span>
        ))}
      </div>
    </div>
  );
}

function Scarcity({ c, p }: { c: Cfg; p?: PublicProduct }) {
  if (!p || p.stockLimit == null) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 pt-16">
      <Reveal className="card border-urgency/30 p-6 shadow-[0_0_80px_-30px_var(--c-urgency)] md:p-8">
        <StockBar limit={p.stockLimit} sold={p.soldCount} label={str(c.headline)} />
        <p className="mt-4 text-center text-sm text-muted">
          Once these are gone, the price goes back to <b className="text-white">{formatINR(p.salePrice ?? p.compareAtPrice ?? p.price)}</b>.
        </p>
      </Reveal>
    </section>
  );
}

function Products({ c, products }: { c: Cfg; products: PublicProduct[] }) {
  if (!products.length) return null;
  return (
    <section id="products" className="section scroll-mt-20">
      <Reveal className="mb-12 text-center">
        <h2 className="h2">{str(c.heading)}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted">{str(c.subheading)}</p>
      </Reveal>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
    </section>
  );
}

function Videos({ c, videos }: { c: Cfg; videos: SectionData["videos"] }) {
  const [active, setActive] = useState(0);
  if (!videos.length) return null;
  const main = videos[active];
  return (
    <section id="videos" className="section scroll-mt-20">
      <Reveal className="mb-10 text-center">
        <span className="text-sm font-black uppercase tracking-widest text-accent">▶ Video</span>
        <h2 className="h2 mt-2">{str(c.heading)}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted">{str(c.subheading)}</p>
      </Reveal>
      <Reveal>
        <div className="relative">
          <div className="absolute -inset-6 rounded-[calc(var(--radius)+24px)] bg-gradient-to-r from-primary/30 via-accent/20 to-primary2/30 blur-3xl" />
          <VideoPlayer key={main.id} url={main.url} title={main.title} big className="relative border border-white/10 shadow-2xl" />
        </div>
        {main.caption && <p className="mt-4 text-center text-muted">{main.caption}</p>}
      </Reveal>
      {videos.length > 1 && (
        <div className="mt-8 flex snap-x gap-4 overflow-x-auto pb-4">
          {videos.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setActive(i)}
              className={cn(
                "card w-64 shrink-0 snap-start overflow-hidden text-left transition",
                i === active ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
              )}
            >
              <VideoThumb url={v.url} />
              <p className="p-3 text-sm font-bold text-white">{v.title}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function VideoThumb({ url }: { url: string }) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  const src = m ? `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg` : vm ? `https://vumbnail.com/${vm[1]}.jpg` : "";
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="aspect-video w-full object-cover" loading="lazy" /> : <div className="aspect-video bg-black" />;
}

function ValueStack({ c, p }: { c: Cfg; p?: PublicProduct }) {
  if (!p || !p.bonusItems.length) return null;
  const total = p.bonusItems.reduce((s, b) => s + (Number(b.value) || 0), 0);
  const price = currentPrice(p);
  return (
    <section className="section">
      <Reveal className="mx-auto max-w-3xl">
        <h2 className="h2 mb-10 text-center">{str(c.heading)}</h2>
        <div className="card overflow-hidden">
          {p.bonusItems.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-5"
            >
              <span className="flex items-center gap-3 font-semibold text-white">
                <Gift className="h-5 w-5 shrink-0 text-accent" /> {b.title}
              </span>
              <span className="shrink-0 font-mono text-sm text-muted">{formatINR(Number(b.value) || 0)} value</span>
            </motion.div>
          ))}
          <div className="bg-white/5 px-6 py-6 text-center">
            <p className="text-lg text-muted">
              Total value: <span className="relative font-bold text-white">{formatINR(total)}<span className="absolute left-0 right-0 top-1/2 h-0.5 -rotate-3 bg-urgency" /></span>
            </p>
            <p className="mt-2 font-display text-4xl font-black text-white md:text-5xl">
              Today: <span className="text-gradient">{formatINR(price)}</span>
            </p>
            {total > price && <p className="mt-2 font-bold text-success">You save {formatINR(total - price)}</p>}
            <Link href={buyHref(p)} className="btn-cta mt-6">
              {str(c.ctaText) || "Claim the bundle"} <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Testimonials({ c, items }: { c: Cfg; items: SectionData["testimonials"] }) {
  if (!items.length) return null;
  const row = items.length < 4 ? [...items, ...items, ...items] : items;
  return (
    <section className="py-16 md:py-24">
      <Reveal className="mb-12 px-4 text-center">
        <h2 className="h2">{str(c.heading)}</h2>
      </Reveal>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee-slow gap-6 hover:[animation-play-state:paused]">
          {[...row, ...row].map((t, i) => (
            <figure key={i} className="card w-80 shrink-0 p-6">
              <div className="mb-3 flex gap-0.5 text-yellow-400">
                {Array.from({ length: Math.min(5, t.rating) }).map((_, j) => (
                  <Star key={j} className="h-4 w-4" fill="currentColor" />
                ))}
              </div>
              <blockquote className="text-fg/90">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                {t.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand font-bold text-white">{t.name[0]}</span>
                )}
                <span>
                  <b className="block text-white">{t.name}</b>
                  {t.role && <span className="text-xs text-muted">{t.role}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Guarantee({ c }: { c: Cfg }) {
  return (
    <section className="section">
      <Reveal className="card mx-auto flex max-w-3xl flex-col items-center gap-6 p-8 text-center md:flex-row md:text-left">
        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
          <div className="absolute inset-0 animate-[spin_12s_linear_infinite] rounded-full border-4 border-dashed border-success/50" />
          <ShieldCheck className="h-14 w-14 text-success" />
          {Number(c.days) > 0 && (
            <span className="absolute -bottom-2 rounded-full bg-success px-3 py-0.5 text-xs font-black text-black">{Number(c.days)} DAYS</span>
          )}
        </div>
        <div>
          <h3 className="font-display text-2xl font-black text-white md:text-3xl">{str(c.heading)}</h3>
          <p className="mt-2 text-muted">{str(c.text)}</p>
        </div>
      </Reveal>
    </section>
  );
}

function Faq({ c, items }: { c: Cfg; items: SectionData["faqs"] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  if (!items.length) return null;
  return (
    <section className="section max-w-3xl">
      <Reveal>
        <h2 className="h2 mb-10 text-center">{str(c.heading)}</h2>
      </Reveal>
      <div className="space-y-3">
        {items.map((f) => (
          <div key={f.id} className="card overflow-hidden">
            <button onClick={() => setOpen(open === f.id ? null : f.id)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-bold text-white">
              {f.question}
              <ChevronDown className={cn("h-5 w-5 shrink-0 transition", open === f.id && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {open === f.id && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  <p className="whitespace-pre-line px-6 pb-5 text-muted">{f.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ c, p }: { c: Cfg; p?: PublicProduct }) {
  return (
    <section className="section">
      <Reveal className="relative overflow-hidden rounded-[calc(var(--radius)*2)] bg-brand p-10 text-center md:p-16">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
        <div className="relative">
          <h2 className="font-display text-4xl font-black text-white md:text-6xl">{str(c.headline)}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">{str(c.subheadline)}</p>
          {c.showCountdown !== false && p?.saleEndsAt && <Countdown to={p.saleEndsAt} className="mt-8 justify-center" />}
          <Link href={buyHref(p)} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-10 py-5 text-lg font-black uppercase text-black shadow-2xl transition hover:scale-105">
            {str(c.ctaText) || "Get it now"} <ArrowRight className="h-5 w-5" />
          </Link>
          {p && <p className="mt-4 text-sm text-white/70">One-time payment of {formatINR(currentPrice(p))} · Instant access</p>}
        </div>
      </Reveal>
    </section>
  );
}
