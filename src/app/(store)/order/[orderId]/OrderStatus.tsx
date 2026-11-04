"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Copy, Download, ExternalLink, KeyRound, Loader2, XCircle } from "lucide-react";
import { formatINR } from "@/lib/money";

type Deliverable = { id: string; title: string; type: "FILE" | "LINK" | "LICENSE"; downloadUrl?: string; externalUrl?: string; licenseKey?: string; downloadsLeft: number; expiresAt?: string | null };

const FAILED = ["FAILED", "EXPIRED", "CANCELLED", "REVOKED"];

export function OrderStatus(props: {
  orderId: string;
  accessKey: string;
  initialStatus: string;
  total: number;
  email: string;
  items: string[];
  supportWhatsapp?: string;
}) {
  const [status, setStatus] = useState(props.initialStatus);
  const [items, setItems] = useState<Deliverable[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const tracked = useRef(false);

  useEffect(() => {
    let stop = false;
    let n = 0;
    const poll = async () => {
      const res = await fetch(`/api/orders/${props.orderId}/status?k=${props.accessKey}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        setStatus(d.status);
        setItems(d.deliverables);
        if (d.status === "FULFILLED" || FAILED.includes(d.status)) return;
      }
      n++;
      setElapsed(n * 3);
      // Poll every 3s for 10 min, then every 15s
      if (!stop) setTimeout(poll, n < 200 ? 3000 : 15000);
    };
    poll();
    return () => {
      stop = true;
    };
  }, [props.orderId, props.accessKey]);

  useEffect(() => {
    if (status === "FULFILLED" && !tracked.current) {
      tracked.current = true;
      const w = window as unknown as { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void };
      w.fbq?.("track", "Purchase", { value: props.total / 100, currency: "INR" });
      w.gtag?.("event", "purchase", { transaction_id: props.orderId, value: props.total / 100, currency: "INR" });
    }
  }, [status, props.total, props.orderId]);

  const wa = props.supportWhatsapp
    ? `https://wa.me/${props.supportWhatsapp}?text=${encodeURIComponent(`Hi, I need help with order #${props.orderId.slice(-8).toUpperCase()}`)}`
    : null;

  if (status === "FULFILLED") {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <Confetti />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
          <CheckCircle2 className="mx-auto h-20 w-20 text-success" />
        </motion.div>
        <h1 className="mt-4 font-display text-4xl font-black text-white md:text-5xl">You&apos;re in! 🎉</h1>
        <p className="mt-2 text-muted">Payment received · {formatINR(props.total)} · a copy has been sent to <b className="text-white">{props.email}</b></p>
        <div className="mt-10 space-y-4 text-left">
          {items.map((d) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
              <h3 className="font-display text-xl font-black text-white">{d.title}</h3>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {d.downloadUrl && (
                  <a href={d.downloadUrl} className="btn-cta !px-6 !py-3 !text-base"><Download className="h-5 w-5" /> Download</a>
                )}
                {d.externalUrl && (
                  <a href={d.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-cta !px-6 !py-3 !text-base"><ExternalLink className="h-5 w-5" /> Access now</a>
                )}
                {d.licenseKey && <LicenseKey value={d.licenseKey} />}
                {d.type === "LICENSE" && !d.licenseKey && (
                  <p className="text-sm text-accent">Your license key is being generated and will be emailed shortly.</p>
                )}
              </div>
              {d.downloadUrl && (
                <p className="mt-3 text-xs text-muted">
                  {d.downloadsLeft} downloads left{d.expiresAt && ` · link valid until ${new Date(d.expiresAt).toLocaleDateString("en-IN")}`}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (FAILED.includes(status)) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <XCircle className="mx-auto h-16 w-16 text-urgency" />
        <h1 className="mt-4 font-display text-3xl font-black text-white">Payment {status.toLowerCase()}</h1>
        <p className="mt-2 text-muted">No money was taken for this order. If you were charged, contact us with your UTR / transaction ID.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/#products" className="btn-cta !text-base">Try again</Link>
          {wa && <a href={wa} className="btn-ghost">WhatsApp support</a>}
        </div>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      {status === "REVIEW" ? <Clock className="mx-auto h-16 w-16 text-accent" /> : <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" />}
      <h1 className="mt-4 font-display text-3xl font-black text-white">
        {status === "REVIEW" ? "Payment under review" : "Waiting for payment confirmation…"}
      </h1>
      <p className="mt-2 text-muted">
        {status === "REVIEW"
          ? "We've received your payment details and are verifying them. You'll get an email as soon as it's approved (usually within a few hours)."
          : "Completed the UPI payment? Keep this page open, and your product will appear here automatically. This usually takes under a minute."}
      </p>
      <ul className="mt-6 space-y-1 text-sm text-white">{props.items.map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="mt-2 font-display text-2xl font-black text-white">{formatINR(props.total)}</p>
      {elapsed > 120 && wa && (
        <a href={wa} className="btn-ghost mt-6">Taking too long? WhatsApp us</a>
      )}
    </div>
  );
}

function LicenseKey({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
      }}
      className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3 font-mono text-success"
    >
      <KeyRound className="h-4 w-4" /> {value} <Copy className="h-4 w-4" /> {copied && <span className="text-xs">copied</span>}
    </button>
  );
}

function Confetti() {
  const colors = ["var(--c-primary)", "var(--c-accent)", "var(--c-primary2)", "var(--c-success)", "#facc15"];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 60 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-3 w-2 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length] }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: 720, opacity: 0.8 }}
          transition={{ duration: 2.5 + (i % 5) * 0.4, delay: (i % 10) * 0.08, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
