"use client";

import { useEffect, useState } from "react";
import MetricCard from "@/components/MetricCard";
import LineChart from "@/components/Charts/LineChart";
import DonutChart from "@/components/Charts/DonutChart";
import TransactionTable from "@/components/TransactionTable";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/admin")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        return res.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => {
        console.error("Dashboard error:", err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-[#86868b] animate-pulse">Calculating financial overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-ios-red/10 flex items-center justify-center">
          <p className="text-2xl">⚠️</p>
        </div>
        <h2 className="text-xl font-bold text-[#1d1d1f]">Dashboard Error</h2>
        <p className="text-[#86868b] max-w-md px-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-primary text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { metrics, charts, topVendors, recentTransactions } = data;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">Financial Overview</h1>
        <p className="text-[#86868b] mt-1">Aggregated performance across all vendors and operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Total Pay-in" value={metrics.totalPayin} color="green" trend={12} />
        <MetricCard label="Total Payout" value={metrics.totalPayout} color="red" trend={-4} />
        <MetricCard label="Net Balance" value={metrics.netBalance} color="blue" />
        <MetricCard label="Active Vendors" value={metrics.totalVendors} isCurrency={false} color="gray" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LineChart 
            title="Pay-in vs Payout (12M)"
            data={{
              labels: charts.monthly.map((m: any) => new Date(m.month).toLocaleDateString('default', { month: 'short' })),
              payin: charts.monthly.map((m: any) => Number(m.payin)),
              payout: charts.monthly.map((m: any) => Number(m.payout)),
            }} 
          />
        </div>
        <div>
          <DonutChart 
            title="Revenue Ratio"
            payin={metrics.totalPayin}
            payout={metrics.totalPayout}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card flex flex-col">
          <div className="p-6 border-b border-black/5 flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Top Vendors by Volume
            </h4>
            <Link href="/admin/vendors" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/5 text-[10px] uppercase font-bold text-[#86868b] tracking-wider">
                <tr>
                  <th className="px-6 py-3">Vendor Name</th>
                  <th className="px-6 py-3 text-right">Total Volume</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {topVendors.map((vendor: any) => (
                  <tr key={vendor.id} className="hover:bg-black/5 transition-colors">
                    <td className="px-6 py-4 font-semibold text-[#1d1d1f]">{vendor.name}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-[#424245]">{formatCurrency(vendor.volume)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-ios-green shadow-[0_0_8px_#32D74B]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="px-2">
            <h4 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-widest">Recent Activity</h4>
          </div>
          <TransactionTable 
            transactions={recentTransactions} 
            showVendor={true}
          />
        </div>
      </div>
    </div>
  );
}
