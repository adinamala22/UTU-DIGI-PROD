"use client";
import { useRef, useState, useTransition } from "react";
import { Save, Upload } from "lucide-react";
import { Field, Panel, toast } from "@/components/admin/ui";
import { FONT_OPTIONS } from "@/lib/fonts";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/settings-defaults";
import { saveSettingsAction, uploadImageAction } from "../../actions";

type Theme = SiteSettings["theme"];

const PRESETS: { name: string; theme: Partial<Theme> }[] = [
  { name: "URL Tune Up", theme: DEFAULT_SETTINGS.theme },
  { name: "Inferno", theme: { bg: "#0b0505", bg2: "#2a0a0a", surface: "#160c0c", primary: "#ff3d00", primary2: "#ff9100", accent: "#ffd600", urgency: "#ff1744" } },
  { name: "Toxic", theme: { bg: "#050a07", bg2: "#0b2a1a", surface: "#0c1610", primary: "#00e676", primary2: "#1de9b6", accent: "#c6ff00", urgency: "#ff1744" } },
  { name: "Cyber pink", theme: { bg: "#0a0410", bg2: "#22083a", surface: "#140a1f", primary: "#ff00e5", primary2: "#7c4dff", accent: "#00e5ff", urgency: "#ff1744" } },
  { name: "Gold rush", theme: { bg: "#0a0906", bg2: "#2b2208", surface: "#16130b", primary: "#ffb300", primary2: "#ff6f00", accent: "#fff176", urgency: "#ff3d00" } },
];

const COLORS: { key: keyof Theme; label: string }[] = [
  { key: "bg", label: "Background" },
  { key: "bg2", label: "Background 2" },
  { key: "surface", label: "Cards" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted text" },
  { key: "primary", label: "Primary" },
  { key: "primary2", label: "Primary 2 (gradient)" },
  { key: "accent", label: "Accent" },
  { key: "urgency", label: "Urgency / timers" },
  { key: "success", label: "Success" },
];

export function ThemeEditor({ theme: initial, store: initialStore }: { theme: Theme; store: SiteSettings["store"] }) {
  const [theme, setTheme] = useState(initial);
  const [store, setStore] = useState(initialStore);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<"logoUrl" | "faviconUrl">("logoUrl");

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction({ theme, store });
      toast(r.ok ? "Theme saved" : r.error, !r.ok);
    });

  const upload = (file: File) =>
    start(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const r = await uploadImageAction(fd);
      if (r.ok) setStore((s) => ({ ...s, [uploadTarget]: r.url! }));
      else toast(r.error, true);
    });

  const previewVars = Object.fromEntries(COLORS.map((c) => [`--c-${c.key === "text" ? "text" : c.key}`, theme[c.key]])) as React.CSSProperties;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <Panel title="Presets">
          <div className="flex flex-wrap gap-3">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => setTheme({ ...theme, ...p.theme })} className="rounded-lg border border-white/10 p-2 text-left hover:border-white/40">
                <div className="mb-2 flex h-8 w-28 overflow-hidden rounded">
                  {[p.theme.bg, p.theme.primary, p.theme.primary2, p.theme.accent, p.theme.urgency].map((c, i) => (
                    <span key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-xs font-semibold text-white">{p.name}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Colours">
          <div className="grid gap-4 sm:grid-cols-2">
            {COLORS.map((c) => (
              <Field key={c.key} label={c.label}>
                <div className="flex gap-2">
                  <input type="color" value={String(theme[c.key]).slice(0, 7)} onChange={(e) => setTheme({ ...theme, [c.key]: e.target.value })} className="h-10 w-12 cursor-pointer rounded border border-white/10 bg-transparent" />
                  <input className="input font-mono" value={String(theme[c.key])} onChange={(e) => setTheme({ ...theme, [c.key]: e.target.value })} />
                </div>
              </Field>
            ))}
          </div>
        </Panel>
        <Panel title="Typography & shape">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Font">
              <select className="input" value={theme.font} onChange={(e) => setTheme({ ...theme, font: e.target.value })}>
                {Object.keys(FONT_OPTIONS).map((f) => <option key={f}>{f}</option>)}
              </select>
            </Field>
            <Field label={`Corner radius: ${theme.radius}px`}>
              <input type="range" min={0} max={32} value={theme.radius} onChange={(e) => setTheme({ ...theme, radius: Number(e.target.value) })} className="w-full" />
            </Field>
          </div>
        </Panel>
        <Panel title="Branding">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["logoUrl", "faviconUrl"] as const).map((k) => (
              <Field key={k} label={k === "logoUrl" ? "Logo" : "Favicon"}>
                <div className="flex gap-2">
                  <input className="input" value={store[k]} onChange={(e) => setStore({ ...store, [k]: e.target.value })} placeholder="https://… or upload" />
                  <button type="button" className="btn-secondary !px-2" onClick={() => { setUploadTarget(k); fileRef.current?.click(); }}><Upload className="h-4 w-4" /></button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {store[k] && <img src={store[k]} alt="" className="mt-2 h-10 rounded bg-white/5 p-1" />}
              </Field>
            ))}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
        </Panel>
        <button onClick={save} disabled={pending} className="btn-primary"><Save className="h-4 w-4" /> {pending ? "Saving…" : "Save theme"}</button>
      </div>

      {/* Live mini-preview */}
      <div className="xl:sticky xl:top-8 xl:self-start">
        <p className="label">Preview</p>
        <div style={{ ...previewVars, "--radius": `${theme.radius}px`, background: theme.bg } as React.CSSProperties} className="overflow-hidden rounded-xl border border-white/10 p-6">
          <div className="bg-urgency-grad -mx-6 -mt-6 mb-6 px-4 py-2 text-center text-xs font-bold uppercase text-white">⚡ Launch price ends in 02:14:33</div>
          <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase" style={{ borderColor: theme.urgency, color: theme.text }}>🔥 Limited seats</span>
          <h3 className="mt-4 text-3xl font-black leading-none" style={{ color: "#fff" }}>
            Ship automations <span className="text-gradient">10x faster</span>
          </h3>
          <p className="mt-3 text-sm" style={{ color: theme.muted }}>The exact templates our agency uses.</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-3xl font-black text-white">₹999</span>
            <span className="line-through" style={{ color: theme.muted }}>₹4,999</span>
            <span className="rounded-full px-2 py-0.5 text-xs font-black text-white" style={{ background: theme.urgency }}>SAVE 80%</span>
          </div>
          <button className="btn-cta mt-5 w-full !text-base">Get instant access</button>
          <div className="card mt-5 p-4 text-sm" style={{ color: theme.text }}>A card using the surface colour.</div>
        </div>
      </div>
    </div>
  );
}
