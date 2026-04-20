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
  Wallet
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
    <aside className="glass-sidebar fixed left-0 top-0 z-40 h-screen w-[240px] px-4 py-8 flex flex-col">
      <div className="mb-10 px-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Montera</h1>
        <p className="text-[10px] uppercase tracking-widest text-[#86868b] mt-1">{role} PORTAL</p>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                isActive 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "text-[#424245] hover:text-[#1d1d1f] hover:bg-black/5"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-[#424245] group-hover:text-[#1d1d1f]")} />
              <span className="font-medium text-sm">{link.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4 py-4">
        <div className="glass p-4 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs capitalize">
            {role[0]}
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1d1d1f] truncate w-24">Montera User</p>
            <p className="text-[10px] text-[#86868b] capitalize">{role.toLowerCase()}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
