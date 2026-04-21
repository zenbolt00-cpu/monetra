"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  Play,
  CloudUpload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  onFileSelected: (file: File) => void;
  onParseClick?: () => void;
  isLoading?: boolean;
  showParseButton?: boolean;
}

export default function FileUploadZone({
  onFileSelected,
  onParseClick,
  isLoading,
  showParseButton = false,
}: FileUploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0];
        setFile(selectedFile);
        onFileSelected(selectedFile);
      }
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith(".pdf"))
      return <FileText className="w-6 h-6" />;
    return <FileSpreadsheet className="w-6 h-6" />;
  };

  const getFileTypeLabel = (name: string) => {
    const ext = name.split(".").pop()?.toUpperCase();
    return ext || "Document";
  };

  const getFileTypeColor = (name: string) => {
    if (name.endsWith(".pdf")) return "from-red-500/20 to-red-500/5 text-red-600";
    if (name.endsWith(".xlsx") || name.endsWith(".xls"))
      return "from-green-500/20 to-green-500/5 text-green-600";
    return "from-blue-500/20 to-blue-500/5 text-blue-600";
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            {...(getRootProps() as any)}
            className={cn(
              "relative h-56 border-2 border-dashed rounded-2xl transition-all duration-400 flex flex-col items-center justify-center cursor-pointer group overflow-hidden",
              isDragActive
                ? "border-primary bg-primary/[0.04] scale-[1.01]"
                : "border-black/[0.06] hover:border-primary/30 hover:bg-primary/[0.02]"
            )}
          >
            <input {...getInputProps()} />

            {/* Background gradient effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/[0.02] pointer-events-none" />

            <div className={cn(
              "p-4 rounded-2xl mb-4 transition-all duration-500",
              isDragActive
                ? "bg-primary/10 scale-110"
                : "bg-black/[0.03] group-hover:bg-primary/[0.06] group-hover:scale-105"
            )}>
              <CloudUpload
                className={cn(
                  "w-8 h-8 transition-all duration-300",
                  isDragActive
                    ? "text-primary"
                    : "text-[#86868b] opacity-50 group-hover:text-primary group-hover:opacity-80"
                )}
              />
            </div>

            <div className="text-center relative z-10">
              <p className="text-base font-semibold text-[#1d1d1f] tracking-tight">
                {isDragActive ? "Release to upload" : "Drop a file here, or click to browse"}
              </p>
              <p className="text-[#86868b] text-xs mt-1.5 tracking-tight">
                PDF · XLSX · XLS · CSV — up to 50 MB
              </p>
            </div>

            {isDragActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-primary/[0.03] rounded-2xl flex items-center justify-center"
              >
                <div className="absolute inset-2 border-2 border-primary/20 border-dashed rounded-xl" />
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="file-preview"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass p-6 rounded-2xl border-black/5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-sm",
                  getFileTypeColor(file.name)
                )}>
                  {getFileIcon(file.name)}
                </div>
                <div>
                  <p className="font-semibold text-[#1d1d1f] max-w-[300px] truncate tracking-tight">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#86868b]">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                    <span className="w-1 h-1 rounded-full bg-[#86868b]/30" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] glass-pill px-2 py-0.5">
                      {getFileTypeLabel(file.name)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isLoading ? (
                  <div className="flex items-center gap-2.5 px-5 py-2.5 glass rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs font-semibold text-[#1d1d1f]">
                      Extracting records...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-ios-green">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Ready
                      </span>
                    </div>

                    {showParseButton && onParseClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onParseClick();
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 ios-blue-gradient text-white rounded-xl font-semibold text-sm tracking-tight"
                      >
                        <Play className="w-4 h-4" />
                        Extract Data
                      </button>
                    )}

                    <button
                      onClick={removeFile}
                      className="p-2.5 rounded-xl glass hover:bg-ios-red/10 hover:text-ios-red transition-all text-[#86868b]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Processing indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 pt-4 border-t border-black/[0.04]"
              >
                <div className="w-full h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 8, ease: "linear" }}
                  />
                </div>
                <p className="text-[10px] text-[#86868b] mt-2">
                  Scanning document structure, extracting UTR references, amounts, and dates...
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
