"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { SortableList } from "./SortableList";
import { Field, Toggle, toast } from "./ui";
import { deleteContent, reorder, saveContent, type ContentModel } from "@/app/admin/actions";
import { parseVideo } from "@/lib/video";

export type CmField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "boolean" | "number" | "select" | "date" | "multiselect";
  options?: { value: string; label: string }[];
  help?: string;
  required?: boolean;
};

type Row = { id: string } & Record<string, unknown>;

export function ContentManager({
  model,
  rows,
  fields,
  defaults,
  title,
  sortable = true,
  summary,
}: {
  model: ContentModel;
  rows: Row[];
  fields: CmField[];
  defaults: Record<string, unknown>;
  title: (r: Row) => string;
  sortable?: boolean;
  summary?: (r: Row) => string;
}) {
  const [items, setItems] = useState(rows);
  const [editing, setEditing] = useState<{ id: string | null; data: Record<string, unknown> } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    if (!editing) return;
    start(async () => {
      const r = await saveContent(model, editing.id, editing.data);
      if (!r.ok) return toast(r.error, true);
      toast("Saved");
      setEditing(null);
      router.refresh();
      setItems((xs) => (editing.id ? xs.map((x) => (x.id === editing.id ? { ...x, ...editing.data } : x)) : [...xs, { id: r.id!, ...editing.data }]));
    });
  }

  const renderRow = (r: Row) => (
    <div className="flex items-center gap-3 p-3">
      {model === "video" && typeof r.url === "string" && parseVideo(r.url) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={parseVideo(r.url)!.thumbnail} alt="" className="h-10 w-16 rounded object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className={r.enabled === false || r.active === false ? "truncate font-semibold text-white/40" : "truncate font-semibold text-white"}>{title(r)}</p>
        {summary && <p className="truncate text-xs text-muted">{summary(r)}</p>}
      </div>
      <button className="btn-secondary !px-2" onClick={() => setEditing({ id: r.id, data: Object.fromEntries(fields.map((f) => [f.key, r[f.key]])) })}>
        <Pencil className="h-4 w-4" />
      </button>
      <button
        className="btn-danger !px-2"
        onClick={() =>
          confirm("Delete this item?") &&
          start(async () => {
            await deleteContent(model, r.id);
            setItems((xs) => xs.filter((x) => x.id !== r.id));
            toast("Deleted");
          })
        }
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <button className="btn-primary" onClick={() => setEditing({ id: null, data: { ...defaults } })}>
        <Plus className="h-4 w-4" /> Add new
      </button>
      {items.length === 0 && <p className="text-sm text-muted">Nothing here yet.</p>}
      {sortable && model !== "coupon" ? (
        <SortableList
          items={items}
          onChange={(next) => {
            setItems(next);
            start(async () => {
              await reorder(model as "video" | "testimonial" | "faq", next.map((i) => i.id));
              toast("Order saved");
            });
          }}
          render={renderRow}
        />
      ) : (
        <div className="space-y-2">{items.map((r) => <div key={r.id} className="rounded-xl border border-white/5 bg-surface">{renderRow(r)}</div>)}</div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-white/10 bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">{editing.id ? "Edit" : "New"}</h2>
              <button onClick={() => setEditing(null)} className="text-muted hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            {fields.map((f) => (
              <CmInput key={f.key} f={f} value={editing.data[f.key]} onChange={(val) => setEditing({ ...editing, data: { ...editing.data, [f.key]: val } })} />
            ))}
            {model === "video" && typeof editing.data.url === "string" && parseVideo(editing.data.url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={parseVideo(editing.data.url)!.thumbnail} alt="preview" className="w-full rounded-lg" />
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CmInput({ f, value, onChange }: { f: CmField; value: unknown; onChange: (v: unknown) => void }) {
  switch (f.type) {
    case "boolean":
      return <Toggle checked={Boolean(value)} onChange={onChange} label={f.label} />;
    case "textarea":
      return <Field label={f.label} help={f.help}><textarea className="input min-h-24" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} /></Field>;
    case "number":
      return <Field label={f.label} help={f.help}><input type="number" className="input" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)} /></Field>;
    case "date":
      return (
        <Field label={f.label} help={f.help}>
          <input type="date" className="input" value={value ? String(value).slice(0, 10) : ""} onChange={(e) => onChange(e.target.value || null)} />
        </Field>
      );
    case "select":
      return (
        <Field label={f.label} help={f.help}>
          <select className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      );
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Field label={f.label} help={f.help}>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-black/30 p-2">
            {f.options!.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={arr.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))} />
                {o.label}
              </label>
            ))}
          </div>
        </Field>
      );
    }
    default:
      return <Field label={f.label} help={f.help}><input className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} /></Field>;
  }
}
