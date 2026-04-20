"use client";

import { useState, useEffect } from "react";
import GlassModal from "./GlassModal";
import { Loader2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

interface TransactionFormData {
  id?: string;
  type: "PAYIN" | "PAYOUT";
  date: string;
  amount: string;
  description: string;
  reference: string;
  balance: string;
  vendorId: string;
}

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transaction: any) => void;
  editData?: any; // existing transaction to edit
  defaultType?: "PAYIN" | "PAYOUT";
  defaultVendorId?: string | null;
  lockVendor?: boolean;
  showVendorSelect?: boolean;
  vendors?: { id: string; name: string }[];
}

export default function TransactionFormModal({
  isOpen,
  onClose,
  onSuccess,
  editData,
  defaultType = "PAYIN",
  defaultVendorId,
  lockVendor = false,
  showVendorSelect = false,
  vendors = [],
}: TransactionFormModalProps) {
  const [form, setForm] = useState<TransactionFormData>({
    type: defaultType,
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    description: "",
    reference: "",
    balance: "",
    vendorId: defaultVendorId || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when opened or when editData changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (editData) {
        setForm({
          id: editData.id,
          type: editData.type,
          date: new Date(editData.date).toISOString().slice(0, 10),
          amount: String(editData.amount),
          description: editData.description || "",
          reference: editData.reference || "",
          balance: editData.balance ? String(editData.balance) : "",
          vendorId: editData.vendorId || defaultVendorId || "",
        });
      } else {
        setForm({
          type: defaultType,
          date: new Date().toISOString().slice(0, 10),
          amount: "",
          description: "",
          reference: "",
          balance: "",
          vendorId: defaultVendorId || "",
        });
      }
    }
  }, [isOpen, editData, defaultType, defaultVendorId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!form.type || !form.date || !form.amount) {
      setError("Type, date, and amount are required.");
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Amount must be a valid positive number.");
      return;
    }

    setIsSubmitting(true);

    const payload: any = {
      type: form.type,
      date: form.date,
      amount,
      description: form.description || "No description",
      reference: form.reference || null,
      balance: form.balance ? parseFloat(form.balance) : null,
      vendorId: form.vendorId === "admin" || !form.vendorId ? null : form.vendorId,
      status: "CONFIRMED",
    };

    try {
      let res: Response;
      if (editData?.id) {
        // Edit mode
        res = await fetch(`/api/transactions/${editData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create mode
        res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save transaction");
      }

      toast.success(
        editData ? "Entry updated successfully" : "Entry created successfully"
      );
      onSuccess(data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={editData ? "Edit Entry" : "Add Entry"}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type Toggle */}
        <div>
          <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-2">
            Transaction Type *
          </label>
          <div className="flex p-1 bg-black/5 rounded-2xl border border-black/5">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, type: "PAYIN" }))}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                form.type === "PAYIN"
                  ? "bg-white text-[#007AFF] shadow-sm"
                  : "text-[#86868b] hover:text-[#424245]"
              )}
            >
              <ArrowDownCircle className="w-4 h-4" />
              Pay-in
            </button>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, type: "PAYOUT" }))}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                form.type === "PAYOUT"
                  ? "bg-white text-[#FF3B30] shadow-sm"
                  : "text-[#86868b] hover:text-[#424245]"
              )}
            >
              <ArrowUpCircle className="w-4 h-4" />
              Payout
            </button>
          </div>
        </div>

        {/* Date + Amount */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-2">
              Date *
            </label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="glass-input w-full px-4 py-3 text-sm text-[#1d1d1f]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-2">
              Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b] font-bold text-sm">
                ₹
              </span>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                placeholder="0.00"
                className="glass-input w-full pl-8 pr-4 py-3 text-sm text-[#1d1d1f]"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-2">
            Description
          </label>
          <input
            type="text"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Enter description..."
            className="glass-input w-full px-4 py-3 text-sm text-[#1d1d1f]"
          />
        </div>

        {/* Reference */}
        <div>
          <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-2">
            Reference
          </label>
          <input
            type="text"
            name="reference"
            value={form.reference}
            onChange={handleChange}
            placeholder="UTR / Cheque No / Ref ID..."
            className="glass-input w-full px-4 py-3 text-sm text-[#1d1d1f]"
          />
        </div>

        {/* Balance */}
        <div>
          <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-2">
            Balance (optional)
          </label>
          <input
            type="number"
            name="balance"
            value={form.balance}
            onChange={handleChange}
            step="0.01"
            placeholder="Closing balance..."
            className="glass-input w-full px-4 py-3 text-sm text-[#1d1d1f]"
          />
        </div>

        {/* Vendor Selector (admin pages only) */}
        {showVendorSelect && (
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-2">
              Vendor
            </label>
            <select
              name="vendorId"
              value={form.vendorId}
              onChange={handleChange}
              disabled={lockVendor}
              className="glass-input w-full px-4 py-3 text-sm text-[#1d1d1f] appearance-none"
            >
              <option value="">Admin (own records)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20">
            <p className="text-xs text-[#FF3B30] font-medium">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full py-3.5 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2",
            form.type === "PAYIN"
              ? "ios-blue-gradient hover:opacity-90"
              : "bg-gradient-to-b from-[#FF3B30] to-[#CC2E26] hover:opacity-90",
            isSubmitting && "opacity-50 cursor-not-allowed"
          )}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>Save Entry</>
          )}
        </button>
      </form>
    </GlassModal>
  );
}
