"use client";

import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number;
  isCurrency?: boolean;
  trend?: number;
  color?: "blue" | "green" | "red" | "yellow" | "gray";
  className?: string;
  icon?: React.ReactNode;
}

const glowMap = {
  blue: "rgba(10, 132, 255, 0.08)",
  green: "rgba(50, 215, 75, 0.08)",
  red: "rgba(255, 69, 58, 0.08)",
  yellow: "rgba(255, 214, 10, 0.08)",
  gray: "rgba(0, 0, 0, 0.04)",
};

const iconBgMap = {
  blue: "bg-ios-blue/10 text-ios-blue",
  green: "bg-ios-green/10 text-ios-green",
  red: "bg-ios-red/10 text-ios-red",
  yellow: "bg-ios-yellow/10 text-ios-yellow",
  gray: "bg-black/[0.06] text-[#424245]",
};

export default function MetricCard({ 
  label, 
  value, 
  isCurrency = true, 
  trend, 
  color = "blue",
  className,
  icon,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "glass-card p-6 flex flex-col gap-3 relative overflow-hidden group",
        className
      )}
    >
      {/* Background glow */}
      <div 
        className="absolute top-0 right-0 w-40 h-40 -mr-20 -mt-20 blur-3xl opacity-60 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle, ${glowMap[color]}, transparent)` }}
      />

      <div className="flex items-center justify-between relative z-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868b]">
          {label}
        </p>
        {icon && (
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", iconBgMap[color])}>
            {icon}
          </div>
        )}
      </div>
      
      <h3 className="text-2xl font-bold tracking-tight text-[#1d1d1f] leading-none tabular-nums relative z-10">
        {isCurrency ? formatCurrency(value) : value.toLocaleString()}
      </h3>

      {trend !== undefined && (
        <div className="mt-auto flex items-center gap-1.5 relative z-10">
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
            trend > 0 
              ? "bg-ios-green/10 text-ios-green" 
              : trend < 0 
              ? "bg-ios-red/10 text-ios-red" 
              : "bg-black/[0.04] text-[#86868b]"
          )}>
            {trend > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {Math.abs(trend)}%
          </div>
          <span className="text-[10px] text-[#86868b]">
            vs last month
          </span>
        </div>
      )}
    </motion.div>
  );
}
