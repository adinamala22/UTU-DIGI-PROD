"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { SortableList } from "@/components/admin/SortableList";
import { StatusBadge, toast } from "@/components/admin/ui";
import { formatINR } from "@/lib/money";
import { deleteProduct, duplicateProduct, reorder } from "../../actions";

type Row = { id: string; title: string; slug: string; price: number; status: string; soldCount: number; stockLimit: number | null; deliveryType: string; image: string | null };

export function ProductList({ initial }: { initial: Row[] }) {
  const [items, setItems] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();
  if (!items.length) return <p className="text-muted">No products yet. Create your first one!</p>;
  return (
    <SortableList
      items={items}
      onChange={(next) => {
        setItems(next);
        start(async () => {
          await reorder("product", next.map((i) => i.id));
          toast("Order saved");
        });
      }}
      render={(p) => (
        <div className="flex flex-wrap items-center gap-4 p-3">
          <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-primary/40 to-primary2/30">
            {p.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/admin/products/${p.id}`} className="font-semibold text-white hover:underline">
              {p.title}
            </Link>
            <p className="text-xs text-muted">
              /{p.slug} · {p.deliveryType} · {p.soldCount} sold{p.stockLimit != null && ` / ${p.stockLimit}`}
            </p>
          </div>
          <span className="font-semibold text-white">{formatINR(p.price)}</span>
          <StatusBadge status={p.status} />
          <div className="flex gap-1">
            <Link href={`/admin/products/${p.id}`} className="btn-secondary !px-2" title="Edit">
              <Pencil className="h-4 w-4" />
            </Link>
            <a href={`/products/${p.slug}`} target="_blank" className="btn-secondary !px-2" title="View">
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              className="btn-secondary !px-2"
              title="Duplicate"
              onClick={() =>
                start(async () => {
                  const r = await duplicateProduct(p.id);
                  if (r.ok) router.push(`/admin/products/${r.id}`);
                })
              }
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              className="btn-danger !px-2"
              title="Delete"
              onClick={() => {
                if (!confirm(`Delete "${p.title}"? Products with orders are archived instead.`)) return;
                start(async () => {
                  await deleteProduct(p.id);
                  toast("Product removed");
                  setItems((x) => x.filter((i) => i.id !== p.id));
                  router.refresh();
                });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    />
  );
}
