"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User, Bell, Search, Settings, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function TopBar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const role = (session?.user as any)?.role || "ADMIN";
  const profileHref = role === "VENDOR" ? "/vendor/profile" : "/admin/profile";
  const userName = session?.user?.name || "User";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpen]);

  return (
    <header className="glass sticky top-0 z-30 h-14 w-full flex items-center justify-between px-6 border-b border-black/[0.04]">
      {/* Search */}
      <div className="flex items-center gap-6">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b] group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search records..."
            className="glass-input pl-9 pr-4 py-1.5 text-sm w-[280px] h-9 rounded-xl"
          />
        </div>

        {/* Intelligence Badges */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Gemini 1.5 Pro Engine</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-ios-green/10 border border-ios-green/20">
            <div className="w-1.5 h-1.5 rounded-full bg-ios-green" />
            <span className="text-[10px] font-bold text-ios-green uppercase tracking-wider">AES-256 Secured</span>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="p-2 rounded-xl glass-button relative group">
          <Bell className="w-[18px] h-[18px] text-[#424245] group-hover:text-primary transition-colors" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-ios-red rounded-full border-[1.5px] border-white">
            <span className="absolute inset-0 bg-ios-red rounded-full animate-ping opacity-75" />
          </span>
        </button>

        <div className="h-5 w-px bg-black/[0.06] mx-1" />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              "flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl transition-all",
              menuOpen ? "bg-black/[0.05]" : "hover:bg-black/[0.03]"
            )}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-primary font-bold text-[11px]">
              {initials}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[13px] font-semibold text-[#1d1d1f] leading-tight tracking-tight">
                {userName}
              </span>
              <span className="text-[10px] text-[#86868b] uppercase tracking-wide font-medium">
                {role}
              </span>
            </div>
            <ChevronDown className={cn(
              "w-3.5 h-3.5 text-[#86868b] transition-transform duration-200",
              menuOpen && "rotate-180"
            )} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 z-50 min-w-[200px] p-1.5"
              style={{
                background: "rgba(255, 255, 255, 0.88)",
                backdropFilter: "blur(40px) saturate(200%)",
                WebkitBackdropFilter: "blur(40px) saturate(200%)",
                border: "1px solid rgba(255, 255, 255, 0.7)",
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08), 0 24px 64px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                animation: "glassModalSlideUp 200ms ease-out forwards",
              }}
            >
              <div className="px-3 py-2 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">
                My Account
              </div>

              <Link
                href={profileHref}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[#1d1d1f] rounded-xl hover:bg-primary/[0.08] hover:text-primary transition-colors cursor-pointer font-medium"
              >
                <Settings className="w-4 h-4" />
                Profile Settings
              </Link>

              <div className="h-px bg-black/[0.04] my-1 mx-2" />

              <button
                onClick={() => {
                  setMenuOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[#1d1d1f] rounded-xl hover:bg-ios-red/[0.08] hover:text-ios-red transition-colors cursor-pointer w-full text-left font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
