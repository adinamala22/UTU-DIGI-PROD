"use client";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Flame, Zap } from "lucide-react";
import type { PublicProduct } from "@/lib/catalog";
import { parseVideo } from "@/lib/video";
import { PriceTag } from "./PriceTag";
import { Countdown } from "./Countdown";

export function ProductCard({ product, index = 0 }: { product: PublicProduct; index?: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [10, -10]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), { stiffness: 200, damping: 20 });
  const img = product.images[0] ?? parseVideo(product.videoUrl)?.thumbnail;
  const left = product.stockLimit != null ? Math.max(0, product.stockLimit - product.soldCount) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 120 }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className="group relative"
    >
      <div className="absolute -inset-0.5 rounded-[calc(var(--radius)+2px)] bg-brand opacity-30 blur transition duration-500 group-hover:opacity-80" />
      <Link href={`/products/${product.slug}`} className="card relative flex h-full flex-col overflow-hidden">
        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary/40 to-primary2/30">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={product.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center font-display text-2xl font-black text-white/90">{product.title}</div>
          )}
          {product.badge && (
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-urgency px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-lg">
              <Flame className="h-3.5 w-3.5" /> {product.badge}
            </span>
          )}
          {product.saleEndsAt && new Date(product.saleEndsAt).getTime() > Date.now() && (
            <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur">
              <Zap className="h-3.5 w-3.5 text-accent" /> Ends in <Countdown to={product.saleEndsAt} variant="inline" />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <h3 className="font-display text-xl font-extrabold leading-tight text-white">{product.title}</h3>
          {product.subtitle && <p className="line-clamp-2 text-sm text-muted">{product.subtitle}</p>}
          <div className="mt-auto space-y-3 pt-2">
            <PriceTag product={product} size="sm" />
            {left != null && (
              <p className="text-xs font-bold uppercase tracking-wider text-urgency">{left === 0 ? "Sold out" : `⚠ Only ${left} left`}</p>
            )}
            <span className="flex items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-extrabold uppercase tracking-wide text-white transition-all group-hover:gap-4">
              Get it now <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
