"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User, Bell, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function TopBar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const role = (session?.user as any)?.role || "ADMIN";
  const profileHref = role === "VENDOR" ? "/vendor/profile" : "/admin/profile";

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
    <header className="glass sticky top-0 z-30 h-16 w-full flex items-center justify-between px-8 backdrop-blur-3xl border-b">
      <div className="flex items-center gap-6">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b] group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search records..."
            className="glass-input pl-10 pr-4 py-1.5 text-sm w-[300px]"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full glass hover:bg-black/5 transition-colors relative">
          <Bell className="w-5 h-5 text-[#424245]" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-ios-red rounded-full border-2 border-white" />
        </button>

        <div className="h-6 w-px bg-black/10 mx-2" />

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-[#1d1d1f] leading-tight">
              {session?.user?.name || "User"}
            </span>
            <span className="text-[10px] text-[#86868b] uppercase tracking-tighter">
              {role}
            </span>
          </div>

          {/* Custom dropdown to avoid @base-ui/react Menu context issues */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-10 h-10 rounded-full glass flex items-center justify-center border-black/5 hover:border-primary/50 transition-colors outline-none"
            >
              <User className="w-6 h-6 text-[#424245]" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-50 min-w-[200px] p-2"
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(32px) saturate(200%)",
                  WebkitBackdropFilter: "blur(32px) saturate(200%)",
                  border: "1px solid rgba(0, 0, 0, 0.08)",
                  borderRadius: "16px",
                  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
                  animation: "glassModalSlideUp 200ms ease-out forwards",
                }}
              >
                <div className="px-2 py-1.5 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">
                  My Account
                </div>
                <div className="h-px bg-black/5 my-1 -mx-1" />

                <Link
                  href={profileHref}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-[#1d1d1f] rounded-xl hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  Profile Settings
                </Link>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: "/login" });
                  }}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-[#1d1d1f] rounded-xl hover:bg-ios-red/10 hover:text-ios-red transition-colors cursor-pointer w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
