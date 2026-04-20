"use client";

import { useEffect, useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { Loader2, Download, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import toast from "react-hot-toast";

export default function NetLedgerPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/vendors")
      .then(res => res.json())
      .then(data => {
        setVendors(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPayin = filteredVendors.reduce((sum, v) => sum + v.stats.payin, 0);
  const totalPayout = filteredVendors.reduce((sum, v) => sum + v.stats.payout, 0);
  const totalNet = totalPayin - totalPayout;

  const handleExport = () => {
    const headers = ["Vendor Name", "Total Pay-in", "Total Payout", "Net Balance", "Status"];
    const rows = filteredVendors.map(v => [
      v.name,
      v.stats.payin,
      v.stats.payout,
      v.stats.net,
      v.isActive ? "Active" : "Inactive"
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `net_ledger_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export started");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">Net Ledger</h1>
          <p className="text-[#86868b] mt-1">Consolidated financial standing for all external partners.</p>
        </div>

        <Button variant="outline" onClick={handleExport} className="glass-button text-[#1d1d1f] border-black/5 h-11">
          <Download className="w-4 h-4 mr-2" /> Export Ledger CSV
        </Button>
      </div>

      <div className="flex items-center gap-4 py-3 px-6 glass rounded-2xl border-black/5">
        <Search className="w-5 h-5 text-[#86868b] opacity-40" />
        <input 
          type="text" 
          placeholder="Quick search vendor..." 
          className="bg-transparent border-0 outline-none text-[#1d1d1f] text-sm flex-1 placeholder:text-[#86868b]/20"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[#86868b]">Compiling master ledger...</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden border-black/5">
          <Table>
            <TableHeader className="bg-black/5">
              <TableRow className="border-black/5 hover:bg-transparent">
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">Vendor Name</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] text-right">Total Pay-in</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] text-right">Total Payout</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] text-right">Net Balance</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] text-center">Activity</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.map((vendor) => (
                <TableRow key={vendor.id} className="border-black/5 hover:bg-black/5 glass-table-row transition-colors">
                  <TableCell className="font-semibold text-[#1d1d1f]">{vendor.name}</TableCell>
                  <TableCell className="text-right text-ios-green font-medium">{formatCurrency(vendor.stats.payin)}</TableCell>
                  <TableCell className="text-right text-ios-red font-medium">{formatCurrency(vendor.stats.payout)}</TableCell>
                  <TableCell className={cn(
                    "text-right font-bold",
                    vendor.stats.net >= 0 ? "text-[#1d1d1f]" : "text-ios-red"
                  )}>
                    {formatCurrency(vendor.stats.net)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", vendor.isActive ? "bg-ios-green" : "bg-black/10")} />
                      <span className="text-[10px] uppercase font-bold text-[#86868b]">{vendor.isActive ? "Active" : "Idle"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/vendors/${vendor.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 hover:bg-primary/10 hover:text-primary transition-colors text-xs">
                        View Detail <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-black/5 border-t border-black/5">
              <TableRow className="hover:bg-transparent">
                <TableCell className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-widest">Aggregate Totals</TableCell>
                <TableCell className="text-right text-ios-green font-bold">{formatCurrency(totalPayin)}</TableCell>
                <TableCell className="text-right text-ios-red font-bold">{formatCurrency(totalPayout)}</TableCell>
                <TableCell className={cn("text-right font-bold text-lg", totalNet >= 0 ? "text-primary" : "text-ios-red")}>
                  {formatCurrency(totalNet)}
                </TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
