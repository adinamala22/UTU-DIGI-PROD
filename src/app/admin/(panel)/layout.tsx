import { requireAdmin } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";
import { Toaster } from "@/components/admin/ui";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col bg-[#08080c] md:flex-row">
      <Sidebar email={admin.email} />
      <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
      <Toaster />
    </div>
  );
}
