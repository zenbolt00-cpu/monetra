"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import TransactionTable from "@/components/TransactionTable";
import TransactionFormModal from "@/components/TransactionFormModal";
import { Loader2, Download, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export default function VendorPayinPage() {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTx, setEditTx] = useState<any>(null);

  const fetchTransactions = useCallback(() => {
    fetch("/api/transactions?type=PAYIN")
      .then((res) => res.json())
      .then((data) => {
        const txs = data.transactions || (Array.isArray(data) ? data : []);
        setTransactions(txs);
      })
      .catch((err) => {
        console.error("Payin load error:", err);
        toast.error("Failed to load records");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleExport = () => {
    const headers = ["Date", "Description", "Reference", "Amount", "Status"];
    const rows = transactions.map((tx) => [
      new Date(tx.date).toLocaleDateString(),
      tx.description,
      tx.reference || "",
      tx.amount,
      tx.status,
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `my_payin_records_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export started");
  };

  const vendorId = (session?.user as any)?.vendorId;

  const handleSuccess = (newTx: any) => {
    if (editTx) {
      setTransactions((prev) => prev.map((tx) => (tx.id === newTx.id ? newTx : tx)));
    } else if (newTx.type === "PAYIN") {
      setTransactions((prev) => [newTx, ...prev]);
    }
    setEditTx(null);
  };

  const handleDelete = (txId: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== txId));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">My Pay-in Records</h1>
          <p className="text-[#86868b] mt-1">Listing all payments received and credit entries.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport} className="glass-button text-[#1d1d1f] border-black/5 h-11">
            <Download className="w-4 h-4 mr-2" /> Export to CSV
          </Button>
          <Button onClick={() => { setEditTx(null); setModalOpen(true); }} className="ios-blue-gradient border-0 h-11 rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Add Entry
          </Button>
        </div>
      </div>

      <div className="glass p-4 rounded-2xl border-black/5 flex items-center gap-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b] opacity-40" />
          <input placeholder="Search records..." className="glass-input h-10 pl-10 border-transparent focus:border-black/10 w-full" />
        </div>
        <div className="h-10 w-px bg-black/10" />
        <div>
          <p className="text-[10px] text-[#86868b] uppercase font-bold tracking-widest">Aggregate Pay-in</p>
          <p className="text-xl font-bold text-ios-green">
            ₹{transactions.reduce((sum, tx) => sum + tx.amount, 0).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[#86868b]">Fetching your ledger...</p>
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          showVendor={false}
          allowEdit={true}
          allowDelete={false}
          onEdit={(tx) => { setEditTx(tx); setModalOpen(true); }}
        />
      )}

      <TransactionFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditTx(null); }}
        onSuccess={handleSuccess}
        editData={editTx}
        defaultType="PAYIN"
        defaultVendorId={vendorId}
        lockVendor={true}
      />
    </div>
  );
}
