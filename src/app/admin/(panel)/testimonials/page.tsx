import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { TestimonialsManager } from "./TestimonialsManager";

export default async function TestimonialsPage() {
  const rows = await db.testimonial.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Testimonials" description="Only publish genuine reviews from real customers." />
      <TestimonialsManager rows={rows} />
    </div>
  );
}
