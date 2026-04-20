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

type SortKey = "date" | "amount" | "description" | "type";
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
        tx.vendor?.name?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp =
            new Date(a.date).getTime() - new Date(b.date).getTime();
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
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalAmount = filtered.reduce((sum, tx) => sum + tx.amount, 0);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    );
  };

  const handleDeleteConfirmed = (txId: string) => {
    setDeletePopover(null);
    onDelete?.(txId);
  };

  if (transactions.length === 0 && !search) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-primary opacity-60" />
        </div>
        <h3 className="text-lg font-bold text-[#1d1d1f] mb-2">
          No records found
        </h3>
        <p className="text-sm text-[#86868b] max-w-md mx-auto">
          Upload a file or add an entry manually to see transaction records
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Filter records..."
          className="glass-input px-4 py-2 text-sm w-full max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="text-[#86868b] text-sm whitespace-nowrap">
          Showing {filtered.length} of {transactions.length} records
        </div>
      </div>

      <div className="glass-card overflow-hidden border-black/5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/5">
              <TableRow className="hover:bg-transparent border-black/5">
                <TableHead
                  className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider cursor-pointer hover:text-[#1d1d1f] transition-colors"
                  onClick={() => handleSort("date")}
                >
                  Date
                  <SortIcon col="date" />
                </TableHead>
                {showVendor && (
                  <TableHead className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider">
                    Vendor
                  </TableHead>
                )}
                <TableHead
                  className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider cursor-pointer hover:text-[#1d1d1f] transition-colors"
                  onClick={() => handleSort("description")}
                >
                  Description
                  <SortIcon col="description" />
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider">
                  Reference
                </TableHead>
                <TableHead
                  className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider text-right cursor-pointer hover:text-[#1d1d1f] transition-colors"
                  onClick={() => handleSort("amount")}
                >
                  Amount
                  <SortIcon col="amount" />
                </TableHead>
                <TableHead
                  className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider cursor-pointer hover:text-[#1d1d1f] transition-colors"
                  onClick={() => handleSort("type")}
                >
                  Type
                  <SortIcon col="type" />
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider">
                  Color
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider">
                  Source
                </TableHead>
                {(allowEdit || allowDelete) && (
                  <TableHead className="text-[#86868b] font-bold uppercase text-[10px] tracking-wider text-center">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="hover:bg-black/5 border-black/5 group transition-colors glass-table-row"
                  style={{
                    borderLeft: tx.cellColor
                      ? `4px solid ${tx.cellColor}`
                      : undefined,
                    backgroundColor: tx.cellColor
                      ? hexToRgba(tx.cellColor, 0.08)
                      : undefined,
                  }}
                >
                  <TableCell className="text-xs text-[#424245]">
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
                  <TableCell className="text-xs text-[#86868b]">
                    {tx.reference || "-"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-xs font-bold text-right",
                      tx.type === "PAYIN" ? "text-ios-green" : "text-ios-red"
                    )}
                  >
                    {tx.type === "PAYOUT" ? "-" : ""}
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tx.type} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tx.status} />
                  </TableCell>
                  <TableCell>
                    {tx.cellColor ? (
                      <div
                        className="w-3 h-3 rounded-full border border-black/10"
                        style={{ backgroundColor: tx.cellColor }}
                        title={`Original source color: ${tx.cellColor}`}
                      />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-black/5" />
                    )}
                  </TableCell>
                  <TableCell>
                    {tx.sourceFile?.fileName ? (
                      <span
                        className="text-[10px] text-primary hover:underline cursor-pointer truncate max-w-[100px] block"
                        title={tx.sourceFile.fileName}
                      >
                        {tx.sourceFile.fileName}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#86868b]">
                        Manual
                      </span>
                    )}
                  </TableCell>
                  {(allowEdit || allowDelete) && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-2 relative">
                        {allowEdit && (
                          <button
                            onClick={() => onEdit?.(tx)}
                            className="p-1.5 rounded-lg glass hover:bg-primary/10 hover:text-primary transition-colors"
                            title="Edit entry"
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
                              className="p-1.5 rounded-lg glass hover:bg-ios-red/10 hover:text-ios-red transition-colors"
                              title="Delete entry"
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
                    No records found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-black/5 border-t border-black/10">
              <TableRow>
                <TableCell
                  colSpan={showVendor ? 4 : 3}
                  className="text-xs font-bold text-[#1d1d1f] uppercase tracking-wider"
                >
                  Total for current filter
                </TableCell>
                <TableCell className="text-xs font-bold text-right text-[#1d1d1f] border-primary/10 bg-primary/5">
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
