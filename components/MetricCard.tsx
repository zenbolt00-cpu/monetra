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
}

const colorMap = {
  blue: "from-ios-blue/10 to-ios-blue/5 border-ios-blue/10 text-ios-blue",
  green: "from-ios-green/10 to-ios-green/5 border-ios-green/10 text-ios-green",
  red: "from-ios-red/10 to-ios-red/5 border-ios-red/10 text-ios-red",
  yellow: "from-ios-yellow/10 to-ios-yellow/5 border-ios-yellow/10 text-ios-yellow",
  gray: "from-black/10 to-black/5 border-black/10 text-[#1d1d1f]",
};

export default function MetricCard({ 
  label, 
  value, 
  isCurrency = true, 
  trend, 
  color = "blue",
  className 
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "glass-card p-6 flex flex-col gap-2 relative overflow-hidden group",
        className
      )}
    >
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-20 blur-3xl -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-110",
        colorMap[color]
      )} />

      <p className="text-xs font-bold uppercase tracking-widest text-[#86868b]">{label}</p>
      
      <div className="flex items-baseline gap-2">
        <h3 className="text-3xl font-bold tracking-tight text-[#1d1d1f] leading-none">
          {isCurrency ? formatCurrency(value) : value.toLocaleString()}
        </h3>
      </div>

      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {trend > 0 ? (
            <TrendingUp className="w-3 h-3 text-ios-green" />
          ) : trend < 0 ? (
            <TrendingDown className="w-3 h-3 text-ios-red" />
          ) : (
            <Minus className="w-3 h-3 text-[#86868b]" />
          )}
          <span className={cn(
            "text-[10px] font-bold",
            trend > 0 ? "text-ios-green" : trend < 0 ? "text-ios-red" : "text-[#86868b]"
          )}>
            {Math.abs(trend)}% {trend >= 0 ? "up" : "down"}
          </span>
        </div>
      )}
    </motion.div>
  );
}
