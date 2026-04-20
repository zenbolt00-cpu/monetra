"use client";

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DonutChartProps {
  payin: number;
  payout: number;
  title?: string;
}

export default function DonutChart({ payin, payout, title }: DonutChartProps) {
  const net = payin - payout;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: '#86868b',
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 10, weight: '600' as any },
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        cornerRadius: 12,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            return ` ${context.label}: ${formatCurrency(context.raw)}`;
          }
        }
      }
    }
  };

  const chartData = {
    labels: ['Pay-in', 'Payout'],
    datasets: [
      {
        data: [payin, payout],
        backgroundColor: [
          'rgba(10, 132, 255, 0.8)',
          'rgba(255, 69, 58, 0.8)',
        ],
        borderColor: [
          '#0A84FF',
          '#FF453A',
        ],
        borderWidth: 1,
        hoverOffset: 4
      }
    ]
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-6 h-[400px] flex flex-col items-center relative"
    >
      <div className="mb-4 w-full text-left">
        <h4 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-widest">{title || "Transaction Ratio"}</h4>
      </div>
      
      <div className="flex-1 w-full relative">
        <Doughnut options={options} data={chartData} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-6">
          <p className="text-[10px] text-[#86868b] uppercase font-bold tracking-widest">Net Balance</p>
          <p className={cn(
            "text-xl font-bold tracking-tight",
            net >= 0 ? "text-[#1d1d1f]" : "text-ios-red"
          )}>
            {formatCurrency(net)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// Helper to keep the file clean, usually imported from utils
function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
