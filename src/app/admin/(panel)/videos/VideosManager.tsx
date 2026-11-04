"use client";
import { ContentManager } from "@/components/admin/ContentManager";

export function VideosManager({ rows }: { rows: { id: string; title: string; url: string; caption: string | null; featured: boolean; enabled: boolean }[] }) {
  return (
    <ContentManager
      model="video"
      rows={rows}
      defaults={{ title: "", url: "", caption: "", featured: false, enabled: true }}
      title={(r) => `${r.featured ? "★ " : ""}${r.title}`}
      summary={(r) => String(r.url)}
      fields={[
        { key: "title", label: "Title", type: "text" },
        { key: "url", label: "YouTube / Vimeo URL", type: "text" },
        { key: "caption", label: "Caption", type: "textarea" },
        { key: "featured", label: "Featured (main player)", type: "boolean" },
        { key: "enabled", label: "Visible", type: "boolean" },
      ]}
    />
  );
}
