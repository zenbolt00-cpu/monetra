"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import FileUploadZone from "@/components/FileUploadZone";
import ParsePreviewTable from "@/components/ParsePreviewTable";
import { ParsedRow } from "@/lib/fileProcessor";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VendorUploadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [txType, setTxType] = useState<string>("AUTO");
  const [parsedData, setParsedData] = useState<{
    rows: ParsedRow[];
    file: any;
  } | null>(null);

  const handleFileSet = (file: File) => {
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    const vendorId = (session?.user as any)?.vendorId;
    if (!vendorId) {
      toast.error("Account error: Vendor ID missing");
      return;
    }
    if (!selectedFile) {
      toast.error("No file selected");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("vendorId", vendorId);
    formData.append("txType", txType);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Upload failed");

      setParsedData({
        rows: data.parsedData.rows,
        file: data.file,
      });
      toast.success("Record extracted successfully!");
    } catch (error: any) {
      toast.error(error.message || "Extraction failed");
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

      toast.success(`Successfully uploaded ${data.count} records`);
      router.push("/vendor/payin");
    } catch (error: any) {
      toast.error(error.message || "Failed to finalize upload");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
          Upload Documents
        </h1>
        <p className="text-[#86868b] mt-1">
          Upload your payment records to sync with the main ledger.
        </p>
      </div>

      {!parsedData ? (
        <div className="space-y-6 animate-spring-entrance">
          <div className="glass-card p-8 space-y-6">
            <div className="space-y-3">
              <label className="text-[#86868b] uppercase text-[10px] font-bold tracking-widest">
                Transaction Type
              </label>
              <div className="flex p-1 bg-black/5 rounded-2xl border border-black/5 max-w-md">
                {["AUTO", "PAYIN", "PAYOUT"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTxType(type)}
                    className={cn(
                      "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
                      txType === type
                        ? "bg-white text-primary shadow-sm"
                        : "text-[#86868b] hover:text-[#424245]"
                    )}
                  >
                    {type === "AUTO"
                      ? "Detect"
                      : type === "PAYIN"
                        ? "Pay-in"
                        : "Payout"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <Info className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm text-[#424245] leading-relaxed font-medium">
                Records will be automatically extracted from your PDF
                statements or Excel files. They will be marked as{" "}
                <span className="text-primary font-bold">PENDING</span> until
                verified by Admin.
              </p>
            </div>

            <FileUploadZone
              onFileSelected={handleFileSet}
              onParseClick={handleUpload}
              showParseButton={true}
              isLoading={isUploading}
            />

            <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass p-4 rounded-xl border-black/5">
                <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] mb-2">
                  Supported Files
                </h4>
                <p className="text-xs text-[#424245]">
                  Bank Statements (PDF), Ledger Sheets (XLSX), CSV Exports.
                </p>
              </div>
              <div className="glass p-4 rounded-xl border-black/5">
                <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#86868b] mb-2">
                  Faithful Capture
                </h4>
                <p className="text-xs text-[#424245]">
                  Colors and row structures are preserved exactly from your
                  source.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-spring-entrance">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-[#1d1d1f]">
              Review Extracted Records
            </h2>
            <p className="text-xs text-[#86868b]">
              Please verify that all amounts and dates are correctly detected.
            </p>
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
