"use client";

import { useEffect, useState } from "react";
import VendorCard from "@/components/VendorCard";
import GlassModal from "@/components/GlassModal";
import {
  Loader2,
  Plus,
  Search,
  Building2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{
    email: string;
    password: string;
    vendorName: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    gstin: "",
    bankName: "",
    accountNumber: "",
    ifsc: "",
    password: "",
  });

  useEffect(() => {
    fetch("/api/vendors")
      .then((res) => res.json())
      .then((data) => {
        setVendors(Array.isArray(data) ? data : []);
      })
      .catch(() => toast.error("Failed to load vendors"))
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      address: "",
      gstin: "",
      bankName: "",
      accountNumber: "",
      ifsc: "",
      password: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);

      setVendors((prev) => [...prev, data.vendor]);
      setModalOpen(false);
      resetForm();

      // Show credentials modal
      setCredentialsModal({
        email: data.user.email,
        password: data.user.tempPassword,
        vendorName: data.vendor.name,
      });

      toast.success("Vendor created successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create vendor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filtered = vendors.filter(
    (v) =>
      v.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
            Vendor Management
          </h1>
          <p className="text-[#86868b] mt-1">
            Manage accounts and access for all vendors.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="ios-blue-gradient border-0 h-12 px-6 rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Vendor
        </Button>
      </div>

      <div className="glass p-4 rounded-2xl border-black/5 flex items-center gap-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b] opacity-40" />
          <input
            placeholder="Search vendors..."
            className="glass-input h-10 pl-10 border-transparent focus:border-black/10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="h-10 w-px bg-black/10" />
        <div>
          <p className="text-[10px] text-[#86868b] uppercase font-bold tracking-widest">
            Total Vendors
          </p>
          <p className="text-xl font-bold text-[#1d1d1f]">
            {vendors.length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[#86868b]">Loading vendor profiles...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Building2 className="w-12 h-12 text-[#86868b] mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-bold text-[#1d1d1f] mb-2">
            {search ? "No matching vendors" : "No vendors added yet"}
          </h3>
          <p className="text-sm text-[#86868b]">
            {search
              ? "Try a different search term"
              : "Click \"Add Vendor\" to create your first vendor account"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((vendor) => (
            <Link
              key={vendor.id}
              href={`/admin/vendors/${vendor.id}`}
            >
              <VendorCard vendor={vendor} />
            </Link>
          ))}
        </div>
      )}

      {/* Add Vendor Modal */}
      <GlassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Vendor"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                required
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
                placeholder="Business name"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                required
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
                placeholder="vendor@company.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
                placeholder="+91-XXXXXXXXXX"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                GSTIN
              </label>
              <input
                type="text"
                value={form.gstin}
                onChange={(e) =>
                  setForm((p) => ({ ...p, gstin: e.target.value }))
                }
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
                placeholder="22AAABB1234C1Z5"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
              Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) =>
                setForm((p) => ({ ...p, address: e.target.value }))
              }
              className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
              placeholder="Full address..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                Bank
              </label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, bankName: e.target.value }))
                }
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
                placeholder="SBI / HDFC..."
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                A/C Number
              </label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    accountNumber: e.target.value,
                  }))
                }
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
                placeholder="XXXXXXXXXXXX"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
                IFSC
              </label>
              <input
                type="text"
                value={form.ifsc}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ifsc: e.target.value }))
                }
                className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
                placeholder="SBIN0001234"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] block mb-1.5">
              Login Password (default: Vendor@123)
            </label>
            <input
              type="text"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              className="glass-input w-full px-3 py-2.5 text-sm text-[#1d1d1f]"
              placeholder="Leave blank for default"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 ios-blue-gradient text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" /> Create Vendor
              </>
            )}
          </button>
        </form>
      </GlassModal>

      {/* Credentials Display Modal */}
      <GlassModal
        isOpen={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="Vendor Created — Login Credentials"
        maxWidth="420px"
      >
        {credentialsModal && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-ios-green/10 border border-ios-green/20 text-center">
              <p className="text-sm font-bold text-ios-green">
                ✓ {credentialsModal.vendorName} has been created
              </p>
            </div>

            <div className="space-y-3">
              <div className="glass p-4 rounded-xl border-black/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#86868b]">
                    Email
                  </p>
                  <p className="text-sm font-mono text-[#1d1d1f]">
                    {credentialsModal.email}
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleCopy(credentialsModal.email, "email")
                  }
                  className="p-2 rounded-lg glass hover:bg-primary/10 transition-colors"
                >
                  {copiedField === "email" ? (
                    <Check className="w-4 h-4 text-ios-green" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#86868b]" />
                  )}
                </button>
              </div>

              <div className="glass p-4 rounded-xl border-black/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#86868b]">
                    Password
                  </p>
                  <p className="text-sm font-mono text-[#1d1d1f]">
                    {credentialsModal.password}
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleCopy(credentialsModal.password, "password")
                  }
                  className="p-2 rounded-lg glass hover:bg-primary/10 transition-colors"
                >
                  {copiedField === "password" ? (
                    <Check className="w-4 h-4 text-ios-green" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#86868b]" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-[#86868b] text-center">
              Share these credentials securely with the vendor. They can
              use this to log in and upload records.
            </p>

            <button
              onClick={() => setCredentialsModal(null)}
              className="w-full py-3 glass-button rounded-2xl font-bold text-[#1d1d1f] hover:bg-black/10 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </GlassModal>
    </div>
  );
}
