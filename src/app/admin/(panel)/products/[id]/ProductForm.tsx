"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Plus, Trash2, Upload, X, Eye, Save, KeyRound } from "lucide-react";
import { Field, Panel, Toggle, toast } from "@/components/admin/ui";
import { formatINR, percentOff, toPaise } from "@/lib/money";
import { parseVideo } from "@/lib/video";
import { slugify } from "@/lib/utils";
import { importLicenseKeys, saveProduct } from "../../../actions";

export type ProductFormValue = {
  id?: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  price: string;
  compareAtPrice: string;
  salePrice: string;
  saleEndsAt: string; // ISO
  stockLimit: string;
  badge: string;
  videoUrl: string;
  status: "DRAFT" | "LIVE" | "ARCHIVED";
  deliveryType: "FILE" | "LINK" | "LICENSE";
  externalUrl: string;
  autoLicense: boolean;
  allowedGateways: ("youpi" | "razorpay")[];
  features: string[];
  bonusItems: { title: string; value: number }[];
  images: string[];
  orderBumpProductId: string;
  orderBumpPrice: string;
  guaranteeText: string;
  fileName: string | null;
};

function isoToLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function ProductForm({
  initial,
  otherProducts,
  keyStats,
}: {
  initial: ProductFormValue;
  otherProducts: { id: string; title: string }[];
  keyStats: { total: number; free: number } | null;
}) {
  const [v, setV] = useState<ProductFormValue>({ ...initial, saleEndsAt: isoToLocal(initial.saleEndsAt) });
  const [newImages, setNewImages] = useState<File[]>([]);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(false);
  const [pending, start] = useTransition();
  const [keysText, setKeysText] = useState("");
  const router = useRouter();
  const imgInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => setV((x) => ({ ...x, [k]: val }));
  const text = (k: keyof ProductFormValue) => ({
    value: v[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never),
  });

  const priceP = toPaise(v.price || 0);
  const compareP = v.compareAtPrice ? toPaise(v.compareAtPrice) : null;
  const off = percentOff(priceP, compareP);
  const bonusTotal = useMemo(() => v.bonusItems.reduce((s, b) => s + (b.value || 0), 0), [v.bonusItems]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set(
      "data",
      JSON.stringify({
        ...v,
        saleEndsAt: v.saleEndsAt ? new Date(v.saleEndsAt).toISOString() : "",
        features: v.features.filter((f) => f.trim()),
        bonusItems: v.bonusItems.filter((b) => b.title.trim()),
      }),
    );
    newImages.forEach((f) => fd.append("newImages", f));
    if (productFile) fd.set("productFile", productFile);
    start(async () => {
      const r = await saveProduct(fd);
      if (!r.ok) {
        toast(r.error, true);
        if (!r.error.startsWith("Saved")) return;
      } else toast("Product saved");
      setNewImages([]);
      setProductFile(null);
      if (!v.id && r.ok && r.id) router.replace(`/admin/products/${r.id}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Panel title="Basics">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" className="md:col-span-2">
              <input className="input" required {...text("title")} onBlur={() => !v.slug && set("slug", slugify(v.title))} />
            </Field>
            <Field label="URL slug" help={`/products/${v.slug || slugify(v.title)}`}>
              <input className="input" {...text("slug")} />
            </Field>
            <Field label="Badge" help='e.g. "BESTSELLER", "70% OFF", "NEW"'>
              <input className="input" {...text("badge")} />
            </Field>
            <Field label="Subtitle / hook" className="md:col-span-2">
              <input className="input" {...text("subtitle")} />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Description (Markdown)"
          actions={
            <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => setPreview(!preview)}>
              <Eye className="h-3.5 w-3.5" /> {preview ? "Edit" : "Preview"}
            </button>
          }
        >
          {preview ? (
            <div className="prose-store min-h-48 rounded-lg bg-black/30 p-4">
              <ReactMarkdown>{v.description}</ReactMarkdown>
            </div>
          ) : (
            <textarea className="input min-h-48 font-mono" {...text("description")} placeholder={"## Headline\n\n- Bullet point\n- **Bold** benefit"} />
          )}
        </Panel>

        <Panel title="Media">
          <div className="space-y-4">
            <Field label="Product video (YouTube / Vimeo URL)" help="Shown first on the product page and used as card thumbnail">
              <input className="input" {...text("videoUrl")} placeholder="https://youtube.com/watch?v=..." />
            </Field>
            {v.videoUrl && !parseVideo(v.videoUrl) && <p className="text-xs text-red-400">Not a recognised YouTube/Vimeo URL</p>}
            <div>
              <span className="label">Images</span>
              <div className="flex flex-wrap gap-3">
                {v.images.map((src, i) => (
                  <div key={src} className="group relative h-20 w-32 overflow-hidden rounded-lg border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => set("images", v.images.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white opacity-0 group-hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-primary px-1 text-[10px] font-bold text-white">COVER</span>}
                  </div>
                ))}
                {newImages.map((f, i) => (
                  <div key={i} className="relative flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-primary/50 p-2 text-center text-[10px] text-muted">
                    {f.name}
                    <button type="button" onClick={() => setNewImages(newImages.filter((_, j) => j !== i))} className="absolute right-1 top-1 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => imgInput.current?.click()} className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-white/20 text-muted hover:border-primary hover:text-white">
                  <Upload className="h-5 w-5" />
                </button>
                <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={(e) => setNewImages([...newImages, ...Array.from(e.target.files ?? [])])} />
              </div>
              <p className="mt-2 text-xs text-white/40">Or paste an image URL: <input className="input mt-1" placeholder="https://..." onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (/^https?:\/\//.test(val)) set("images", [...v.images, val]);
                  (e.target as HTMLInputElement).value = "";
                }
              }} /></p>
            </div>
          </div>
        </Panel>

        <Panel title="Feature bullets">
          <div className="space-y-2">
            {v.features.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" value={f} onChange={(e) => set("features", v.features.map((x, j) => (j === i ? e.target.value : x)))} />
                <button type="button" className="btn-danger !px-2" onClick={() => set("features", v.features.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => set("features", [...v.features, ""])}><Plus className="h-4 w-4" /> Add feature</button>
          </div>
        </Panel>

        <Panel title={`Value stack / bonuses (total ${formatINR(bonusTotal)})`}>
          <div className="space-y-2">
            {v.bonusItems.map((b, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" placeholder="What they get" value={b.title} onChange={(e) => set("bonusItems", v.bonusItems.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <input
                  className="input !w-36"
                  type="number"
                  min={0}
                  placeholder="Value ₹"
                  value={b.value ? b.value / 100 : ""}
                  onChange={(e) => set("bonusItems", v.bonusItems.map((x, j) => (j === i ? { ...x, value: toPaise(e.target.value || 0) } : x)))}
                />
                <button type="button" className="btn-danger !px-2" onClick={() => set("bonusItems", v.bonusItems.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => set("bonusItems", [...v.bonusItems, { title: "", value: 0 }])}><Plus className="h-4 w-4" /> Add item</button>
          </div>
        </Panel>

        <Panel title="Delivery">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["FILE", "LINK", "LICENSE"] as const).map((t) => (
                <button key={t} type="button" onClick={() => set("deliveryType", t)} className={v.deliveryType === t ? "btn-primary" : "btn-secondary"}>
                  {t === "FILE" ? "📁 File download" : t === "LINK" ? "🔗 External link" : "🔑 License key"}
                </button>
              ))}
            </div>
            {v.deliveryType === "FILE" && (
              <Field label="Product file (zip, pdf, …)" help={v.fileName ? `Current file: ${v.fileName}` : "No file uploaded yet"}>
                <input type="file" className="input" onChange={(e) => setProductFile(e.target.files?.[0] ?? null)} />
              </Field>
            )}
            {v.deliveryType === "LINK" && (
              <Field label="Access URL" help="Notion / Google Drive / course link revealed after payment">
                <input className="input" {...text("externalUrl")} placeholder="https://" />
              </Field>
            )}
            {v.deliveryType === "LICENSE" && (
              <div className="space-y-3">
                <Toggle checked={v.autoLicense} onChange={(x) => set("autoLicense", x)} label="Auto-generate keys when the pool is empty" />
                {keyStats && (
                  <p className="text-sm text-muted">
                    <KeyRound className="mr-1 inline h-4 w-4" />
                    {keyStats.free} unused of {keyStats.total} keys in pool
                  </p>
                )}
                {v.id && (
                  <Field label="Import keys (one per line or comma-separated)">
                    <textarea className="input min-h-24 font-mono" value={keysText} onChange={(e) => setKeysText(e.target.value)} />
                    <button
                      type="button"
                      className="btn-secondary mt-2"
                      disabled={!keysText.trim() || pending}
                      onClick={() =>
                        start(async () => {
                          const r = await importLicenseKeys(v.id!, keysText);
                          toast(r.ok ? `Imported ${r.added} keys` : r.error, !r.ok);
                          setKeysText("");
                          router.refresh();
                        })
                      }
                    >
                      Import keys
                    </button>
                  </Field>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Right column */}
      <div className="space-y-6">
        <Panel title="Publish">
          <div className="space-y-4">
            <Field label="Status">
              <select className="input" {...text("status")}>
                <option value="DRAFT">Draft</option>
                <option value="LIVE">Live</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </Field>
            <button disabled={pending} className="btn-primary w-full"><Save className="h-4 w-4" /> {pending ? "Saving…" : "Save product"}</button>
            {v.id && v.status === "LIVE" && (
              <a href={`/products/${v.slug}`} target="_blank" className="btn-secondary w-full">View on store ↗</a>
            )}
          </div>
        </Panel>

        <Panel title="Pricing">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price ₹"><input className="input" type="number" step="0.01" min="1" required {...text("price")} /></Field>
              <Field label="Compare-at ₹" help="Strikethrough"><input className="input" type="number" step="0.01" {...text("compareAtPrice")} /></Field>
            </div>
            {off > 0 && <p className="text-sm font-bold text-green-400">Shows as {off}% OFF</p>}
          </div>
        </Panel>

        <Panel title="Urgency (real deadlines only)">
          <div className="space-y-4">
            <Field label="Sale ends at" help="Countdown target. When it passes the price automatically reverts.">
              <input className="input" type="datetime-local" {...text("saleEndsAt")} />
            </Field>
            <Field label="Price after sale ends ₹" help="Blank = compare-at price">
              <input className="input" type="number" step="0.01" {...text("salePrice")} />
            </Field>
            <Field label="Stock limit" help="Blank = unlimited. Shows a real 'X left' meter.">
              <input className="input" type="number" min="0" {...text("stockLimit")} />
            </Field>
          </div>
        </Panel>

        <Panel title="Checkout">
          <div className="space-y-4">
            <div>
              <span className="label">Allowed gateways</span>
              <div className="space-y-2">
                {(["youpi", "razorpay"] as const).map((g) => (
                  <label key={g} className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={v.allowedGateways.includes(g)}
                      onChange={(e) => set("allowedGateways", e.target.checked ? [...v.allowedGateways, g] : v.allowedGateways.filter((x) => x !== g))}
                    />
                    {g === "youpi" ? "YouPI (UPI)" : "Razorpay"}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Order bump product" help="Offered as a one-click add-on at checkout">
              <select className="input" {...text("orderBumpProductId")}>
                <option value="">None</option>
                {otherProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
            {v.orderBumpProductId && (
              <Field label="Bump price ₹" help="Blank = bump product's own price">
                <input className="input" type="number" step="0.01" {...text("orderBumpPrice")} />
              </Field>
            )}
            <Field label="Guarantee line"><input className="input" {...text("guaranteeText")} placeholder="7-day money-back guarantee" /></Field>
          </div>
        </Panel>
      </div>
    </form>
  );
}
