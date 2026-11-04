"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, Save, XCircle } from "lucide-react";
import { Field, Panel, Toggle, toast } from "@/components/admin/ui";
import type { SiteSettings } from "@/lib/settings-defaults";
import { saveSettingsAction } from "../../actions";

type S = Omit<SiteSettings, "theme">;
type Env = { youpi: boolean; youpiUrl: string; youpiSecret: boolean; razorpay: boolean; razorpayWebhook: boolean; resend: boolean; s3: boolean; webhookYoupi: string; webhookRazorpay: string };

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
      <span className={ok ? "text-white" : "text-muted"}>{label}</span>
    </li>
  );
}

function isoToLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function SettingsForm({ initial, env }: { initial: S; env: Env }) {
  const [s, setS] = useState<S>(initial);
  const [pending, start] = useTransition();
  const up = <K extends keyof S>(k: K, patch: Partial<S[K]>) => setS({ ...s, [k]: { ...s[k], ...patch } });
  const txt = <K extends keyof S>(k: K, f: keyof S[K]) => ({
    value: String(s[k][f] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => up(k, { [f]: e.target.value } as Partial<S[K]>),
  });

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction({
        ...s,
        delivery: { downloadExpiryDays: Number(s.delivery.downloadExpiryDays) || 7, maxDownloads: Number(s.delivery.maxDownloads) || 5 },
      });
      toast(r.ok ? "Settings saved" : r.error, !r.ok);
    });

  return (
    <div className="space-y-6">
      <Panel title="Payments">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Field label="Active gateways" help="'Both' lets buyers choose. Unconfigured gateways are hidden automatically.">
              <select className="input" {...txt("payments", "mode")}>
                <option value="both">Both (buyer chooses)</option>
                <option value="youpi">YouPI only (UPI)</option>
                <option value="razorpay">Razorpay only</option>
              </select>
            </Field>
            <Field label="Default / first option">
              <select className="input" {...txt("payments", "defaultGateway")}>
                <option value="youpi">YouPI (UPI)</option>
                <option value="razorpay">Razorpay</option>
              </select>
            </Field>
          </div>
          <div className="space-y-3 rounded-lg bg-black/30 p-4">
            <p className="text-xs font-bold uppercase text-muted">Server configuration (.env)</p>
            <ul className="space-y-1">
              <Check ok={env.youpi} label={`YouPI API URL ${env.youpiUrl ? `(${env.youpiUrl})` : ""}`} />
              <Check ok={env.youpiSecret} label="YouPI webhook secret" />
              <Check ok={env.razorpay} label="Razorpay keys" />
              <Check ok={env.razorpayWebhook} label="Razorpay webhook secret" />
              <Check ok={env.resend} label="Resend email (else logged to console)" />
              <Check ok={env.s3} label="R2/S3 storage (else local disk)" />
            </ul>
            <p className="pt-2 text-xs text-muted">Webhook URLs to configure in each gateway:</p>
            <code className="block break-all rounded bg-black/40 p-2 text-xs text-green-300">{env.webhookYoupi}</code>
            <code className="block break-all rounded bg-black/40 p-2 text-xs text-green-300">{env.webhookRazorpay}</code>
          </div>
        </div>
      </Panel>

      <Panel title="Store">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Store name"><input className="input" {...txt("store", "name")} /></Field>
          <Field label="Tagline"><input className="input" {...txt("store", "tagline")} /></Field>
          <Field label="Support WhatsApp (with country code)" help="e.g. 916300983189"><input className="input" {...txt("store", "supportWhatsapp")} /></Field>
          <Field label="Support email"><input className="input" {...txt("store", "supportEmail")} /></Field>
          <Field label="Main agency site URL"><input className="input" {...txt("store", "mainSiteUrl")} /></Field>
        </div>
      </Panel>

      <Panel title="Announcement bar">
        <div className="space-y-4">
          <Toggle checked={s.announcement.enabled} onChange={(v) => up("announcement", { enabled: v })} label="Show announcement bar" />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Text" className="md:col-span-2"><input className="input" {...txt("announcement", "text")} /></Field>
            <Field label="Countdown to (optional)" help="Bar hides itself when the deadline passes">
              <input
                type="datetime-local"
                className="input"
                value={isoToLocal(s.announcement.endsAt)}
                onChange={(e) => up("announcement", { endsAt: e.target.value ? new Date(e.target.value).toISOString() : "" })}
              />
            </Field>
            <Field label="CTA text"><input className="input" {...txt("announcement", "ctaText")} /></Field>
            <Field label="CTA link"><input className="input" {...txt("announcement", "ctaHref")} /></Field>
          </div>
        </div>
      </Panel>

      <Panel title="Conversion boosters">
        <div className="space-y-4">
          <Toggle checked={s.conversion.stickyCta} onChange={(v) => up("conversion", { stickyCta: v })} label="Sticky buy bar on mobile" />
          <Toggle checked={s.conversion.liveToasts} onChange={(v) => up("conversion", { liveToasts: v })} label="Live purchase pop-ups (real orders from the last 14 days only)" />
          <div className="rounded-lg border border-white/5 p-4">
            <Toggle checked={s.conversion.exitIntent.enabled} onChange={(v) => up("conversion", { exitIntent: { ...s.conversion.exitIntent, enabled: v } })} label="Exit-intent discount pop-up" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Headline"><input className="input" value={s.conversion.exitIntent.headline} onChange={(e) => up("conversion", { exitIntent: { ...s.conversion.exitIntent, headline: e.target.value } })} /></Field>
              <Field label="Coupon code" help="Create it under Coupons first"><input className="input uppercase" value={s.conversion.exitIntent.couponCode} onChange={(e) => up("conversion", { exitIntent: { ...s.conversion.exitIntent, couponCode: e.target.value.toUpperCase() } })} /></Field>
              <Field label="Text" className="md:col-span-2"><input className="input" value={s.conversion.exitIntent.text} onChange={(e) => up("conversion", { exitIntent: { ...s.conversion.exitIntent, text: e.target.value } })} /></Field>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Delivery">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Download link valid for (days)"><input type="number" min={1} className="input" {...txt("delivery", "downloadExpiryDays")} /></Field>
          <Field label="Max downloads per purchase"><input type="number" min={1} className="input" {...txt("delivery", "maxDownloads")} /></Field>
        </div>
      </Panel>

      <Panel title="SEO & tracking">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Page title" className="md:col-span-2"><input className="input" {...txt("seo", "title")} /></Field>
          <Field label="Meta description" className="md:col-span-2"><textarea className="input" {...txt("seo", "description")} /></Field>
          <Field label="Social share image URL" className="md:col-span-2"><input className="input" {...txt("seo", "ogImage")} /></Field>
          <Field label="GA4 measurement ID" help="G-XXXXXXX"><input className="input" {...txt("pixels", "ga4")} /></Field>
          <Field label="Meta pixel ID"><input className="input" {...txt("pixels", "metaPixel")} /></Field>
        </div>
      </Panel>

      <button onClick={save} disabled={pending} className="btn-primary"><Save className="h-4 w-4" /> {pending ? "Saving…" : "Save settings"}</button>
    </div>
  );
}
