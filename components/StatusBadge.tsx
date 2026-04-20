"use client";

import { cn } from "@/lib/utils";

export type StatusType = "CONFIRMED" | "PENDING" | "REJECTED" | "PAYIN" | "PAYOUT";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig = {
  CONFIRMED: { label: "Confirmed", class: "bg-ios-green/10 text-ios-green border-ios-green/20" },
  PENDING: { label: "Pending", class: "bg-ios-yellow/10 text-[#B8860B] border-ios-yellow/20" },
  REJECTED: { label: "Rejected", class: "bg-ios-red/10 text-ios-red border-ios-red/20" },
  PAYIN: { label: "Pay-in", class: "bg-ios-green/5 text-ios-green border-ios-green/10" },
  PAYOUT: { label: "Payout", class: "bg-ios-red/5 text-ios-red border-ios-red/10" },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={cn(
      "glass-pill px-3 py-1 text-[10px] font-bold uppercase tracking-wider border",
      config.class,
      className
    )}>
      {config.label}
    </span>
  );
}
