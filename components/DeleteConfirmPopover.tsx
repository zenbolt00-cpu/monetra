"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

interface DeleteConfirmPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  transactionId: string;
  anchorRef?: React.RefObject<HTMLElement>;
}

export default function DeleteConfirmPopover({
  isOpen,
  onClose,
  onConfirm,
  transactionId,
}: DeleteConfirmPopoverProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Entry deleted");
      onConfirm();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 z-50"
      style={{
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(32px) saturate(200%)",
        WebkitBackdropFilter: "blur(32px) saturate(200%)",
        border: "1px solid rgba(0, 0, 0, 0.08)",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
        minWidth: "220px",
        animation: "glassModalSlideUp 200ms ease-out forwards",
      }}
    >
      <p className="text-sm font-semibold text-[#1d1d1f] mb-1">
        Delete this entry?
      </p>
      <p className="text-xs text-[#86868b] mb-4">
        This action cannot be undone.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="flex-1 px-4 py-2 text-xs font-bold text-[#424245] glass-button rounded-xl"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-1 px-4 py-2 text-xs font-bold text-white bg-gradient-to-b from-[#FF3B30] to-[#CC2E26] rounded-xl flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </>
          )}
        </button>
      </div>
    </div>
  );
}
