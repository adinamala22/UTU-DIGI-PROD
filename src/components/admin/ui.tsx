"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-white/5 bg-surface p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-bold uppercase tracking-wide text-white">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, help, children, className }: { label: string; help?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-white/40">{help}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 text-sm text-white">
      <span className={cn("relative h-6 w-11 rounded-full transition", checked ? "bg-primary" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    FULFILLED: "bg-green-500/15 text-green-300",
    PAID: "bg-blue-500/15 text-blue-300",
    PENDING: "bg-white/10 text-white/70",
    REVIEW: "bg-yellow-500/15 text-yellow-300",
    FAILED: "bg-red-500/15 text-red-300",
    EXPIRED: "bg-white/5 text-white/40",
    CANCELLED: "bg-white/5 text-white/40",
    REVOKED: "bg-red-500/15 text-red-300",
    LIVE: "bg-green-500/15 text-green-300",
    DRAFT: "bg-white/10 text-white/70",
    ARCHIVED: "bg-white/5 text-white/40",
    RECONCILED: "bg-green-500/15 text-green-300",
    NOT_RECONCILED: "bg-yellow-500/15 text-yellow-300",
  };
  return <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-bold", map[status] ?? "bg-white/10")}>{status.replace("_", " ")}</span>;
}

/** Tiny global toast */
let push: ((m: { text: string; error?: boolean }) => void) | null = null;
export function toast(text: string, error = false) {
  push?.({ text, error });
}
export function Toaster() {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    push = (m) => {
      setMsg(m);
      setTimeout(() => setMsg(null), 3500);
    };
    return () => {
      push = null;
    };
  }, []);
  if (!msg) return null;
  return (
    <div className={cn("fixed bottom-6 right-6 z-[100] rounded-lg px-4 py-3 text-sm font-semibold shadow-2xl", msg.error ? "bg-red-600 text-white" : "bg-green-600 text-white")}>
      {msg.text}
    </div>
  );
}
