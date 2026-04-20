"use client";

import React, { useEffect, useState, useCallback } from "react";
import TransactionTable from "@/components/TransactionTable";
import TransactionFormModal from "@/components/TransactionFormModal";
import { Loader2, Download, Filter, Wallet, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export default function AdminMyPayoutPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTx, setEditTx] = useState<any>(null);

  const fetchTransactions = useCallback(() => {
    fetch("/api/transactions?vendorId=admin&type=PAYOUT")
      .then((res) => res.json())
      .then((data) => {
        const txs = data.transactions || (Array.isArray(data) ? data : []);
        setTransactions(txs);
      })
      .catch(() => toast.error("Failed to load records"))
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
    link.setAttribute("download", `admin_payout_records_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export started");
  };

  const handleSuccess = (newTx: any) => {
    if (editTx) {
      setTransactions((prev) => prev.map((tx) => (tx.id === newTx.id ? newTx : tx)));
    } else if (newTx.type === "PAYOUT") {
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
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f] flex items-center gap-3">
            <Wallet className="w-8 h-8 text-ios-red" /> Admin Payout
          </h1>
          <p className="text-[#86868b] mt-1">Managing administrator&apos;s direct outgoing payment records.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport} className="glass-button text-[#1d1d1f] border-black/5 h-11">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => { setEditTx(null); setModalOpen(true); }} className="ios-blue-gradient border-0 h-11 rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Add Entry
          </Button>
        </div>
      </div>

      <div className="glass p-1 rounded-2xl border-black/5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-3 px-4 py-2 border-r border-black/5">
          <Filter className="w-4 h-4 text-ios-red" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#86868b]">Summary</span>
        </div>
        <div className="px-4 py-2">
          <p className="text-[10px] text-[#86868b] uppercase font-bold tracking-widest leading-tight">Total Self Payout</p>
          <p className="text-sm font-bold text-ios-red">
            ₹{transactions.reduce((sum, tx) => sum + tx.amount, 0).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="ml-auto w-px h-6 bg-black/5 mx-2" />
        <div className="px-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ios-red" />
          <span className="text-xs font-semibold text-[#1d1d1f]">{transactions.length} Transactions</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[#86868b]">Loading admin records...</p>
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          showVendor={false}
          allowEdit={true}
          allowDelete={true}
          onEdit={(tx) => { setEditTx(tx); setModalOpen(true); }}
          onDelete={handleDelete}
        />
      )}

      <TransactionFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditTx(null); }}
        onSuccess={handleSuccess}
        editData={editTx}
        defaultType="PAYOUT"
        defaultVendorId={null}
        lockVendor={true}
      />
    </div>
  );
}
