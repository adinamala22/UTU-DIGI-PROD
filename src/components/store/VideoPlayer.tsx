"use client";
import { useState } from "react";
import { Play } from "lucide-react";
import { parseVideo } from "@/lib/video";
import { cn } from "@/lib/utils";

/** Lite embed: shows a thumbnail, loads the iframe only on click (fast LCP). */
export function VideoPlayer({ url, title, className, big }: { url: string; title?: string; className?: string; big?: boolean }) {
  const v = parseVideo(url);
  const [playing, setPlaying] = useState(false);
  if (!v) return null;
  return (
    <div className={cn("group relative aspect-video w-full overflow-hidden rounded-[var(--radius)] bg-black", className)}>
      {playing ? (
        <iframe
          src={v.embedUrl}
          title={title ?? "Video"}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="absolute inset-0 h-full w-full" aria-label={`Play ${title ?? "video"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v.thumbnail} alt="" className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <span
            className={cn(
              "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white animate-pulse-glow transition group-hover:scale-110",
              big ? "h-24 w-24" : "h-16 w-16",
            )}
          >
            <Play className={big ? "h-10 w-10 translate-x-0.5" : "h-7 w-7 translate-x-0.5"} fill="currentColor" />
          </span>
          {title && <span className="absolute bottom-3 left-4 right-4 text-left text-sm font-bold text-white md:text-base">{title}</span>}
        </button>
      )}
    </div>
  );
}
