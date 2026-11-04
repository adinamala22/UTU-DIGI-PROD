"use client";
import { useRef, useState, useTransition } from "react";
import { ChevronDown, Copy, Eye, EyeOff, Monitor, Plus, Save, Smartphone, Trash2 } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";
import { Field, Toggle, toast } from "@/components/admin/ui";
import { SECTION_DEFS, sectionDef, type FieldDef } from "@/lib/sections";
import { cn } from "@/lib/utils";
import { saveSections } from "../../actions";

type Section = { id: string; type: string; enabled: boolean; config: Record<string, unknown> };

export function Builder({ initial, products }: { initial: Section[]; products: { slug: string; title: string }[] }) {
  const [sections, setSections] = useState<Section[]>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pending, start] = useTransition();
  const frame = useRef<HTMLIFrameElement>(null);

  const update = (next: Section[]) => {
    setSections(next);
    setDirty(true);
  };
  const patch = (id: string, cfg: Record<string, unknown>) => update(sections.map((s) => (s.id === id ? { ...s, config: { ...s.config, ...cfg } } : s)));

  function save() {
    start(async () => {
      const r = await saveSections("home", sections.map(({ type, enabled, config }) => ({ type, enabled, config })));
      if (r.ok) {
        toast("Published! Preview refreshed.");
        setDirty(false);
        frame.current?.contentWindow?.location.reload();
      } else toast(r.error, true);
    });
  }

  function add(type: string) {
    const def = sectionDef(type)!;
    const s = { id: `new-${Date.now()}`, type, enabled: true, config: { ...def.defaults } };
    update([...sections, s]);
    setOpen(s.id);
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[480px_1fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={pending || !dirty} className="btn-primary">
            <Save className="h-4 w-4" /> {pending ? "Publishing…" : dirty ? "Save & publish" : "All changes saved"}
          </button>
          <select className="input !w-auto" value="" onChange={(e) => e.target.value && add(e.target.value)}>
            <option value="">+ Add section…</option>
            {SECTION_DEFS.map((d) => (
              <option key={d.type} value={d.type}>{d.label}</option>
            ))}
          </select>
        </div>
        <SortableList
          items={sections}
          onChange={update}
          render={(s) => {
            const def = sectionDef(s.type);
            const isOpen = open === s.id;
            return (
              <div>
                <div className="flex items-center gap-2 p-3">
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", isOpen && "rotate-180")} />
                    <span className={cn("font-semibold", s.enabled ? "text-white" : "text-white/40 line-through")}>{def?.label ?? s.type}</span>
                    <span className="truncate text-xs text-muted">{String(s.config.headline ?? s.config.heading ?? "")}</span>
                  </button>
                  <button type="button" title={s.enabled ? "Hide" : "Show"} className="p-1 text-muted hover:text-white" onClick={() => update(sections.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)))}>
                    {s.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button type="button" title="Duplicate" className="p-1 text-muted hover:text-white" onClick={() => {
                    const i = sections.findIndex((x) => x.id === s.id);
                    const copy = { ...s, id: `new-${Date.now()}`, config: { ...s.config } };
                    update([...sections.slice(0, i + 1), copy, ...sections.slice(i + 1)]);
                  }}>
                    <Copy className="h-4 w-4" />
                  </button>
                  <button type="button" title="Remove" className="p-1 text-muted hover:text-red-400" onClick={() => confirm("Remove this section?") && update(sections.filter((x) => x.id !== s.id))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {isOpen && def && (
                  <div className="space-y-3 border-t border-white/5 p-4">
                    <p className="text-xs text-muted">{def.description}</p>
                    {def.fields.map((f) => (
                      <SectionField key={f.key} f={f} value={s.config[f.key]} products={products} onChange={(val) => patch(s.id, { [f.key]: val })} />
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />
        {!sections.length && (
          <button onClick={() => add("hero")} className="btn-secondary w-full"><Plus className="h-4 w-4" /> Add your first section</button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-muted">Live preview {dirty && <span className="text-yellow-300">(save to see changes)</span>}</span>
          <div className="flex gap-1">
            <button onClick={() => setDevice("desktop")} className={device === "desktop" ? "btn-primary !px-2 !py-1" : "btn-secondary !px-2 !py-1"}><Monitor className="h-4 w-4" /></button>
            <button onClick={() => setDevice("mobile")} className={device === "mobile" ? "btn-primary !px-2 !py-1" : "btn-secondary !px-2 !py-1"}><Smartphone className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex justify-center overflow-hidden rounded-xl border border-white/10 bg-black">
          <iframe ref={frame} src="/" title="Store preview" className={cn("h-[80vh] bg-bg transition-all", device === "mobile" ? "w-[390px]" : "w-full")} />
        </div>
      </div>
    </div>
  );
}

function SectionField({ f, value, onChange, products }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void; products: { slug: string; title: string }[] }) {
  switch (f.type) {
    case "textarea":
      return <Field label={f.label} help={f.help}><textarea className="input min-h-20" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} /></Field>;
    case "lines":
      return (
        <Field label={f.label} help={f.help}>
          <textarea className="input min-h-28" value={Array.isArray(value) ? value.join("\n") : ""} onChange={(e) => onChange(e.target.value.split("\n"))} onBlur={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />
        </Field>
      );
    case "boolean":
      return <Toggle checked={value !== false} onChange={onChange} label={f.label} />;
    case "number":
      return <Field label={f.label} help={f.help}><input type="number" className="input" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} /></Field>;
    case "product":
      return (
        <Field label={f.label} help={f.help}>
          <select className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">First live product</option>
            {products.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
          </select>
        </Field>
      );
    default:
      return <Field label={f.label} help={f.help}><input className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} /></Field>;
  }
}
