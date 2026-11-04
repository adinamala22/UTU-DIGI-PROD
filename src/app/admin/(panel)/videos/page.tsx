import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { VideosManager } from "./VideosManager";

export default async function VideosPage() {
  const rows = await db.video.findMany({ orderBy: [{ featured: "desc" }, { sortOrder: "asc" }] });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Videos" description="Paste YouTube or Vimeo links. The featured video plays big in the video section; the rest appear as a carousel." />
      <VideosManager rows={rows} />
    </div>
  );
}
