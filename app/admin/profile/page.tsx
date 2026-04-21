"use client";

import React from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Mail,
  Shield,
  Lock,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export default function AdminProfilePage() {
  const { data: session } = useSession();

  const user = session?.user as any;

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
          Admin Profile
        </h1>
        <p className="text-[#86868b] mt-1">
          Manage your administrator account settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Card */}
        <div className="glass-card p-8 space-y-8">
          <div className="flex items-center gap-5 border-b border-black/5 pb-8">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10 shadow-sm">
              <Shield className="w-10 h-10" />
            </div>
            <div>
              <h2 className="font-bold text-[#1d1d1f] text-2xl">
                {user?.name || "Admin"}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] uppercase font-bold border border-primary/10 mt-2">
                Administrator
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-[#86868b]" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">
                  Full Name
                </p>
                <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">
                  {user?.name || "Monetra Admin"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-[#86868b]" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">
                  Email Address
                </p>
                <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">
                  {user?.email || "admin@monetra.app"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-[#86868b]" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">
                  Role
                </p>
                <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">
                  {user?.role || "ADMIN"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Card */}
        <div className="space-y-6">
          <div className="glass-card p-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#86868b] flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" /> Account Security
            </h3>

            <div className="p-5 rounded-2xl bg-black/5 border border-black/5 space-y-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">
                  Password
                </p>
                <p className="text-sm font-mono text-[#1d1d1f] mt-0.5">
                  ••••••••••••
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">
                  Auth Method
                </p>
                <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">
                  JWT Credentials
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full glass-button border-black/5 text-[#1d1d1f] text-xs h-10"
              onClick={() =>
                toast("Password change feature coming soon", { icon: "🔐" })
              }
            >
              Change Password
            </Button>
          </div>

          <div className="glass-card p-6 border-ios-green/10">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-ios-green shadow-[0_0_8px_#32D74B]" />
              <div>
                <p className="text-xs font-bold text-[#1d1d1f]">
                  System Status
                </p>
                <p className="text-[10px] text-[#86868b]">
                  All services operational
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
