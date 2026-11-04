"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingCart, LayoutTemplate, Video, MessageSquareQuote, HelpCircle, TicketPercent, Palette, Settings, ScrollText, ExternalLink, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/admin/login/actions";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/builder", label: "Page builder", icon: LayoutTemplate },
  { href: "/admin/videos", label: "Videos", icon: Video },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
  { href: "/admin/faqs", label: "FAQ", icon: HelpCircle },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/theme", label: "Theme", icon: Palette },
  { href: "/admin/settings", label: "Settings & payments", icon: Settings },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function Sidebar({ email }: { email: string }) {
  const path = usePathname();
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-white/5 bg-black/40 md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 px-5 py-5 font-black text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">U</span> Store Admin
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-primary/20 text-white" : "text-muted hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden space-y-1 border-t border-white/5 p-3 md:block">
        <a href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:text-white"><ExternalLink className="h-4 w-4" /> View store</a>
        <form action={logout}>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:text-white"><LogOut className="h-4 w-4" /> Log out</button>
        </form>
        <p className="truncate px-3 text-xs text-white/30">{email}</p>
      </div>
    </aside>
  );
}
