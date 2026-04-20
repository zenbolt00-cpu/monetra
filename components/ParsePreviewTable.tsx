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
import { ParsedRow } from "@/lib/fileProcessor";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Save,
  XCircle,
  Loader2,
} from "lucide-react";

interface ParsePreviewTableProps {
  rows: ParsedRow[];
  onConfirm: (rows: ParsedRow[]) => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export default function ParsePreviewTable({
  rows: initialRows,
  onConfirm,
  onCancel,
  isConfirming = false,
}: ParsePreviewTableProps) {
  const [rows, setRows] = useState<ParsedRow[]>(initialRows);

  const toggleExclude = (index: number) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], isExcluded: !newRows[index].isExcluded };
    setRows(newRows);
  };

  const toggleType = (index: number) => {
    const newRows = [...rows];
    newRows[index] = {
      ...newRows[index],
      type: newRows[index].type === "PAYIN" ? "PAYOUT" : "PAYIN",
    };
    setRows(newRows);
  };

  const activeRows = rows.filter((r) => !r.isExcluded);
  const payinTotal = activeRows
    .filter((r) => r.type === "PAYIN")
    .reduce((sum, r) => sum + r.amount, 0);
  const payoutTotal = activeRows
    .filter((r) => r.type === "PAYOUT")
    .reduce((sum, r) => sum + r.amount, 0);

  const hasErrors = activeRows.some((r) => r.errors && r.errors.length > 0);

  return (
    <div className="space-y-6">
      <div className="glass p-6 rounded-card border-primary/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#86868b]">
              Total Detected
            </p>
            <p className="text-xl font-bold text-[#1d1d1f]">
              {rows.length} rows
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#86868b]">
              Included
            </p>
            <p className="text-xl font-bold text-[#1d1d1f]">
              {activeRows.length} rows
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-ios-green">
              Total Pay-in
            </p>
            <p className="text-xl font-bold text-ios-green">
              {formatCurrency(payinTotal)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-ios-red">
              Total Payout
            </p>
            <p className="text-xl font-bold text-ios-red">
              {formatCurrency(payoutTotal)}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="glass-button px-5 py-2.5 text-sm font-bold text-[#424245] rounded-xl flex items-center gap-2 hover:bg-black/5 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Cancel
          </button>
          <button
            onClick={() => onConfirm(activeRows)}
            disabled={isConfirming || activeRows.length === 0}
            className={cn(
              "px-5 py-2.5 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50",
              hasErrors ? "bg-amber-500 shadow-lg shadow-amber-500/20" : "ios-blue-gradient"
            )}
          >
            {isConfirming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : hasErrors ? (
              <XCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isConfirming
              ? "Importing..."
              : hasErrors
              ? `Confirm anyway? (${activeRows.length})`
              : `Confirm Import (${activeRows.length})`}
          </button>
        </div>
      </div>

      {hasErrors && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 text-sm animate-in fade-in slide-in-from-top-2">
          <XCircle className="w-5 h-5 text-amber-600" />
          <p>
            <span className="font-bold">Attention:</span> Some rows have validation issues (marked in red). Please review them before confirming.
          </p>
        </div>
      )}

      <div className="glass-card overflow-hidden border-black/5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/5">
              <TableRow className="border-black/5">
                <TableHead className="w-12"></TableHead>
                <TableHead className="w-12 text-[#86868b] font-bold uppercase text-[10px]">
                  Row
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">
                  Date
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">
                  Description
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">
                  Reference
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] text-right">
                  Amount
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] text-center">
                  Type
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] text-right">
                  Balance
                </TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px] text-center">
                  Color
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const hasRowError = row.errors && row.errors.length > 0;
                return (
                  <TableRow
                    key={index}
                    className={cn(
                      "border-black/5 glass-table-row transition-all",
                      row.isExcluded ? "opacity-30" : "opacity-100",
                      hasRowError && !row.isExcluded ? "bg-red-50/50" : ""
                    )}
                    style={{
                      borderLeft: hasRowError && !row.isExcluded
                        ? "3px solid #ff3b30"
                        : row.cellColor 
                        ? `3px solid ${row.cellColor}`
                        : undefined,
                      backgroundColor: hasRowError && !row.isExcluded
                        ? "rgba(255, 59, 48, 0.05)"
                        : row.cellColor
                        ? hexToRgba(row.cellColor, 0.05)
                        : undefined,
                    }}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={!row.isExcluded}
                        onChange={() => toggleExclude(index)}
                        className="w-4 h-4 rounded bg-black/5 border-black/10 accent-primary"
                      />
                    </TableCell>
                    <TableCell className="text-[10px] text-[#86868b] font-mono">
                      {row.rowIndex}
                    </TableCell>
                    <TableCell className="text-xs text-[#424245]">
                      {formatDate(row.date)}
                    </TableCell>
                    <TableCell className="text-xs text-[#1d1d1f] max-w-[300px] truncate">
                      {row.description}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-1">
                        <span className={cn(hasRowError && !row.isExcluded ? "font-bold text-ios-red" : "text-[#86868b]")}>
                          {row.reference || "-"}
                        </span>
                        {hasRowError && !row.isExcluded && row.errors?.map((err, i) => (
                          <span key={i} className="text-[9px] font-bold uppercase text-ios-red bg-ios-red/10 px-1.5 py-0.5 rounded-full w-fit">
                            {err}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-xs font-bold text-right",
                        row.type === "PAYIN" ? "text-ios-green" : "text-ios-red"
                      )}
                    >
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => toggleType(index)}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors inline-flex",
                          row.type === "PAYIN"
                            ? "bg-ios-green/10 text-ios-green hover:bg-ios-green/20"
                            : "bg-ios-red/10 text-ios-red hover:bg-ios-red/20"
                        )}
                        title="Click to toggle type"
                      >
                        {row.type === "PAYIN" ? (
                          <ArrowDownCircle className="w-4 h-4" />
                        ) : (
                          <ArrowUpCircle className="w-4 h-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-[#86868b] text-right">
                      {row.balance ? formatCurrency(row.balance) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.cellColor ? (
                        <div
                          className="w-3 h-3 rounded-full mx-auto border border-black/10"
                          style={{ backgroundColor: row.cellColor }}
                        />
                      ) : (
                        <div className="w-3 h-3 rounded-full mx-auto border border-black/5" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-32 text-center text-[#86868b] italic"
                  >
                    No rows were detected in this file.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
