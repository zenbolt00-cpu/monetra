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
    if (name.endsWith(".pdf")) return <FileText className="w-6 h-6" />;
    return <FileSpreadsheet className="w-6 h-6" />;
  };

  const getFileTypeLabel = (name: string) => {
    const ext = name.split(".").pop()?.toUpperCase();
    return ext || "Document";
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
            {...(getRootProps() as any)}
            className={cn(
              "relative h-64 border-2 border-dashed rounded-card transition-all duration-300 flex flex-col items-center justify-center cursor-pointer group",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-black/5 glass hover:border-black/10 hover:bg-black/5"
            )}
          >
            <input {...getInputProps()} />
            <div className="p-4 rounded-full glass mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-[#86868b] opacity-40 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#1d1d1f]">
                Click or drag file to upload
              </p>
              <p className="text-[#86868b] text-sm mt-1">
                Supports PDF, XLSX, XLS, and CSV (max 50MB)
              </p>
            </div>
            {isDragActive && (
              <div className="absolute inset-0 bg-primary/5 rounded-card flex items-center justify-center backdrop-blur-sm">
                <p className="text-primary font-bold text-xl">
                  Drop the file here
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="file-preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-6 rounded-card border-black/5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  {getFileIcon(file.name)}
                </div>
                <div>
                  <p className="font-bold text-[#1d1d1f] max-w-[300px] truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#86868b]">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB •{" "}
                    {getFileTypeLabel(file.name)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isLoading ? (
                  <div className="flex items-center gap-2 px-4 py-2 glass rounded-button">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs font-bold text-[#1d1d1f]">
                      Processing...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1 text-ios-green">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Ready</span>
                    </div>

                    {showParseButton && onParseClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onParseClick();
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 ios-blue-gradient text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                      >
                        <Play className="w-4 h-4" />
                        Parse File
                      </button>
                    )}

                    <button
                      onClick={removeFile}
                      className="p-2 rounded-xl glass hover:bg-ios-red/10 hover:text-ios-red transition-colors text-[#424245]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
