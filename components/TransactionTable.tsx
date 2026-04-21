"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { cn, formatCurrency, formatDate, hexToRgba } from "@/lib/utils";
import StatusBadge from "./StatusBadge";
import DeleteConfirmPopover from "./DeleteConfirmPopover";
import {
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
  Upload,
  Search,
  Hash,
  Calendar,
} from "lucide-react";

interface Transaction {
  id: string;
  date: Date | string;
  type: "PAYIN" | "PAYOUT";
  amount: number;
  description: string;
  reference?: string;
  balance?: number;
  bankName?: string;
  status: "CONFIRMED" | "PENDING" | "REJECTED";
  cellColor?: string | null;
  vendor?: { name: string };
  sourceFile?: { fileName: string };
}

interface TransactionTableProps {
  transactions: Transaction[];
  showVendor?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (txId: string) => void;
}

type SortKey = "date" | "amount" | "description" | "type" | "reference";
type SortDir = "asc" | "desc";

export default function TransactionTable({
  transactions,
  showVendor = false,
  allowEdit = false,
  allowDelete = false,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deletePopover, setDeletePopover] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = transactions
    .filter(
      (tx) =>
        tx.description?.toLowerCase().includes(search.toLowerCase()) ||
        tx.reference?.toLowerCase().includes(search.toLowerCase()) ||
        tx.vendor?.name?.toLowerCase().includes(search.toLowerCase()) ||
        String(tx.amount).includes(search)
    )
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
        case "description":
          cmp = (a.description || "").localeCompare(b.description || "");
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "reference":
          cmp = (a.reference || "").localeCompare(b.reference || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalAmount = filtered.reduce((sum, tx) => sum + tx.amount, 0);
  const payinCount = filtered.filter((tx) => tx.type === "PAYIN").length;
  const payoutCount = filtered.filter((tx) => tx.type === "PAYOUT").length;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 inline ml-0.5 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-0.5 text-primary" />
    );
  };

  const handleDeleteConfirmed = (txId: string) => {
    setDeletePopover(null);
    onDelete?.(txId);
  };

  if (transactions.length === 0 && !search) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/[0.06] flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-primary opacity-40" />
        </div>
        <h3 className="text-lg font-bold text-[#1d1d1f] mb-2 tracking-tight">
          No records yet
        </h3>
        <p className="text-sm text-[#86868b] max-w-md mx-auto">
          Upload a document or add an entry manually to see transaction records here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
          <input
            type="text"
            placeholder="Search by description, UTR, or amount..."
            className="glass-input pl-9 pr-4 py-2 text-sm w-[320px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-[#86868b]">
          <span className="glass-pill px-3 py-1.5 text-[11px] font-medium">
            {filtered.length} records
          </span>
          {payinCount > 0 && (
            <span className="glass-pill px-3 py-1.5 text-[11px] font-medium text-ios-green">
              ↓ {payinCount} pay-in
            </span>
          )}
          {payoutCount > 0 && (
            <span className="glass-pill px-3 py-1.5 text-[11px] font-medium text-ios-red">
              ↑ {payoutCount} payout
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden border-black/5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/[0.03]">
              <TableRow className="hover:bg-transparent border-black/5">
                <TableHead
                  className="caption-text cursor-pointer hover:text-[#1d1d1f] transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Date <SortIcon col="date" />
                  </div>
                </TableHead>
                {showVendor && (
                  <TableHead className="caption-text">
                    Vendor
                  </TableHead>
                )}
                <TableHead
                  className="caption-text cursor-pointer hover:text-[#1d1d1f] transition-colors"
                  onClick={() => handleSort("description")}
                >
                  Description <SortIcon col="description" />
                </TableHead>
                <TableHead
                  className="caption-text cursor-pointer hover:text-[#1d1d1f] transition-colors"
                  onClick={() => handleSort("reference")}
                >
                  <div className="flex items-center gap-1">
                    <Hash className="w-3 h-3" /> UTR / Reference <SortIcon col="reference" />
                  </div>
                </TableHead>
                <TableHead
                  className="caption-text text-right cursor-pointer hover:text-[#1d1d1f] transition-colors"
                  onClick={() => handleSort("amount")}
                >
                  Amount <SortIcon col="amount" />
                </TableHead>
                <TableHead
                  className="caption-text cursor-pointer hover:text-[#1d1d1f] transition-colors"
                  onClick={() => handleSort("type")}
                >
                  Type <SortIcon col="type" />
                </TableHead>
                <TableHead className="caption-text">
                  Status
                </TableHead>
                <TableHead className="caption-text text-center">
                  Color
                </TableHead>
                <TableHead className="caption-text">
                  Source
                </TableHead>
                {(allowEdit || allowDelete) && (
                  <TableHead className="caption-text text-center">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="hover:bg-primary/[0.02] border-black/5 group transition-colors glass-table-row"
                  style={{
                    borderLeft: tx.cellColor
                      ? `3px solid ${tx.cellColor}`
                      : undefined,
                    backgroundColor: tx.cellColor
                      ? hexToRgba(tx.cellColor, 0.05)
                      : undefined,
                  }}
                >
                  <TableCell className="text-xs text-[#424245] whitespace-nowrap">
                    {formatDate(tx.date)}
                  </TableCell>
                  {showVendor && (
                    <TableCell className="text-xs font-semibold text-[#1d1d1f]">
                      {tx.vendor?.name || "Admin"}
                    </TableCell>
                  )}
                  <TableCell
                    className="text-xs text-[#1d1d1f] max-w-[200px] truncate"
                    title={tx.description}
                  >
                    {tx.description}
                  </TableCell>
                  <TableCell className="text-xs">
                    {tx.reference ? (
                      <span className="font-mono text-[11px] font-semibold text-primary tracking-wide">
                        {tx.reference}
                      </span>
                    ) : (
                      <span className="text-[#c7c7cc] text-[10px] italic">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm font-bold text-right tabular-nums tracking-tight",
                      tx.type === "PAYIN" ? "text-ios-green" : "text-ios-red"
                    )}
                  >
                    {tx.type === "PAYOUT" ? "−" : "+"}
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tx.type} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tx.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    {tx.cellColor ? (
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-black/10 mx-auto shadow-sm"
                        style={{ backgroundColor: tx.cellColor }}
                        title={`Source color: ${tx.cellColor}`}
                      />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-black/[0.04] mx-auto" />
                    )}
                  </TableCell>
                  <TableCell>
                    {tx.sourceFile?.fileName ? (
                      <span
                        className="text-[10px] font-medium text-primary hover:underline cursor-pointer truncate max-w-[100px] block"
                        title={tx.sourceFile.fileName}
                      >
                        {tx.sourceFile.fileName}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#c7c7cc]">
                        Manual
                      </span>
                    )}
                  </TableCell>
                  {(allowEdit || allowDelete) && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity relative">
                        {allowEdit && (
                          <button
                            onClick={() => onEdit?.(tx)}
                            className="p-1.5 rounded-lg glass-button hover:bg-primary/10 hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {allowDelete && (
                          <div className="relative">
                            <button
                              onClick={() =>
                                setDeletePopover(
                                  deletePopover === tx.id ? null : tx.id
                                )
                              }
                              className="p-1.5 rounded-lg glass-button hover:bg-ios-red/10 hover:text-ios-red transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <DeleteConfirmPopover
                              isOpen={deletePopover === tx.id}
                              onClose={() => setDeletePopover(null)}
                              onConfirm={() => handleDeleteConfirmed(tx.id)}
                              transactionId={tx.id}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={
                      (showVendor ? 1 : 0) +
                      (allowEdit || allowDelete ? 10 : 9)
                    }
                    className="h-32 text-center text-[#86868b] italic"
                  >
                    No records match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-black/[0.03] border-t border-black/[0.06]">
              <TableRow>
                <TableCell
                  colSpan={showVendor ? 4 : 3}
                  className="text-xs font-bold text-[#1d1d1f] uppercase tracking-wider"
                >
                  Total
                </TableCell>
                <TableCell className="text-sm font-bold text-right text-[#1d1d1f] tabular-nums tracking-tight">
                  {formatCurrency(totalAmount)}
                </TableCell>
                <TableCell
                  colSpan={allowEdit || allowDelete ? 6 : 5}
                ></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
