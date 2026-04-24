"use client";

import { useState, useEffect } from "react";
import FileUploadZone from "@/components/FileUploadZone";
import ParsePreviewTable from "@/components/ParsePreviewTable";
import type { ParsedRow } from "@/lib/fileProcessor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  Info,
  Shield,
  Zap,
  FileSearch,
  ArrowRight,
  Sparkles,
  Building2,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminUploadPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>("admin");
  const [txType, setTxType] = useState<string>("AUTO");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [parsedData, setParsedData] = useState<{
    rows: ParsedRow[];
    file: any;
  } | null>(null);

  useEffect(() => {
    fetch("/api/vendors")
      .then((res) => res.json())
      .then((data) => setVendors(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleFileSet = (file: File) => {
    setSelectedFile(file);
    // Auto-trigger upload
    setTimeout(() => handleUpload(file), 100);
  };

  const handleUpload = async (fileToUpload?: File) => {
    const targetFile = fileToUpload || selectedFile;
    if (!targetFile) {
      toast.error("No file selected");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", targetFile);
    formData.append("vendorId", selectedVendor || "admin");
    formData.append("txType", txType);

    try {
      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("[UPLOAD] Non-JSON response:", text);
        throw new Error(`Server error (${res.status}). The service might be temporarily unavailable or hit a limit.`);
      }

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Upload failed");

      setParsedData({
        rows: data.transactions,
        file: { fileName: data.filename, ...data.file },
      });
      toast.success(
        `${data.transactions.length} transactions extracted from ${data.filename}`
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirm = async (confirmedRows: ParsedRow[]) => {
    if (!parsedData) return;

    setIsConfirming(true);
    try {
      const res = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: parsedData.file,
          transactions: confirmedRows,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Import failed");

      const skippedMsg = data.skipped > 0 ? ` (${data.skipped} duplicates merged)` : "";
      toast.success(
        `${data.count} transactions imported to ledger${skippedMsg}`
      );
      router.push(
        selectedVendor === "admin" ? "/admin/my-payin" : "/admin/payin"
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to confirm import");
    } finally {
      setIsConfirming(false);
    }
  };

  const selectedVendorName =
    selectedVendor === "admin"
      ? "Admin (Own Records)"
      : vendors.find((v) => v.id === selectedVendor)?.name || "Select...";

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
          File Ingestion
        </h1>
        <p className="text-[#86868b] text-sm">
          Upload bank statements or spreadsheets to sync with your ledgers.
        </p>
      </div>

      {!parsedData ? (
        <div className="space-y-6 animate-spring-entrance">
          {/* Configuration Card */}
          <div className="glass-card p-8 space-y-8">
            {/* Account Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="caption-text flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Account / Vendor
                </label>
                <Select
                  onValueChange={(val) => setSelectedVendor(val)}
                  value={selectedVendor}
                >
                  <SelectTrigger className="glass-input h-12 border-black/5 text-[#1d1d1f] w-full">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent className="glass-modal border-white/60 z-[100]">
                    <SelectItem
                      value="admin"
                      className="focus:bg-primary/10 focus:text-primary rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-4 h-4 text-primary" />
                        Admin (Own Records)
                      </div>
                    </SelectItem>
                    {vendors.length > 0 && (
                      <>
                        {vendors.map((vendor) => (
                          <SelectItem
                            key={vendor.id}
                            value={vendor.id}
                            className="focus:bg-primary/10 focus:text-primary rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-[#86868b]" />
                              {vendor.name}
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#86868b]">
                  {selectedVendor === "admin"
                    ? "Records will be saved under your admin account."
                    : `Records will be linked to ${selectedVendorName}.`}
                </p>
              </div>

              {/* Transaction Type */}
              <div className="space-y-3">
                <label className="caption-text flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Transaction Classification
                </label>
                <div className="flex p-1.5 bg-black/[0.03] rounded-2xl border border-black/[0.04]">
                  {[
                    { value: "AUTO", label: "Auto-Detect", icon: Sparkles },
                    { value: "PAYIN", label: "Pay-in", icon: ArrowRight },
                    { value: "PAYOUT", label: "Payout", icon: ArrowRight },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTxType(value)}
                      className={cn(
                        "flex-1 py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5",
                        txType === value
                          ? "bg-white text-primary shadow-sm border border-white/80"
                          : "text-[#86868b] hover:text-[#424245]"
                      )}
                    >
                      <Icon className={cn("w-3 h-3", value === "PAYOUT" && txType === value && "rotate-180")} />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#86868b]">
                  Auto-detect analyzes each row to determine pay-in or payout.
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent" />

            {/* File Upload Zone */}
            <FileUploadZone
              onFileSelected={handleFileSet}
              onParseClick={handleUpload}
              showParseButton={true}
              isLoading={isUploading}
            />
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5 flex items-start gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-ios-blue/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FileSearch className="w-5 h-5 text-ios-blue" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1d1d1f] mb-1">
                  Smart Extraction
                </h4>
                <p className="text-[11px] text-[#86868b] leading-relaxed">
                  Automatically detects UTR, reference numbers, amounts, dates, and transaction modes from any format.
                </p>
              </div>
            </div>
            <div className="glass-card p-5 flex items-start gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-ios-green/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Shield className="w-5 h-5 text-ios-green" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1d1d1f] mb-1">
                  Duplicate Detection
                </h4>
                <p className="text-[11px] text-[#86868b] leading-relaxed">
                  Cross-references every UTR against the database to flag duplicate entries before import.
                </p>
              </div>
            </div>
            <div className="glass-card p-5 flex items-start gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-ios-yellow/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5 text-ios-yellow" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1d1d1f] mb-1">
                  Color Preservation
                </h4>
                <p className="text-[11px] text-[#86868b] leading-relaxed">
                  Preserves cell colors and row structures from your original Excel sheets faithfully.
                </p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="flex items-start gap-3 p-5 rounded-2xl bg-primary/[0.04] border border-primary/[0.08]">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-[#424245] leading-relaxed">
              <strong className="text-[#1d1d1f]">Supported formats:</strong>{" "}
              PDF bank statements, XLSX/XLS spreadsheets, and CSV exports.
              The engine supports all major Indian banks (SBI, HDFC, ICICI, Axis, Kotak, etc.)
              and UPI/NEFT/RTGS/IMPS transaction references.
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-spring-entrance">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-ios-green/10 flex items-center justify-center">
              <FileSearch className="w-4 h-4 text-ios-green" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1d1d1f]">
                Review Extracted Records
              </h2>
              <p className="text-xs text-[#86868b]">
                Verify amounts, dates, references and types. Toggle or exclude rows before importing.
              </p>
            </div>
            {(parsedData as any).csvContent && (
              <button
                onClick={() => {
                  const blob = new Blob([(parsedData as any).csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `extracted_${(parsedData as any).file.fileName || 'data'}.csv`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success("CSV file downloaded");
                }}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-ios-blue text-white text-xs font-bold rounded-xl hover:bg-ios-blue/90 transition-colors shadow-sm"
              >
                <ArrowRight className="w-3 h-3 rotate-90" />
                Download CSV
              </button>
            )}
          </div>
          <ParsePreviewTable
            rows={parsedData.rows}
            onConfirm={handleConfirm}
            onCancel={() => {
              setParsedData(null);
              setSelectedFile(null);
            }}
            isConfirming={isConfirming}
          />
        </div>
      )}
    </div>
  );
}
