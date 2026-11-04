"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n: number) => String(n).padStart(2, "0");

/** Counts down to a real deadline. Renders nothing once expired or if no deadline. */
export function Countdown({
  to,
  variant = "blocks",
  className,
  onExpire,
}: {
  to?: string | null;
  variant?: "blocks" | "inline";
  className?: string;
  onExpire?: () => void;
}) {
  const target = to ? new Date(to).getTime() : NaN;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = now == null ? 0 : target - now;
  useEffect(() => {
    if (now != null && left <= 0 && onExpire) onExpire();
  }, [now, left, onExpire]);

  if (!to || Number.isNaN(target) || (now != null && left <= 0)) return null;
  const p = parts(now == null ? 0 : left);
  const fmt = (n: number) => (now == null ? "--" : pad(n));

  if (variant === "inline") {
    return (
      <span className={cn("font-mono font-bold tabular-nums", className)} suppressHydrationWarning>
        {p.d > 0 && `${p.d}d `}
        {fmt(p.h)}:{fmt(p.m)}:{fmt(p.s)}
      </span>
    );
  }
  const cells = [
    ...(p.d > 0 ? [{ v: p.d, l: "Days" }] : []),
    { v: p.h, l: "Hours" },
    { v: p.m, l: "Mins" },
    { v: p.s, l: "Secs" },
  ];
  return (
    <div className={cn("flex items-center gap-2", className)} suppressHydrationWarning>
      {cells.map((c, i) => (
        <div key={c.l} className="flex items-center gap-2">
          <div className="flex min-w-16 flex-col items-center rounded-xl border border-urgency/40 bg-urgency/10 px-3 py-2 shadow-[0_0_30px_-10px_var(--c-urgency)]">
            <span className="font-mono text-3xl font-black tabular-nums text-white md:text-4xl">{fmt(c.v)}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-urgency">{c.l}</span>
          </div>
          {i < cells.length - 1 && <span className="animate-blink text-2xl font-black text-urgency">:</span>}
        </div>
      ))}
    </div>
  );
}
