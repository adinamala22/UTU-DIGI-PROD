import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { ProductList } from "./ProductList";

export default async function ProductsPage() {
  const products = await db.product.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return (
    <div>
      <PageHeader title="Products" description="Drag to reorder how products appear on the store.">
        <Link href="/admin/products/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New product
        </Link>
      </PageHeader>
      <ProductList
        initial={products.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          price: p.price,
          status: p.status,
          soldCount: p.soldCount,
          stockLimit: p.stockLimit,
          deliveryType: p.deliveryType,
          image: p.images[0] ?? null,
        }))}
      />
    </div>
  );
}
