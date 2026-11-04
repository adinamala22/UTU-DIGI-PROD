import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";

export default async function AuditPage() {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div>
      <PageHeader title="Audit log" description="Last 200 admin and system actions." />
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Details</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-white/5">
                <td className="whitespace-nowrap p-3 text-xs text-muted">{l.createdAt.toLocaleString("en-IN")}</td>
                <td className="p-3 text-white">{l.actor}</td>
                <td className="p-3 font-mono text-xs text-primary">{l.action}</td>
                <td className="p-3 font-mono text-xs text-muted">{l.target}</td>
                <td className="max-w-md truncate p-3 font-mono text-xs text-muted">{l.meta ? JSON.stringify(l.meta) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
