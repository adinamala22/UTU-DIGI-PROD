import { db } from "@/lib/db";
import { getSections } from "@/lib/catalog";
import { PageHeader } from "@/components/admin/ui";
import { Builder } from "./Builder";

export default async function BuilderPage() {
  const [sections, products] = await Promise.all([
    getSections("home", true),
    db.product.findMany({ where: { status: { not: "ARCHIVED" } }, select: { slug: true, title: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title="Page builder" description="Drag sections to reorder, toggle them on/off and edit their content. Save to publish." />
      <Builder initial={sections} products={products} />
    </div>
  );
}
