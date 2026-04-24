import * as XLSX from "xlsx";
import { TxType, FileType } from "@prisma/client";
import { detectColumns } from "./columnDetector";

// Dynamic import for pdf-parse to avoid top-level issues on Vercel
let PDFParseClass: any = null;

// Shim DOMMatrix for Node.js environments to prevent pdfjs-dist errors
if (typeof global !== "undefined" && typeof (global as any).DOMMatrix === "undefined") {
  (global as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    constructor(init?: any) {
      if (Array.isArray(init) && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }
    toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
  };
}

export interface ParsedRow {
  date: Date;
  amount: number;
  description: string;
  reference?: string;
  type: TxType;
  balance?: number;
  cellColor?: string;
  rowIndex: number;
  rawData: any;
  category?: string;
  isExcluded: boolean;
  errors?: string[];
  bankName?: string;
  accountNumber?: string;
  time?: string;
  mode?: string; // NEFT, RTGS, IMPS, UPI etc.
}

/* ──────────────────────────────────────────────────────────
 *  Robust Number Parser – handles Indian/intl formats
 * ────────────────────────────────────────────────────────── */
function parseNumber(val: any): number {
  if (typeof val === "number") return val;
  if (!val) return NaN;
  let str = String(val).trim();
  
  // Remove currency symbols, spaces, and other non-numeric chars except . , - ( )
  str = str.replace(/[₹$€£¥\s]+/g, "");
  
  // Handle (1,234.56) -> -1,234.56
  if (str.startsWith("(") && str.endsWith(")")) {
    str = "-" + str.slice(1, -1);
  }
  
  // Handle trailing minus: 1234.00-
  if (str.endsWith("-") && !str.startsWith("-")) {
    str = "-" + str.slice(0, -1);
  }

  // Detect if it's European format: 1.234,56 (comma as decimal separator)
  // Check if there's a comma followed by 2 digits at the end AND no other comma
  if (/,(\d{2})$/.test(str) && (str.match(/\./g) || []).length >= 1 && (str.match(/,/g) || []).length === 1) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    // Normal format: remove commas used as thousand separators
    str = str.replace(/,/g, "");
  }

  const num = parseFloat(str);
  return num;
}

/* ──────────────────────────────────────────────────────────
 *  Date Parser – handles all common banking formats
 * ────────────────────────────────────────────────────────── */
const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function parseDate(val: any): Date {
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (!val) return new Date();

  const str = String(val).trim();

  // Excel serial date numbers
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str);
    const utc = new Date(Date.UTC(1899, 11, 30));
    utc.setUTCDate(utc.getUTCDate() + serial);
    return utc;
  }

  // Try DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]);
    const month = parseInt(dmyMatch[2]) - 1;
    let year = parseInt(dmyMatch[3]);
    if (year < 100) year += 2000;
    if (year > 1900 && month >= 0 && month < 12 && day > 0 && day <= 31) {
      return new Date(year, month, day);
    }
  }

  // Try YYYY-MM-DD (ISO-like)
  const isoMatch = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]) - 1;
    const day = parseInt(isoMatch[3]);
    if (year > 1900 && month >= 0 && month < 12 && day > 0 && day <= 31) {
      return new Date(year, month, day);
    }
  }

  // Try DD MMM YYYY or DD-MMM-YYYY or DD/MMM/YYYY (e.g. "12 Apr 2023", "12-Apr-23")
  const dmyTextMatch = str.match(
    /(\d{1,2})\s*[/\-.\s]\s*([A-Za-z]{3,9})\s*[/\-.\s]\s*(\d{2,4})/i
  );
  if (dmyTextMatch) {
    const day = parseInt(dmyTextMatch[1]);
    const monthName = dmyTextMatch[2].toLowerCase();
    const month = MONTH_NAMES[monthName];
    let year = parseInt(dmyTextMatch[3]);
    if (year < 100) year += 2000;
    if (month !== undefined && day > 0 && day <= 31) {
      return new Date(year, month, day);
    }
  }

  // Try MMM DD, YYYY (e.g. "Apr 12, 2023")
  const mdyTextMatch = str.match(
    /([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{2,4})/i
  );
  if (mdyTextMatch) {
    const monthName = mdyTextMatch[1].toLowerCase();
    const month = MONTH_NAMES[monthName];
    const day = parseInt(mdyTextMatch[2]);
    let year = parseInt(mdyTextMatch[3]);
    if (year < 100) year += 2000;
    if (month !== undefined && day > 0 && day <= 31) {
      return new Date(year, month, day);
    }
  }

  // Try DD/MM/YYYY HH:MM:SS (with time)
  const dateTimeMatch = str.match(
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (dateTimeMatch) {
    const day = parseInt(dateTimeMatch[1]);
    const month = parseInt(dateTimeMatch[2]) - 1;
    let year = parseInt(dateTimeMatch[3]);
    if (year < 100) year += 2000;
    const hours = parseInt(dateTimeMatch[4]);
    const minutes = parseInt(dateTimeMatch[5]);
    const seconds = dateTimeMatch[6] ? parseInt(dateTimeMatch[6]) : 0;
    if (year > 1900 && month >= 0 && month < 12 && day > 0 && day <= 31) {
      return new Date(year, month, day, hours, minutes, seconds);
    }
  }

  // Fallback: try standard JS parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  return new Date();
}

/* ──────────────────────────────────────────────────────────
 *  UTR / Reference Number Extraction Engine
 *  Handles: UPI, NEFT, RTGS, IMPS, Cheque, Custom Refs
 * ────────────────────────────────────────────────────────── */
const UTR_PATTERNS = [
  // Explicit labeled references: "UTR: XXXX", "REF NO: XXXX" etc.
  /(?:UTR|UTR\s*(?:NO|NUMBER|ID|#)?|REF|REF\s*(?:NO|NUMBER|ID|#)?|REFERENCE|TRANS(?:ACTION)?\s*(?:NO|NUMBER|ID|#)?|TXN\s*(?:NO|NUMBER|ID|#)?|PAYMENT\s*(?:NO|NUMBER|ID|#)?|INSTRUMENT\s*(?:NO|NUMBER|ID|#)?|RECEIPT\s*(?:NO|NUMBER|ID)?|VOUCHER\s*(?:NO|NUMBER|#)?|CHEQUE\s*(?:NO|NUMBER|#)?|CHQ\s*(?:NO|#)?|CMS\s*(?:REF)?|RRN|ARN|ID)\s*[:.#\-]?\s*([A-Za-z0-9]{6,30})/i,

  // UPI transaction IDs (format: 12-14 digit numbers)
  /(?:UPI[/-]?)(\d{12,14})/i,

  // NEFT/RTGS/IMPS reference patterns (bank-specific)
  /(?:NEFT|RTGS|IMPS)[/\-]?([A-Z0-9]{10,22})/i,

  // Standalone long alphanumeric references (12+ chars, not dates or amounts)
  /\b([A-Z]{2,4}\d{8,18})\b/,  // e.g., UBIN02345678901234
  /\b(\d{12,16})\b/,  // Pure numeric 12-16 digit refs (UPI/IMPS style)
];

function extractReference(text: string): string | undefined {
  if (!text) return undefined;

  // Clean text from common clutter that might interfere with regex
  const cleanText = text.replace(/[\r\n\t]+/g, " ");

  for (const pattern of UTR_PATTERNS) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const ref = match[1].trim();
      
      // Validation: 
      // 1. Not a date
      // 2. Not a pure small number (amount)
      // 3. Not all zeros
      // 4. Length >= 6
      if (
        ref.length >= 6 &&
        !/^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$/.test(ref) && // Not date
        !/^\d+(\.\d{1,2})?$/.test(ref) && // Not simple amount
        !/^0+$/.test(ref)
      ) {
        return ref;
      }
    }
  }

  return undefined;
}

/* ──────────────────────────────────────────────────────────
 *  Transaction Mode Detection
 * ────────────────────────────────────────────────────────── */
function detectTransactionMode(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("upi")) return "UPI";
  if (lower.includes("imps")) return "IMPS";
  if (lower.includes("neft")) return "NEFT";
  if (lower.includes("rtgs")) return "RTGS";
  if (lower.includes("cheque") || lower.includes("chq")) return "CHEQUE";
  if (lower.includes("cash")) return "CASH";
  if (lower.includes("ach")) return "ACH";
  if (lower.includes("dd") || lower.includes("demand draft")) return "DD";
  if (lower.includes("wire")) return "WIRE";
  return undefined;
}

/* ──────────────────────────────────────────────────────────
 *  Time Extraction from text
 * ────────────────────────────────────────────────────────── */
function extractTime(text: string): string | undefined {
  const timeMatch = text.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
  return timeMatch ? timeMatch[1].trim() : undefined;
}

/* ──────────────────────────────────────────────────────────
 *  EXCEL PROCESSOR
 * ────────────────────────────────────────────────────────── */
export async function processExcel(
  buffer: Buffer,
  fileType: FileType,
  txTypeOverride?: TxType
): Promise<{ rows: ParsedRow[]; headers: string[] }> {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellStyles: true,
    cellDates: true,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (jsonData.length < 1) return { rows: [], headers: [] };

  // Smart header detection: skip leading empty rows and find the actual header row
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    const nonEmptyCells = row.filter((cell: any) => String(cell || "").trim().length > 0);
    if (nonEmptyCells.length >= 3) {
      // Check if this looks like a header row (contains recognizable column names)
      const rowText = row.map((c: any) => String(c || "").toLowerCase().trim()).join(" ");
      const headerKeywords = ["date", "amount", "credit", "debit", "description", "narration", "balance", "ref", "utr", "particulars", "withdrawal", "deposit", "tx", "txn"];
      const matchCount = headerKeywords.filter(k => rowText.includes(k)).length;
      if (matchCount >= 2) {
        headerRowIndex = i;
        break;
      }
    }
  }

  const headers = (jsonData[headerRowIndex] as string[]).map((h) =>
    String(h || "").trim()
  );
  const mapping = detectColumns(headers);

  const rows: ParsedRow[] = [];

  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const rawRow = jsonData[i];
    if (!rawRow || rawRow.length === 0) continue;

    // Skip rows that are all empty
    const nonEmpty = rawRow.filter((cell: any) => String(cell || "").trim().length > 0);
    if (nonEmpty.length < 2) continue;

    const rowData: any = {};
    headers.forEach((header, index) => {
      rowData[header] = rawRow[index];
    });

    // Color extraction from cell styles
    let cellColor: string | undefined;
    const colsToCheck = [
      mapping.credit,
      mapping.debit,
      mapping.amount,
      mapping.date,
    ].filter(Boolean);

    for (const col of colsToCheck) {
      if (cellColor) break;
      const colIndex = headers.indexOf(col!);
      if (colIndex === -1) continue;

      const cellAddress = XLSX.utils.encode_cell({ r: i, c: colIndex });
      const cell = worksheet[cellAddress];
      const fgRgb = cell?.s?.fgColor?.rgb;
      const bgRgb = cell?.s?.bgColor?.rgb;
      const color = fgRgb || bgRgb;

      if (
        color &&
        color !== "FFFFFFFF" &&
        color !== "00000000" &&
        color !== "FFFFFF" &&
        color !== "000000"
      ) {
        cellColor = `#${color.slice(-6)}`;
      }
    }

    // Determine amount and type based on column structure
    let amount: number;
    let type: TxType;

    if (mapping.credit && mapping.debit) {
      const creditVal = parseNumber(rowData[mapping.credit]);
      const debitVal = parseNumber(rowData[mapping.debit]);

      if (!isNaN(creditVal) && creditVal > 0) {
        amount = creditVal;
        type = TxType.PAYIN;
      } else if (!isNaN(debitVal) && debitVal > 0) {
        amount = debitVal;
        type = TxType.PAYOUT;
      } else if (!isNaN(creditVal) && creditVal !== 0) {
        amount = Math.abs(creditVal);
        type = TxType.PAYIN;
      } else if (!isNaN(debitVal) && debitVal !== 0) {
        amount = Math.abs(debitVal);
        type = TxType.PAYOUT;
      } else {
        continue;
      }
    } else if (mapping.amount) {
      const rawAmount = parseNumber(rowData[mapping.amount]);
      if (isNaN(rawAmount) || rawAmount === 0) continue;

      amount = Math.abs(rawAmount);

      if (mapping.type) {
        const typeVal = String(rowData[mapping.type] || "")
          .toLowerCase()
          .trim();
        if (["cr", "credit", "c", "payin", "pay-in", "receipt", "received", "inward"].includes(typeVal)) {
          type = TxType.PAYIN;
        } else if (["dr", "debit", "d", "payout", "pay-out", "payment", "paid", "outward"].includes(typeVal)) {
          type = TxType.PAYOUT;
        } else {
          type = rawAmount >= 0 ? TxType.PAYIN : TxType.PAYOUT;
        }
      } else {
        type = rawAmount >= 0 ? TxType.PAYIN : TxType.PAYOUT;
      }
    } else {
      continue;
    }

    if (txTypeOverride) {
      type = txTypeOverride;
    }

    const dateValue = rowData[mapping.date || ""];
    const date = parseDate(dateValue);

    const description = String(
      rowData[mapping.description || ""] || "No description"
    ).trim();

    // Enhanced reference extraction: try column first, then scan description
    let reference = String(rowData[mapping.reference || ""] || "").trim();
    if (!reference || reference.length < 4) {
      // Try to extract from description text
      const descRef = extractReference(description);
      if (descRef) reference = descRef;

      // Also scan across all row values for UTR-like patterns
      if (!reference) {
        const allText = Object.values(rowData).map(v => String(v || "")).join(" ");
        const allRef = extractReference(allText);
        if (allRef) reference = allRef;
      }
    }

    const balance = mapping.balance
      ? parseNumber(rowData[mapping.balance])
      : undefined;

    // Detect transaction mode from description
    const mode = detectTransactionMode(description);

    // Extract time if present
    const time = extractTime(String(dateValue || "") + " " + description);

    rows.push({
      date: isNaN(date.getTime()) ? new Date() : date,
      amount,
      description,
      reference: reference || undefined,
      type,
      balance: balance && !isNaN(balance) ? balance : undefined,
      cellColor,
      rowIndex: i + 1,
      rawData: rowData,
      isExcluded: false,
      mode,
      time,
    });
  }

  return { rows, headers };
}

/* ──────────────────────────────────────────────────────────
 *  PDF PROCESSOR – Inbuilt Local Intelligence Engine
 *  Uses pdf-parse v2.4.5 API: getTable() + getText()
 * ────────────────────────────────────────────────────────── */
export async function processPDF(
  buffer: Buffer,
  txTypeOverride?: TxType
): Promise<{ rows: ParsedRow[]; headers: string[] }> {
  console.log("[PDF] Starting extraction with pdf-parse v2 engine...");

  const headers = ["Date", "Description", "Reference", "Amount", "Type", "Balance", "Mode"];
  let rows: ParsedRow[] = [];

  let parser: any;
  try {
    if (!PDFParseClass) {
      const mod = await import("pdf-parse");
      PDFParseClass = mod.PDFParse;
    }
    // pdf-parse v2.4.5: default export IS the PDFParse class
    parser = new PDFParseClass({ data: new Uint8Array(buffer) } as any);
  } catch (initErr: any) {
    console.error("[PDF] Parser init error:", initErr);
    return { rows: [], headers };
  }

  // ── STRATEGY 1: Try structured table extraction first ──
  try {
    const tableResult = await parser.getTable();
    if (tableResult && tableResult.pages) {
      console.log(`[PDF] Table extraction found ${tableResult.total} table(s)`);
      rows = extractFromTables(tableResult, txTypeOverride);
    }
  } catch (tableErr) {
    console.warn("[PDF] Table extraction unavailable, falling back to text:", tableErr);
  }

  // ── STRATEGY 2: Fall back to raw text extraction ──
  if (rows.length === 0) {
    try {
      const textResult = await parser.getText();
      const textContent = textResult?.text || "";
      console.log(`[PDF] Text extraction got ${textContent.length} chars`);
      if (textContent.trim().length >= 10) {
        rows = extractFromText(textContent, txTypeOverride);
      } else {
        console.warn("[PDF] Document appears empty or scanned (needs OCR).");
      }
    } catch (textErr) {
      console.error("[PDF] Text extraction error:", textErr);
    }
  }

  // Cleanup parser
  try { await parser.destroy(); } catch (_) {}

  console.log(`[PDF] Extraction complete. Found ${rows.length} valid transactions.`);
  return { rows, headers };
}

/* ──────────────────────────────────────────────────────────
 *  Extract transactions from structured table data
 * ────────────────────────────────────────────────────────── */
function extractFromTables(tableResult: any, txTypeOverride?: TxType): ParsedRow[] {
  const rows: ParsedRow[] = [];

  // Gather all tables from all pages (+ mergedTables if available)
  const allTables: string[][][] = [];
  if (tableResult.mergedTables?.length) {
    allTables.push(...tableResult.mergedTables);
  }
  for (const page of tableResult.pages || []) {
    if (page.tables?.length) {
      allTables.push(...page.tables);
    }
  }

  for (const table of allTables) {
    if (!table || table.length < 2) continue;

    // First row is likely the header – detect column mapping
    const headerRow = table[0].map((h: string) => (h || "").trim());
    const mapping = detectColumns(headerRow);

    // If we can't even find a date column, skip this table
    if (!mapping.date && !mapping.amount && !mapping.credit && !mapping.debit) continue;

    const colIndex = (name?: string) => {
      if (!name) return -1;
      return headerRow.findIndex((h: string) =>
        h.toLowerCase().trim() === name.toLowerCase().trim()
      );
    };

    const dateIdx = colIndex(mapping.date);
    const descIdx = colIndex(mapping.description);
    const refIdx = colIndex(mapping.reference);
    const creditIdx = colIndex(mapping.credit);
    const debitIdx = colIndex(mapping.debit);
    const amountIdx = colIndex(mapping.amount);
    const balanceIdx = colIndex(mapping.balance);
    const typeIdx = colIndex(mapping.type);

    for (let r = 1; r < table.length; r++) {
      const row = table[r];
      if (!row || row.length < 2) continue;

      // Get date
      const dateStr = dateIdx >= 0 ? (row[dateIdx] || "").trim() : "";
      if (!dateStr) continue;
      const date = parseDate(dateStr);
      if (isNaN(date.getTime())) continue;

      // Get amount & type
      let amount: number;
      let type: TxType;

      if (creditIdx >= 0 && debitIdx >= 0) {
        const creditVal = parseNumber(row[creditIdx]);
        const debitVal = parseNumber(row[debitIdx]);
        if (!isNaN(creditVal) && creditVal > 0) {
          amount = creditVal;
          type = TxType.PAYIN;
        } else if (!isNaN(debitVal) && debitVal > 0) {
          amount = debitVal;
          type = TxType.PAYOUT;
        } else if (!isNaN(creditVal) && creditVal !== 0) {
          amount = Math.abs(creditVal);
          type = TxType.PAYIN;
        } else if (!isNaN(debitVal) && debitVal !== 0) {
          amount = Math.abs(debitVal);
          type = TxType.PAYOUT;
        } else {
          continue;
        }
      } else if (amountIdx >= 0) {
        const rawAmount = parseNumber(row[amountIdx]);
        if (isNaN(rawAmount) || rawAmount === 0) continue;
        amount = Math.abs(rawAmount);
        if (typeIdx >= 0) {
          const tv = (row[typeIdx] || "").toLowerCase().trim();
          if (["cr", "credit", "c", "payin", "pay-in", "receipt"].includes(tv)) {
            type = TxType.PAYIN;
          } else if (["dr", "debit", "d", "payout", "pay-out", "payment"].includes(tv)) {
            type = TxType.PAYOUT;
          } else {
            type = rawAmount >= 0 ? TxType.PAYIN : TxType.PAYOUT;
          }
        } else {
          type = rawAmount >= 0 ? TxType.PAYIN : TxType.PAYOUT;
        }
      } else {
        continue;
      }

      if (txTypeOverride) type = txTypeOverride;

      const description = descIdx >= 0 ? (row[descIdx] || "").trim() : "Transaction";
      let reference = refIdx >= 0 ? (row[refIdx] || "").trim() : "";
      if (!reference || reference.length < 4) {
        reference = extractReference(description) || "";
        if (!reference) {
          const allText = row.join(" ");
          reference = extractReference(allText) || "";
        }
      }

      const balance = balanceIdx >= 0 ? parseNumber(row[balanceIdx]) : undefined;
      const mode = detectTransactionMode(description + " " + (reference || ""));
      const time = extractTime(row.join(" "));

      rows.push({
        date,
        amount,
        description: description || "Transaction",
        reference: reference || undefined,
        type,
        balance: balance && !isNaN(balance) ? balance : undefined,
        rowIndex: r,
        rawData: Object.fromEntries(headerRow.map((h: string, i: number) => [h, row[i] || ""])),
        isExcluded: false,
        mode,
        time,
      });
    }
  }

  return rows;
}

/* ──────────────────────────────────────────────────────────
 *  Extract transactions from raw text (fallback)
 * ────────────────────────────────────────────────────────── */
function extractFromText(textContent: string, txTypeOverride?: TxType): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = textContent.split("\n");

  const datePatterns = [
    /(\d{1,2}[/\-. ](?:0?[1-9]|1[0-2]|[A-Z]{3,9})[/\-. ](?:\d{4}|\d{2}))/i,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/i,
    /(\d{4}[/\-.](?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01]))/,
  ];
  const amountPattern = /(?:\b|-)(?:\d{1,3}(?:,\d{2,3})*|\d+)(?:\.\d{1,2})?\b/g;

  let currentTx: Partial<ParsedRow> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length < 5) continue;

    let foundDate: Date | null = null;
    let dateStr = "";
    for (const p of datePatterns) {
      const m = line.match(p);
      if (m) {
        const d = parseDate(m[1]);
        if (!isNaN(d.getTime())) {
          foundDate = d;
          dateStr = m[1];
          break;
        }
      }
    }

    if (foundDate) {
      if (currentTx && currentTx.date && currentTx.amount) {
        rows.push(currentTx as ParsedRow);
      }

      currentTx = {
        date: foundDate,
        description: line.replace(dateStr, "").trim(),
        rowIndex: rows.length + 1,
        isExcluded: false,
        rawData: line,
      };

      const amountsFound = line.match(amountPattern) || [];
      const parsedAmounts = amountsFound
        .map((a) => ({ original: a, value: Math.abs(parseFloat(a.replace(/,/g, ""))) }))
        .filter((a) => a.value > 0.01);

      if (parsedAmounts.length > 0) {
        currentTx.amount = parsedAmounts[0].value;
        if (parsedAmounts.length >= 2) {
          currentTx.balance = parsedAmounts[parsedAmounts.length - 1].value;
          if (parsedAmounts.length >= 3) {
            currentTx.amount = Math.max(parsedAmounts[0].value, parsedAmounts[1].value);
          }
        }
      }

      currentTx.reference = extractReference(line);
      currentTx.mode = detectTransactionMode(line);
      currentTx.time = extractTime(line);
      currentTx.type =
        txTypeOverride ||
        (line.toLowerCase().match(/payout|paid|withdrawal|dr|debit|outward|transfer to|sent/)
          ? TxType.PAYOUT
          : TxType.PAYIN);
    } else if (currentTx) {
      currentTx.description += " " + line;
      currentTx.rawData += "\n" + line;

      const amountsFound = line.match(amountPattern) || [];
      const parsedAmounts = amountsFound
        .map((a) => ({ original: a, value: Math.abs(parseFloat(a.replace(/,/g, ""))) }))
        .filter((a) => a.value > 0.01);

      if (parsedAmounts.length > 0 && !currentTx.amount) {
        currentTx.amount = parsedAmounts[0].value;
        if (parsedAmounts.length >= 2) {
          currentTx.balance = parsedAmounts[parsedAmounts.length - 1].value;
        }
      }

      if (!currentTx.reference) currentTx.reference = extractReference(line);
      if (!currentTx.mode) currentTx.mode = detectTransactionMode(line);
    }
  }

  if (currentTx && currentTx.date && currentTx.amount) {
    rows.push(currentTx as ParsedRow);
  }

  // Clean descriptions
  rows.forEach((row) => {
    if (row.reference) row.description = row.description.replace(row.reference, "");
    const amounts = row.description.match(amountPattern) || [];
    amounts.forEach((a) => (row.description = row.description.replace(a, "")));
    row.description = row.description.replace(/\s+/g, " ").trim();
    if (!row.description) row.description = "Transaction";
  });

  return rows;
}
