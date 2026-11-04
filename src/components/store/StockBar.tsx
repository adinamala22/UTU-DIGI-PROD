import { cn } from "@/lib/utils";

/** Real stock meter. Renders nothing unless the admin set a stock limit. */
export function StockBar({ limit, sold, label, className }: { limit: number | null; sold: number; label?: string; className?: string }) {
  if (limit == null || limit <= 0) return null;
  const left = Math.max(0, limit - sold);
  const pct = Math.min(100, Math.round((sold / limit) * 100));
  const text = (label || "Only {left} of {total} left").replace("{left}", String(left)).replace("{total}", String(limit));
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold">
        <span className="flex items-center gap-2 text-white">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-urgency opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-urgency" />
          </span>
          {left === 0 ? "SOLD OUT" : text}
        </span>
        <span className="shrink-0 text-urgency">{pct}% claimed</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-urgency" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
