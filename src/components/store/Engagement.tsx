"use client";
import Link from "next/link";
// Live purchase toasts (real orders only), exit-intent offer, scroll reveal.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, X, Gift, Copy, Check } from "lucide-react";

type Purchase = { name: string; city: string | null; product: string; at: string };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function LiveToasts({ purchases }: { purchases: Purchase[] }) {
  const [tick, setTick] = useState(-1);
  useEffect(() => {
    if (!purchases.length) return;
    const first = setTimeout(() => setTick(0), 6000);
    const t = setInterval(() => setTick((x) => x + 1), 7000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [purchases.length]);
  // even ticks show a toast, odd ticks are a pause
  const p = tick >= 0 && tick % 2 === 0 ? purchases[(tick / 2) % purchases.length] : null;
  return (
    <div className="pointer-events-none fixed bottom-24 left-4 z-40 md:bottom-6" aria-live="polite">
      <AnimatePresence>
        {p && (
          <motion.div
            key={tick}
            initial={{ opacity: 0, x: -60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -60 }}
            className="card flex max-w-xs items-center gap-3 p-3 shadow-2xl"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="text-sm leading-snug">
              <b className="text-white">{p.name}</b>
              {p.city && <span className="text-muted"> from {p.city}</span>}
              <span className="text-muted"> bought </span>
              <b className="text-white">{p.product}</b>
              <div className="text-xs text-success">✓ Verified purchase · {ago(p.at)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ExitIntent({ headline, text, couponCode }: { headline: string; text: string; couponCode: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("utu_exit_shown")) return;
    const trigger = () => {
      if (sessionStorage.getItem("utu_exit_shown")) return;
      sessionStorage.setItem("utu_exit_shown", "1");
      setOpen(true);
    };
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger();
    };
    // Touch devices have no mouse-leave: show after 45s of browsing instead
    const mobileTimer = window.matchMedia("(pointer: coarse)").matches ? setTimeout(trigger, 45000) : undefined;
    const arm = setTimeout(() => document.addEventListener("mouseleave", onLeave), 5000);
    return () => {
      clearTimeout(arm);
      if (mobileTimer) clearTimeout(mobileTimer);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.7, rotate: -3 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="card relative w-full max-w-md overflow-hidden p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/40 blur-3xl" />
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 text-muted hover:text-white" aria-label="Close">
              <X />
            </button>
            <Gift className="mx-auto mb-4 h-14 w-14 animate-float text-accent" />
            <h3 className="font-display text-3xl font-black text-white">{headline}</h3>
            <p className="mt-2 text-muted">{text}</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(couponCode);
                sessionStorage.setItem("utu_coupon", couponCode);
                setCopied(true);
              }}
              className="mx-auto mt-6 flex items-center gap-3 rounded-xl border-2 border-dashed border-accent bg-accent/10 px-6 py-3 font-mono text-2xl font-black tracking-widest text-white"
            >
              {couponCode} {copied ? <Check className="h-5 w-5 text-success" /> : <Copy className="h-5 w-5" />}
            </button>
            <Link
              href="/#products"
              onClick={() => {
                sessionStorage.setItem("utu_coupon", couponCode);
                setOpen(false);
              }}
              className="btn-cta mt-6 w-full"
            >
              Use my discount
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
