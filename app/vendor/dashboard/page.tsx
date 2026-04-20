"use client";

import { useEffect, useState } from "react";
import MetricCard from "@/components/MetricCard";
import LineChart from "@/components/Charts/LineChart";
import DonutChart from "@/components/Charts/DonutChart";
import TransactionTable from "@/components/TransactionTable";
import { Loader2, FileText, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VendorDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/vendor")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        return res.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => {
        console.error("Vendor dashboard error:", err);
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
        <p className="text-[#86868b] animate-pulse">Loading your financial data...</p>
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

  const { metrics, charts, recentTransactions, recentFiles } = data;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">My Financial Overview</h1>
          <p className="text-[#86868b] mt-1">Real-time status of your accounts and payment records.</p>
        </div>
        <Link href="/vendor/upload">
          <Button className="ios-blue-gradient text-white border-0 h-12 px-6 rounded-xl">
            <Upload className="w-4 h-4 mr-2" /> Upload Records
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="My Total Pay-in" value={metrics.totalPayin} color="green" />
        <MetricCard label="My Total Payout" value={metrics.totalPayout} color="red" />
        <MetricCard label="My Net Balance" value={metrics.netBalance} color="blue" />
        <MetricCard label="Total Records" value={metrics.totalRecords} isCurrency={false} color="gray" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LineChart 
            title="Account Growth (Monthly)"
            data={{
              labels: charts.monthly.map((m: any) => new Date(m.month).toLocaleDateString('default', { month: 'short' })),
              payin: charts.monthly.map((m: any) => Number(m.payin)),
              payout: charts.monthly.map((m: any) => Number(m.payout)),
            }} 
          />
        </div>
        <div>
          <DonutChart 
            title="Pay-in vs Payout Ratio"
            payin={metrics.totalPayin}
            payout={metrics.totalPayout}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-widest px-2">Most Recent Records</h4>
          <TransactionTable 
            transactions={recentTransactions} 
            showVendor={false}
          />
        </div>

        <div className="glass-card flex flex-col">
          <div className="p-6 border-b border-black/5">
            <h4 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> My Uploaded Files
            </h4>
          </div>
          <div className="divide-y divide-black/5">
            {recentFiles.map((file: any) => (
              <div key={file.id} className="p-4 flex items-center justify-between hover:bg-black/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#86868b]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f]">{file.fileName}</p>
                    <p className="text-[10px] text-[#86868b] uppercase font-bold tracking-widest">
                      {new Date(file.createdAt).toLocaleDateString()} • {(file.fileSize / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-ios-green px-2 py-0.5 rounded-full bg-ios-green/10 border border-ios-green/20">
                    {file.status}
                  </span>
                </div>
              </div>
            ))}
            {recentFiles.length === 0 && (
              <div className="p-12 text-center text-[#86868b] italic">
                No files uploaded yet.
              </div>
            )}
          </div>
          {recentFiles.length > 0 && (
            <div className="p-4 bg-black/5 text-center mt-auto">
              <button className="text-xs text-primary font-bold uppercase tracking-widest hover:underline">View All Files</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
