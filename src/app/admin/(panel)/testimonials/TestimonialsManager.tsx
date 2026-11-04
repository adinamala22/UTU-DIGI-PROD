"use client";
import { ContentManager } from "@/components/admin/ContentManager";

export function TestimonialsManager({ rows }: { rows: { id: string; name: string; quote: string; rating: number }[] }) {
  return (
    <ContentManager
      model="testimonial"
      rows={rows}
      defaults={{ name: "", role: "", avatarUrl: "", quote: "", rating: 5, enabled: true }}
      title={(r) => `${r.name} · ${"★".repeat(Number(r.rating) || 5)}`}
      summary={(r) => String(r.quote)}
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "role", label: "Role / company", type: "text" },
        { key: "avatarUrl", label: "Avatar image URL", type: "text" },
        { key: "quote", label: "Quote", type: "textarea" },
        { key: "rating", label: "Rating (1-5)", type: "number" },
        { key: "enabled", label: "Visible", type: "boolean" },
      ]}
    />
  );
}
