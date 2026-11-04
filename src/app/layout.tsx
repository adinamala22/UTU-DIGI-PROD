import type { Metadata } from "next";
import { Inter, Space_Grotesk, Sora, Outfit, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { getSettings, type SiteSettings } from "@/lib/settings";
import { FONT_OPTIONS } from "@/lib/fonts";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", weight: ["500", "700"] });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["400", "600", "800"] });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["400", "600", "900"] });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["400", "700", "800"] });


export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: s.seo.title,
    description: s.seo.description,
    metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
    openGraph: { title: s.seo.title, description: s.seo.description, images: s.seo.ogImage ? [s.seo.ogImage] : [] },
    icons: s.store.faviconUrl ? [{ url: s.store.faviconUrl }] : undefined,
  };
}

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;
const color = (v: string, fallback: string) => (COLOR_RE.test(v?.trim() ?? "") ? v.trim() : fallback);

function themeCss(t: SiteSettings["theme"]) {
  const font = FONT_OPTIONS[t.font as keyof typeof FONT_OPTIONS] ?? "--font-inter";
  const radius = Math.min(40, Math.max(0, Number(t.radius) || 16));
  return `:root{--c-bg:${color(t.bg, "#0a0a0b")};--c-bg2:${color(t.bg2, "#16213e")};--c-surface:${color(t.surface, "#12121a")};--c-text:${color(t.text, "#e5e7eb")};--c-muted:${color(t.muted, "#9ca3af")};--c-primary:${color(t.primary, "#7e5bff")};--c-primary2:${color(t.primary2, "#4f7dff")};--c-accent:${color(t.accent, "#ff7acb")};--c-urgency:${color(t.urgency, "#ef4444")};--c-success:${color(t.success, "#4ade80")};--radius:${radius}px;--font-brand:var(${font});--font-display-face:var(${font === "--font-inter" ? "--font-space" : font});}`;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const s = await getSettings();
  return (
    <html lang="en" className={[inter.variable, space.variable, sora.variable, outfit.variable, bricolage.variable].join(" ")}>
      <head>
        <style id="utu-theme" dangerouslySetInnerHTML={{ __html: themeCss(s.theme) }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
