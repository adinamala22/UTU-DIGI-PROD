"use client";
import { ContentManager } from "@/components/admin/ContentManager";

export function FaqManager({ rows }: { rows: { id: string; question: string; answer: string }[] }) {
  return (
    <ContentManager
      model="faq"
      rows={rows}
      defaults={{ question: "", answer: "", enabled: true }}
      title={(r) => String(r.question)}
      summary={(r) => String(r.answer)}
      fields={[
        { key: "question", label: "Question", type: "text" },
        { key: "answer", label: "Answer", type: "textarea" },
        { key: "enabled", label: "Visible", type: "boolean" },
      ]}
    />
  );
}
