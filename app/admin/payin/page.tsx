"use client";

import { useEffect, useState, useCallback } from "react";
import TransactionTable from "@/components/TransactionTable";
import TransactionFormModal from "@/components/TransactionFormModal";
import { Loader2, Download, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export default function AdminPayinPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);
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
    // Fetch vendors for the form
    fetch("/api/vendors")
      .then((res) => res.json())
      .then((data) => setVendors(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [fetchTransactions]);

  const handleExport = () => {
    const headers = [
      "Date",
      "Vendor",
      "Description",
      "Reference",
      "Amount",
      "Status",
    ];
    const rows = transactions.map((tx) => [
      new Date(tx.date).toLocaleDateString(),
      tx.vendor?.name || "Admin",
      tx.description,
      tx.reference || "",
      tx.amount,
      tx.status,
    ]);

    const csvContent = [headers, ...rows]
      .map((e) => e.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payin_records_${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export started");
  };

  const handleSuccess = (newTx: any) => {
    if (editTx) {
      // Update in place
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === newTx.id ? newTx : tx))
      );
    } else {
      // Add to top
      if (newTx.type === "PAYIN") {
        setTransactions((prev) => [newTx, ...prev]);
      }
    }
    setEditTx(null);
  };

  const handleDelete = (txId: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== txId));
  };

  const handleEdit = (tx: any) => {
    setEditTx(tx);
    setModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f] line-clamp-1">
            Vendor Pay-in
          </h1>
          <p className="text-[#86868b] mt-1">
            Listing all incoming payments and credit records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleExport}
            className="glass-button text-[#1d1d1f] border-black/5 h-11"
          >
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button
            onClick={() => {
              setEditTx(null);
              setModalOpen(true);
            }}
            className="ios-blue-gradient border-0 h-11 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      <div className="glass p-1 rounded-2xl border-black/5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-3 px-4 py-2 border-r border-black/10">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#86868b]">
            Filters
          </span>
        </div>

        <div className="ml-auto w-px h-6 bg-black/10 mx-2" />

        <div className="px-4">
          <p className="text-[10px] text-[#86868b] uppercase font-bold tracking-widest">
            Total Pay-in Volume
          </p>
          <p className="text-sm font-bold text-ios-green">
            ₹
            {transactions
              .reduce((sum, tx) => sum + tx.amount, 0)
              .toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[#86868b]">Fetching transaction ledger...</p>
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          showVendor={true}
          allowEdit={true}
          allowDelete={true}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <TransactionFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTx(null);
        }}
        onSuccess={handleSuccess}
        editData={editTx}
        defaultType="PAYIN"
        showVendorSelect={true}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
      />
    </div>
  );
}
