"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  BookOpen, 
  Users, 
  UploadCloud, 
  History, 
  UserCircle,
  PiggyBank,
  Wallet,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  role: "ADMIN" | "VENDOR";
}

const adminLinks = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Vendor Pay-in", href: "/admin/payin", icon: ArrowDownCircle },
  { label: "Vendor Payout", href: "/admin/payout", icon: ArrowUpCircle },
  { label: "Net Ledger", href: "/admin/net-ledger", icon: BookOpen },
  { label: "Vendor Management", href: "/admin/vendors", icon: Users },
  { label: "Upload Files", href: "/admin/upload", icon: UploadCloud },
  { label: "Admin Pay-in", href: "/admin/my-payin", icon: PiggyBank },
  { label: "Admin Payout", href: "/admin/my-payout", icon: Wallet },
  { label: "Audit Log", href: "/admin/audit", icon: History },
];

const vendorLinks = [
  { label: "Dashboard", href: "/vendor/dashboard", icon: LayoutDashboard },
  { label: "My Pay-in", href: "/vendor/payin", icon: ArrowDownCircle },
  { label: "My Payout", href: "/vendor/payout", icon: ArrowUpCircle },
  { label: "Upload Records", href: "/vendor/upload", icon: UploadCloud },
  { label: "My Profile", href: "/vendor/profile", icon: UserCircle },
];

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const links = role === "ADMIN" ? adminLinks : vendorLinks;

  return (
    <aside className="glass-sidebar fixed left-0 top-0 z-40 h-screen w-[240px] px-3 py-6 flex flex-col">
      {/* Logo */}
      <div className="mb-8 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl ios-blue-gradient flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#1d1d1f]">
              Monetra
            </h1>
            <p className="text-[9px] uppercase tracking-[0.12em] text-[#86868b] font-semibold -mt-0.5">
              {role} Portal
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 relative",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-[#424245] hover:text-[#1d1d1f] hover:bg-black/[0.04]"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
              )}
              <Icon 
                className={cn(
                  "w-[18px] h-[18px] transition-colors", 
                  isActive 
                    ? "text-primary" 
                    : "text-[#86868b] group-hover:text-[#424245]"
                )} 
              />
              <span className={cn(
                "text-[13px] tracking-tight",
                isActive ? "font-semibold" : "font-medium"
              )}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Card */}
      <div className="mt-auto px-1">
        <div className="glass p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-primary font-bold text-xs capitalize">
            {role[0]}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#1d1d1f] truncate">
              Monetra User
            </p>
            <p className="text-[10px] text-[#86868b] capitalize tracking-tight">
              {role.toLowerCase()} account
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
