"use client";

import { useState, useEffect } from "react";
import FileUploadZone from "@/components/FileUploadZone";
import ParsePreviewTable from "@/components/ParsePreviewTable";
import { ParsedRow } from "@/lib/fileProcessor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

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
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("No file selected");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("vendorId", selectedVendor || "admin");
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
      toast.success(
        `File parsed successfully! ${data.parsedData.rows.length} rows detected.`
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

      toast.success(
        `Successfully imported ${data.count} transactions`
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
          Upload Financial Records
        </h1>
        <p className="text-[#86868b] mt-1">
          Upload PDF statement or Excel sheet to extract payment records.
        </p>
      </div>

      {!parsedData ? (
        <div className="space-y-6">
          <div className="glass-card p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-[#86868b] uppercase text-[10px] font-bold tracking-widest">
                  Select Account / Vendor
                </Label>
                <Select
                  onValueChange={(val) => setSelectedVendor(val || "admin")}
                  value={selectedVendor}
                >
                  <SelectTrigger className="glass-input h-12 border-black/5 text-[#1d1d1f]">
                    <SelectValue placeholder="Who does this file belong to?" />
                  </SelectTrigger>
                  <SelectContent className="glass-modal border-black/5 text-[#1d1d1f]">
                    <SelectItem
                      value="admin"
                      className="focus:bg-primary/10 focus:text-primary"
                    >
                      Admin (Own Records)
                    </SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem
                        key={vendor.id}
                        value={vendor.id}
                        className="focus:bg-primary/10 focus:text-primary"
                      >
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-[#86868b] uppercase text-[10px] font-bold tracking-widest">
                  Transaction Type
                </Label>
                <Select
                  onValueChange={(val) => setTxType(val || "AUTO")}
                  value={txType}
                >
                  <SelectTrigger className="glass-input h-12 border-black/5 text-[#1d1d1f]">
                    <SelectValue placeholder="Automatic Detection" />
                  </SelectTrigger>
                  <SelectContent className="glass-modal border-black/5 text-[#1d1d1f]">
                    <SelectItem
                      value="AUTO"
                      className="focus:bg-primary/10 focus:text-primary"
                    >
                      Automatic Detection
                    </SelectItem>
                    <SelectItem
                      value="PAYIN"
                      className="focus:bg-primary/10 focus:text-primary"
                    >
                      Force Pay-in (Credit)
                    </SelectItem>
                    <SelectItem
                      value="PAYOUT"
                      className="focus:bg-primary/10 focus:text-primary"
                    >
                      Force Payout (Debit)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <FileUploadZone
              onFileSelected={handleFileSet}
              onParseClick={handleUpload}
              showParseButton={true}
              isLoading={isUploading}
            />

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-[#424245] leading-relaxed">
                <strong className="text-[#1d1d1f]">Note:</strong> Make sure
                the file contains tabular data. The engine will automatically
                detect amounts, dates, and descriptions. You will be able to
                review all rows before saving.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-spring-entrance">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#1d1d1f]">
              Review Extracted Records
            </h2>
            <p className="text-xs text-[#86868b]">
              Please verify that all amounts and dates are correctly
              detected. Toggle types and exclude irrelevant rows.
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
