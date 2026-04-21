"use client";

import { useState, useMemo } from "react";
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
  AlertTriangle,
  Hash,
  Calendar,
  Clock,
  Wifi,
  CheckCircle2,
  Ban,
  Search,
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
  const [searchQuery, setSearchQuery] = useState("");

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

  const toggleAll = (checked: boolean) => {
    setRows(rows.map((r) => ({ ...r, isExcluded: !checked })));
  };

  // Filtered rows for search
  const displayRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.description?.toLowerCase().includes(q) ||
        r.reference?.toLowerCase().includes(q) ||
        String(r.amount).includes(q) ||
        r.mode?.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const activeRows = rows.filter((r) => !r.isExcluded);
  const payinTotal = activeRows
    .filter((r) => r.type === "PAYIN")
    .reduce((sum, r) => sum + r.amount, 0);
  const payoutTotal = activeRows
    .filter((r) => r.type === "PAYOUT")
    .reduce((sum, r) => sum + r.amount, 0);
  const refsFound = activeRows.filter((r) => r.reference).length;
  const duplicates = activeRows.filter(
    (r) => r.errors && r.errors.length > 0
  ).length;

  const hasErrors = activeRows.some((r) => r.errors && r.errors.length > 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats Bar */}
      <div className="glass-card p-6 border-primary/10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap gap-8">
            <div className="space-y-1">
              <p className="caption-text">Total Detected</p>
              <p className="text-2xl font-bold text-[#1d1d1f] tabular-nums tracking-tight">
                {rows.length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="caption-text">Included</p>
              <p className="text-2xl font-bold text-[#1d1d1f] tabular-nums tracking-tight">
                {activeRows.length}
              </p>
            </div>
            <div className="h-12 w-px bg-black/[0.06]" />
            <div className="space-y-1">
              <p className="caption-text text-ios-green flex items-center gap-1">
                <ArrowDownCircle className="w-3 h-3" /> Total Pay-in
              </p>
              <p className="text-2xl font-bold text-ios-green tabular-nums tracking-tight">
                {formatCurrency(payinTotal)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="caption-text text-ios-red flex items-center gap-1">
                <ArrowUpCircle className="w-3 h-3" /> Total Payout
              </p>
              <p className="text-2xl font-bold text-ios-red tabular-nums tracking-tight">
                {formatCurrency(payoutTotal)}
              </p>
            </div>
            <div className="h-12 w-px bg-black/[0.06]" />
            <div className="space-y-1">
              <p className="caption-text flex items-center gap-1">
                <Hash className="w-3 h-3" /> UTRs Found
              </p>
              <p className="text-2xl font-bold text-[#1d1d1f] tabular-nums tracking-tight">
                {refsFound}
              </p>
            </div>
            {duplicates > 0 && (
              <div className="space-y-1">
                <p className="caption-text text-ios-red flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Duplicates
                </p>
                <p className="text-2xl font-bold text-ios-red tabular-nums tracking-tight">
                  {duplicates}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isConfirming}
              className="glass-button px-5 py-2.5 text-sm font-bold text-[#424245] rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Cancel
            </button>
            <button
              onClick={() => onConfirm(activeRows)}
              disabled={isConfirming || activeRows.length === 0}
              className={cn(
                "px-6 py-2.5 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50",
                hasErrors
                  ? "bg-gradient-to-b from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20"
                  : "ios-blue-gradient"
              )}
            >
              {isConfirming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasErrors ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isConfirming
                ? "Importing..."
                : hasErrors
                ? `Import anyway (${activeRows.length})`
                : `Confirm Import (${activeRows.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      {hasErrors && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 backdrop-blur-sm animate-spring-entrance">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-bold">Attention:</span>{" "}
            {duplicates} row(s) have duplicate UTR numbers. Review them below — duplicates are highlighted in red.
          </p>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
        <input
          type="text"
          placeholder="Search by description, UTR, amount, or mode..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-input pl-10 pr-4 py-2.5 text-sm w-full max-w-md"
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden border-black/5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/[0.03]">
              <TableRow className="border-black/5">
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={activeRows.length === rows.length}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="w-4 h-4 rounded bg-black/5 border-black/10 accent-primary"
                  />
                </TableHead>
                <TableHead className="w-14 caption-text">
                  #
                </TableHead>
                <TableHead className="caption-text">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Date
                  </div>
                </TableHead>
                <TableHead className="caption-text">
                  Description
                </TableHead>
                <TableHead className="caption-text">
                  <div className="flex items-center gap-1">
                    <Hash className="w-3 h-3" /> UTR / Reference
                  </div>
                </TableHead>
                <TableHead className="caption-text text-right">
                  Amount
                </TableHead>
                <TableHead className="caption-text text-center">
                  Type
                </TableHead>
                <TableHead className="caption-text">
                  <div className="flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> Mode
                  </div>
                </TableHead>
                <TableHead className="caption-text text-right">
                  Balance
                </TableHead>
                <TableHead className="caption-text text-center">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row, index) => {
                const actualIndex = rows.indexOf(row);
                const hasRowError = row.errors && row.errors.length > 0;
                return (
                  <TableRow
                    key={actualIndex}
                    className={cn(
                      "border-black/5 glass-table-row transition-all",
                      row.isExcluded ? "opacity-25" : "opacity-100",
                      hasRowError && !row.isExcluded ? "bg-red-50/40" : ""
                    )}
                    style={{
                      borderLeft: hasRowError && !row.isExcluded
                        ? "3px solid #FF453A"
                        : row.cellColor
                        ? `3px solid ${row.cellColor}`
                        : undefined,
                      backgroundColor: hasRowError && !row.isExcluded
                        ? "rgba(255, 69, 58, 0.04)"
                        : row.cellColor
                        ? hexToRgba(row.cellColor, 0.04)
                        : undefined,
                    }}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={!row.isExcluded}
                        onChange={() => toggleExclude(actualIndex)}
                        className="w-4 h-4 rounded bg-black/5 border-black/10 accent-primary"
                      />
                    </TableCell>
                    <TableCell className="text-[11px] text-[#86868b] font-mono tabular-nums">
                      {row.rowIndex}
                    </TableCell>
                    <TableCell className="text-xs text-[#424245] whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{formatDate(row.date)}</span>
                        {row.time && (
                          <span className="text-[10px] text-[#86868b] flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> {row.time}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-[#1d1d1f] max-w-[240px]">
                      <span className="block truncate" title={row.description}>
                        {row.description}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-1">
                        {row.reference ? (
                          <span
                            className={cn(
                              "font-mono text-[11px] font-semibold tracking-wide",
                              hasRowError && !row.isExcluded
                                ? "text-ios-red"
                                : "text-primary"
                            )}
                          >
                            {row.reference}
                          </span>
                        ) : (
                          <span className="text-[#c7c7cc] text-[10px] italic">
                            No ref found
                          </span>
                        )}
                        {hasRowError &&
                          !row.isExcluded &&
                          row.errors?.map((err, i) => (
                            <span
                              key={i}
                              className="text-[9px] font-bold uppercase text-ios-red bg-ios-red/8 px-2 py-0.5 rounded-full w-fit flex items-center gap-1"
                            >
                              <Ban className="w-2.5 h-2.5" />
                              {err}
                            </span>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-sm font-bold text-right tabular-nums tracking-tight",
                        row.type === "PAYIN" ? "text-ios-green" : "text-ios-red"
                      )}
                    >
                      {row.type === "PAYOUT" ? "−" : "+"}
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => toggleType(actualIndex)}
                        className={cn(
                          "p-2 rounded-xl transition-all inline-flex",
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
                    <TableCell className="text-[10px]">
                      {row.mode ? (
                        <span className="glass-pill px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#424245]">
                          {row.mode}
                        </span>
                      ) : (
                        <span className="text-[#c7c7cc]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-[#86868b] text-right tabular-nums">
                      {row.balance ? formatCurrency(row.balance) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.cellColor ? (
                        <div
                          className="w-3.5 h-3.5 rounded-full mx-auto border border-black/10 shadow-sm"
                          style={{ backgroundColor: row.cellColor }}
                          title={`Source color: ${row.cellColor}`}
                        />
                      ) : hasRowError && !row.isExcluded ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-ios-green/40 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {displayRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-32 text-center text-[#86868b] italic"
                  >
                    {searchQuery
                      ? "No rows match your search."
                      : "No rows were detected in this file."}
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
