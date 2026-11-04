"use client";
// Store chrome: announcement bar, header, footer, sticky CTA.
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Countdown } from "./Countdown";
import { formatINR } from "@/lib/money";

export function AnnouncementBar({ text, endsAt, ctaText, ctaHref }: { text: string; endsAt?: string; ctaText?: string; ctaHref?: string }) {
  const [hidden, setHidden] = useState(false);
  const [now] = useState(() => Date.now());
  const deadline = endsAt && new Date(endsAt).getTime() > now ? endsAt : null;
  if (hidden || !text) return null;
  return (
    <div className="relative z-50 bg-urgency-grad px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-white md:text-sm">
      <span className="mr-2">⚡ {text}</span>
      {deadline && (
        <span className="mx-1 rounded bg-black/30 px-2 py-0.5">
          <Countdown to={deadline} variant="inline" onExpire={() => setHidden(true)} />
        </span>
      )}
      {ctaText && ctaHref && (
        <a href={ctaHref} className="ml-2 underline decoration-2 underline-offset-4 hover:no-underline">
          {ctaText} →
        </a>
      )}
    </div>
  );
}

export function Header({ name, logoUrl, mainSiteUrl }: { name: string; logoUrl?: string; mainSiteUrl?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-black text-white">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={name} className="h-8 w-auto" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm">U</span>
          )}
          <span>{name}</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/#products" className="hidden px-3 py-2 text-muted hover:text-white sm:block">Products</Link>
          <Link href="/#videos" className="hidden px-3 py-2 text-muted hover:text-white sm:block">Watch demo</Link>
          {mainSiteUrl && <a href={mainSiteUrl} className="hidden px-3 py-2 text-muted hover:text-white md:block">Agency</a>}
          <Link href="/#products" className="ml-2 rounded-full bg-brand px-4 py-2 font-bold text-white">Shop now</Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer({ name, supportEmail, supportWhatsapp, mainSiteUrl }: { name: string; supportEmail?: string; supportWhatsapp?: string; mainSiteUrl?: string }) {
  return (
    <footer className="border-t border-white/5 py-10 pb-28 text-sm text-muted md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row">
        <p>
          © {new Date().getFullYear()} {name}. A product of{" "}
          <a className="text-white hover:underline" href={mainSiteUrl}>URL Tune Up</a>.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {supportWhatsapp && <a href={`https://wa.me/${supportWhatsapp}`} className="hover:text-white">WhatsApp support</a>}
          {supportEmail && <a href={`mailto:${supportEmail}`} className="hover:text-white">{supportEmail}</a>}
          <Link href="/terms" className="hover:text-white">Terms &amp; Refunds</Link>
        </div>
      </div>
    </footer>
  );
}

export function StickyCta({ href, label, price, compareAt }: { href: string; label: string; price?: number; compareAt?: number | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-bg/90 p-3 backdrop-blur-xl md:hidden"
        >
          <div className="flex items-center gap-3">
            {price != null && (
              <div className="leading-tight">
                <div className="font-display text-xl font-black text-white">{formatINR(price)}</div>
                {compareAt && compareAt > price && <div className="text-xs text-muted line-through">{formatINR(compareAt)}</div>}
              </div>
            )}
            <Link href={href} className="btn-cta flex-1 !px-4 !py-3 !text-base">{label}</Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
