import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { FaqManager } from "./FaqManager";

export default async function FaqPage() {
  const rows = await db.faq.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="FAQ" description="Handle objections before they stop the sale." />
      <FaqManager rows={rows} />
    </div>
  );
}
