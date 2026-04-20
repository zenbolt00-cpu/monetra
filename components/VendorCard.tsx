"use client";

import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { User, Phone, Mail, ArrowRight, Activity, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface Vendor {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  gstin?: string | null;
  isActive: boolean;
  stats: {
    payin: number;
    payout: number;
    net: number;
  };
}

interface VendorCardProps {
  vendor: Vendor;
}

export default function VendorCard({ vendor }: VendorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="glass-card p-6 flex flex-col h-full group"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 transition-transform duration-300">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-[#1d1d1f] text-lg tracking-tight truncate w-32" title={vendor.name}>
              {vendor.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                vendor.isActive ? "bg-ios-green" : "bg-black/10"
              )} />
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#86868b]">
                {vendor.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <Link 
          href={`/admin/vendors/${vendor.id}`}
          className="p-2 rounded-xl glass hover:bg-primary/10 hover:text-primary transition-all group-hover:translate-x-1 text-[#424245]"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-3 mb-6 flex-1">
        <div className="flex items-center gap-2 text-xs text-[#424245]">
          <Mail className="w-3.5 h-3.5 text-[#86868b]" />
          <span className="truncate">{vendor.email}</span>
        </div>
        {vendor.phone && (
          <div className="flex items-center gap-2 text-xs text-[#424245]">
            <Phone className="w-3.5 h-3.5 text-[#86868b]" />
            <span>{vendor.phone}</span>
          </div>
        )}
        {vendor.gstin && (
          <div className="flex items-center gap-2 text-xs text-[#86868b]/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-mono">{vendor.gstin}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-auto pt-6 border-t border-black/5">
        <div className="p-3 rounded-2xl bg-ios-green/5 border border-ios-green/10">
          <p className="text-[9px] uppercase font-bold tracking-widest text-[#34C759] mb-1">Pay-in</p>
          <p className="text-sm font-bold text-[#1d1d1f]">{formatCurrency(vendor.stats.payin)}</p>
        </div>
        <div className="p-3 rounded-2xl bg-ios-red/5 border border-ios-red/10">
          <p className="text-[9px] uppercase font-bold tracking-widest text-[#FF3B30] mb-1">Payout</p>
          <p className="text-sm font-bold text-[#1d1d1f]">{formatCurrency(vendor.stats.payout)}</p>
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">Net Balance</span>
        <span className={cn(
          "text-xs font-bold",
          vendor.stats.net >= 0 ? "text-ios-green" : "text-ios-red"
        )}>
          {formatCurrency(vendor.stats.net)}
        </span>
      </div>
    </motion.div>
  );
}
