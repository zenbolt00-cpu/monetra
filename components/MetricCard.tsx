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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "glass-card p-7 flex flex-col gap-4 relative overflow-hidden group border-white/40",
        className
      )}
    >
      {/* Background dynamic glow */}
      <div 
        className="absolute top-0 right-0 w-48 h-48 -mr-20 -mt-20 blur-3xl opacity-40 transition-all duration-700 group-hover:opacity-80 group-hover:scale-110"
        style={{ background: `radial-gradient(circle, ${glowMap[color]}, transparent)` }}
      />

      <div className="flex items-center justify-between relative z-10">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#86868b] opacity-80">
          {label}
        </p>
        {icon && (
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm", iconBgMap[color])}>
            {icon}
          </div>
        )}
      </div>
      
      <div className="space-y-1 relative z-10">
        <h3 className="text-3xl font-bold tracking-tight text-[#1d1d1f] leading-none tabular-nums">
          {isCurrency ? formatCurrency(value) : value.toLocaleString()}
        </h3>
        {trend !== undefined && (
          <div className="flex items-center gap-2 pt-2">
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm",
              trend > 0 
                ? "bg-ios-green/10 text-ios-green border border-ios-green/10" 
                : trend < 0 
                ? "bg-ios-red/10 text-ios-red border border-ios-red/10" 
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
            <span className="text-[10px] font-medium text-[#86868b]">
              vs last month
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
