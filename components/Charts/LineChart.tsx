"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { motion } from 'framer-motion';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface LineChartProps {
  data: {
    labels: string[];
    payin: number[];
    payout: number[];
  };
  title?: string;
}

export default function LineChart({ data, title }: LineChartProps) {
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          color: '#86868b',
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 10, weight: '600' as any, family: '-apple-system' },
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        titleColor: '#1d1d1f',
        bodyColor: '#1d1d1f',
        borderColor: 'rgba(0, 0, 0, 0.05)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        displayColors: true,
        usePointStyle: true
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#86868b', font: { size: 10, weight: '500' as any } }
      },
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.03)' },
        ticks: { color: '#86868b', font: { size: 10, weight: '500' as any } }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
  };

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Pay-in',
        data: data.payin,
        borderColor: '#0A84FF',
        backgroundColor: 'rgba(10, 132, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 3
      },
      {
        label: 'Payout',
        data: data.payout,
        borderColor: '#FF453A',
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 3
      }
    ]
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-6 h-[400px] flex flex-col"
    >
      <div className="mb-4">
        <h4 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-widest">{title || "Monthly Volume"}</h4>
      </div>
      <div className="flex-1 w-full relative">
        <Line options={options} data={chartData} />
      </div>
    </motion.div>
  );
}
