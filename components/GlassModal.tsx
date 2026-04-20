"use client";

import { useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
  className?: string;
}

export default function GlassModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "560px",
  className,
}: GlassModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      style={{ animation: "glassModalFadeIn 300ms ease-out forwards" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Modal Card */}
      <div
        ref={modalRef}
        className={cn("relative z-10 w-full", className)}
        style={{
          maxWidth,
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(32px) saturate(200%)",
          WebkitBackdropFilter: "blur(32px) saturate(200%)",
          border: "1px solid rgba(255, 255, 255, 0.6)",
          borderRadius: "28px",
          padding: "32px",
          boxShadow:
            "0 24px 80px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1) inset",
          animation: "glassModalSlideUp 300ms ease-out forwards",
        }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/5 transition-colors text-[#86868b] hover:text-[#1d1d1f]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* No title — just show close */}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl hover:bg-black/5 transition-colors text-[#86868b] hover:text-[#1d1d1f] z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Content */}
        <div>{children}</div>
      </div>

      <style jsx global>{`
        @keyframes glassModalFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes glassModalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
