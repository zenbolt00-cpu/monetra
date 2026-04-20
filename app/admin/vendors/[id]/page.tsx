"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MetricCard from "@/components/MetricCard";
import LineChart from "@/components/Charts/LineChart";
import TransactionTable from "@/components/TransactionTable";
import TransactionFormModal from "@/components/TransactionFormModal";
import GlassModal from "@/components/GlassModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Building2,
  CreditCard,
  Edit,
  ArrowLeft,
  Upload,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function VendorDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [vendor, setVendor] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editTx, setEditTx] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/vendors/${id}`).then((res) => res.json()),
      fetch(`/api/transactions?vendorId=${id}`).then((res) => res.json()),
    ])
      .then(([vendorData, txData]) => {
        setVendor(vendorData);
        const txs = txData.transactions || (Array.isArray(txData) ? txData : []);
        setTransactions(txs);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load vendor data");
        setLoading(false);
      });
  }, [id]);

  const handleEditVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/vendors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setVendor({ ...vendor, ...data.vendor });
      setEditModalOpen(false);
      toast.success("Vendor updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    }
  };

  const handleTxSuccess = (newTx: any) => {
    if (editTx) {
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === newTx.id ? newTx : tx))
      );
    } else {
      setTransactions((prev) => [newTx, ...prev]);
    }
    setEditTx(null);
  };

  const handleDelete = (txId: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== txId));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-[#86868b]">Securing vendor data...</p>
      </div>
    );
  }

  if (!vendor || vendor.error) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 text-center">
        <p className="text-xl font-bold text-[#1d1d1f]">Vendor not found</p>
        <Link href="/admin/vendors">
          <Button className="glass-button">Go Back</Button>
        </Link>
      </div>
    );
  }

  const payinTransactions = transactions.filter((tx) => tx.type === "PAYIN");
  const payoutTransactions = transactions.filter((tx) => tx.type === "PAYOUT");

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/admin/vendors">
          <Button
            variant="ghost"
            size="icon"
            className="glass rounded-full hover:bg-black/5"
          >
            <ArrowLeft className="w-5 h-5 text-[#1d1d1f]" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
            {vendor.name}
          </h1>
          <p className="text-[#86868b] mt-1">
            Detailed financial performance and profile management.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href={`/admin/upload?vendor=${id}`}>
            <Button className="glass-button text-[#1d1d1f] border-black/5">
              <Upload className="w-4 h-4 mr-2" /> Upload File
            </Button>
          </Link>
          <Button
            className="glass-button text-[#1d1d1f] border-black/5"
            onClick={() => {
              setEditForm({
                name: vendor.name || "",
                email: vendor.email || "",
                phone: vendor.phone || "",
                address: vendor.address || "",
                gstin: vendor.gstin || "",
                bankName: vendor.bankName || "",
                accountNumber: vendor.accountNumber || "",
                ifsc: vendor.ifsc || "",
              });
              setEditModalOpen(true);
            }}
          >
            <Edit className="w-4 h-4 mr-2" /> Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 space-y-6">
            <div className="flex items-center gap-4 border-b border-black/5 pb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="font-bold text-[#1d1d1f] text-xl">
                  Profile Details
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ios-green/20 text-ios-green text-[10px] uppercase font-bold border border-ios-green/20 mt-1">
                  Active Vendor
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#86868b] mt-1" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#86868b]">
                    Email
                  </p>
                  <p className="text-sm text-[#1d1d1f]">{vendor.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#86868b] mt-1" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#86868b]">
                    Phone
                  </p>
                  <p className="text-sm text-[#1d1d1f]">
                    {vendor.phone || "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#86868b] mt-1" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#86868b]">
                    Address
                  </p>
                  <p className="text-sm text-[#1d1d1f]">
                    {vendor.address || "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#86868b] mt-1" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#86868b]">
                    GSTIN
                  </p>
                  <p className="text-sm font-mono text-[#424245]">
                    {vendor.gstin || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-black/5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#86868b]">
                Banking Information
              </h3>
              <div className="flex items-start gap-3">
                <CreditCard className="w-4 h-4 text-[#86868b] mt-1" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#86868b]">
                    Bank &amp; A/C
                  </p>
                  <p className="text-sm text-[#1d1d1f]">
                    {vendor.bankName || "Unknown"}
                  </p>
                  <p className="text-[11px] text-[#86868b] font-mono mt-0.5">
                    {vendor.accountNumber || "XXXX-XXXX-XXXX"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              label="Total Pay-in"
              value={vendor.stats?.payin || 0}
              color="green"
            />
            <MetricCard
              label="Total Payout"
              value={vendor.stats?.payout || 0}
              color="red"
            />
          </div>

          <Tabs defaultValue="payin" className="w-full">
            <TabsList className="glass border-black/5 p-1 rounded-2xl h-12 w-full max-w-md">
              <TabsTrigger
                value="payin"
                className="rounded-xl data-[state=active]:bg-ios-green data-[state=active]:text-white flex-1 transition-all"
              >
                Pay-in Records ({payinTransactions.length})
              </TabsTrigger>
              <TabsTrigger
                value="payout"
                className="rounded-xl data-[state=active]:bg-ios-red data-[state=active]:text-white flex-1 transition-all"
              >
                Payout Records ({payoutTransactions.length})
              </TabsTrigger>
            </TabsList>
            <div className="mt-6">
              <TabsContent value="payin">
                <TransactionTable
                  transactions={payinTransactions}
                  allowEdit
                  allowDelete
                  onEdit={(tx) => {
                    setEditTx(tx);
                    setTxModalOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              </TabsContent>
              <TabsContent value="payout">
                <TransactionTable
                  transactions={payoutTransactions}
                  allowEdit
                  allowDelete
                  onEdit={(tx) => {
                    setEditTx(tx);
                    setTxModalOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Edit Vendor Profile Modal */}
      <GlassModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Vendor Profile"
      >
        <form onSubmit={handleEditVendor} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={editForm.name || ""}
                onChange={(e) =>
                  setEditForm((p: any) => ({ ...p, name: e.target.value }))
                }
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                Phone
              </label>
              <input
                type="text"
                value={editForm.phone || ""}
                onChange={(e) =>
                  setEditForm((p: any) => ({ ...p, phone: e.target.value }))
                }
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
              Address
            </label>
            <input
              type="text"
              value={editForm.address || ""}
              onChange={(e) =>
                setEditForm((p: any) => ({ ...p, address: e.target.value }))
              }
              className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                Bank Name
              </label>
              <input
                type="text"
                value={editForm.bankName || ""}
                onChange={(e) =>
                  setEditForm((p: any) => ({
                    ...p,
                    bankName: e.target.value,
                  }))
                }
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                Account Number
              </label>
              <input
                type="text"
                value={editForm.accountNumber || ""}
                onChange={(e) =>
                  setEditForm((p: any) => ({
                    ...p,
                    accountNumber: e.target.value,
                  }))
                }
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 ios-blue-gradient text-white rounded-2xl font-bold hover:opacity-90 transition-opacity"
          >
            Save Changes
          </button>
        </form>
      </GlassModal>

      {/* Transaction Edit Modal */}
      <TransactionFormModal
        isOpen={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setEditTx(null);
        }}
        onSuccess={handleTxSuccess}
        editData={editTx}
        defaultVendorId={id as string}
        lockVendor={true}
      />
    </div>
  );
}
