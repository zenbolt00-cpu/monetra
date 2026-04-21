import * as XLSX from "xlsx";
import { TxType, FileType } from "@prisma/client";
import { detectColumns } from "./columnDetector";

// Shim DOMMatrix for Node.js environments to prevent pdfjs-dist errors
if (typeof global !== "undefined" && typeof (global as any).DOMMatrix === "undefined") {
  (global as any).DOMMatrix = class DOMMatrix {
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    constructor(arg?: any) {
      if (typeof arg === "string") {
        // Very basic parsing for simple matrix strings if needed
      }
    }
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
  const str = String(val).trim();
  // Remove currency symbols and spaces
  const cleaned = str.replace(/[₹$€£¥,\s]+/g, "").replace(/^[(-]+|[)]+$/g, "");
  const num = parseFloat(cleaned);
  // Handle parenthetical negatives: (1234.00) → -1234.00
  if (str.startsWith("(") && str.endsWith(")")) return -Math.abs(num);
  // Handle trailing minus: 1234.00-
  if (str.endsWith("-") && !str.startsWith("-")) return -Math.abs(num);
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
  /(?:UTR|UTR\s*(?:NO|NUMBER|ID|#)?|REF|REF\s*(?:NO|NUMBER|ID|#)?|REFERENCE|TRANS(?:ACTION)?\s*(?:NO|NUMBER|ID|#)?|TXN\s*(?:NO|NUMBER|ID|#)?|PAYMENT\s*(?:NO|NUMBER|ID|#)?|INSTRUMENT\s*(?:NO|NUMBER|ID|#)?|RECEIPT\s*(?:NO|NUMBER|ID)?|VOUCHER\s*(?:NO|NUMBER|#)?|CHEQUE\s*(?:NO|NUMBER|#)?|CHQ\s*(?:NO|#)?|CMS\s*(?:REF)?|RRN|ARN)\s*[:.#\-]?\s*([A-Za-z0-9]{6,30})/i,

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

  for (const pattern of UTR_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const ref = match[1].trim();
      // Validate: not a date, not too short, not all zeros
      if (
        ref.length >= 6 &&
        !/^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$/.test(ref) &&
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
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    const nonEmptyCells = row.filter((cell: any) => String(cell || "").trim().length > 0);
    if (nonEmptyCells.length >= 3) {
      // Check if this looks like a header row (contains recognizable column names)
      const rowText = row.map((c: any) => String(c || "").toLowerCase().trim()).join(" ");
      const headerKeywords = ["date", "amount", "credit", "debit", "description", "narration", "balance", "ref", "utr", "particulars", "withdrawal", "deposit"];
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
        if (["cr", "credit", "c", "payin", "pay-in", "receipt", "received"].includes(typeVal)) {
          type = TxType.PAYIN;
        } else if (["dr", "debit", "d", "payout", "pay-out", "payment", "paid"].includes(typeVal)) {
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
 *  PDF PROCESSOR – Enhanced multi-strategy extraction
 * ────────────────────────────────────────────────────────── */
export async function processPDF(
  buffer: Buffer,
  txTypeOverride?: TxType
): Promise<{ rows: ParsedRow[]; headers: string[] }> {
  let textContent = "";

  // Strategy 1: Use pdfjs-dist for reliable text extraction
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      // Sort items by Y position (top to bottom) then X position (left to right)
      const items = content.items as any[];
      const lines: Map<number, { x: number; text: string }[]> = new Map();

      for (const item of items) {
        if (!item.str || item.str.trim().length === 0) continue;
        // Round Y coordinate to group items on the same line (within 3px tolerance)
        const yKey = Math.round(item.transform[5] / 3) * 3;
        if (!lines.has(yKey)) lines.set(yKey, []);
        lines.get(yKey)!.push({
          x: item.transform[4],
          text: item.str,
        });
      }

      // Sort lines by Y (descending since PDF coordinates are bottom-up)
      const sortedYKeys = Array.from(lines.keys()).sort((a, b) => b - a);

      for (const yKey of sortedYKeys) {
        const lineItems = lines.get(yKey)!.sort((a, b) => a.x - b.x);
        const lineText = lineItems.map((item) => item.text).join(" ");
        pages.push(lineText);
      }
    }

    textContent = pages.join("\n");
  } catch (pdfjsErr) {
    console.log("[PDF] pdfjs-dist extraction failed, trying pdf-parse fallback:", pdfjsErr);

    // Strategy 2: Fallback to pdf-parse v2 (class-based API)
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      textContent = textResult.text || "";
      await parser.destroy().catch(() => {});
    } catch (parseErr) {
      console.error("[PDF] All extraction strategies failed:", parseErr);
      return { rows: [], headers: ["Date", "Description", "Reference", "Amount", "Balance"] };
    }
  }

  const headers = ["Date", "Description", "Reference", "Amount", "Type", "Balance", "Mode"];
  const rows: ParsedRow[] = [];

  if (!textContent || textContent.trim().length === 0) {
    return { rows, headers };
  }

  const lines = textContent.split("\n");

  // Date patterns for matching banking statements
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    /(?:^|\s)(\d{1,2}[/\-.](?:0?[1-9]|1[0-2])[/\-.](?:\d{4}|\d{2}))(?=\s|$)/,
    // DD MMM YYYY or DD-MMM-YYYY
    /(?:^|\s)(\d{1,2}\s*[/\-.\s]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[/\-.\s]\s*\d{2,4})(?=\s|$)/i,
    // YYYY-MM-DD
    /(?:^|\s)(\d{4}[/\-.](?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01]))(?=\s|$)/,
    // MMM DD, YYYY
    /(?:^|\s)((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s*\d{4})(?=\s|$)/i,
  ];

  // Amount pattern: numbers with optional commas and exactly 2 decimal places
  const amountPattern = /-?(?:\d{1,3}(?:,\d{2,3})*|\d+)\.\d{2}/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 10) continue;

    // Skip header-like lines
    const lowerLine = trimmed.toLowerCase();
    if (
      lowerLine.includes("opening balance") ||
      lowerLine.includes("closing balance") ||
      lowerLine.includes("statement of account") ||
      lowerLine.includes("page no") ||
      lowerLine.includes("printed on") ||
      /^(date|txn\s*date|value\s*date)\s+(description|narration|particulars)/i.test(trimmed)
    ) {
      continue;
    }

    // Try to match a date at the beginning of the line
    let dateStr: string | null = null;
    let dateEndIndex = 0;

    for (const pattern of datePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        dateStr = match[1];
        dateEndIndex = (match.index || 0) + match[0].length;
        break;
      }
    }

    if (!dateStr) continue;

    const date = parseDate(dateStr);
    if (isNaN(date.getTime())) continue;

    // Extract the content after the date
    const afterDate = trimmed.substring(dateEndIndex).trim();

    // Find all amounts in the line
    const allAmounts = afterDate.match(amountPattern);
    if (!allAmounts || allAmounts.length === 0) continue;

    // Parse amounts, filtering out likely non-amount values
    const parsedAmounts = allAmounts
      .map((m) => ({
        original: m,
        value: parseFloat(m.replace(/,/g, "")),
      }))
      .filter((a) => !isNaN(a.value) && Math.abs(a.value) >= 0.01);

    if (parsedAmounts.length === 0) continue;

    // Extract reference/UTR
    const reference = extractReference(trimmed);

    // Build description: text between date and first amount
    let description = afterDate;
    const firstAmountIdx = description.indexOf(parsedAmounts[0].original);
    if (firstAmountIdx > 0) {
      description = description.substring(0, firstAmountIdx).trim();
    }

    // Clean up description
    if (reference) {
      // Remove the reference from description to avoid duplication
      description = description.replace(new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), "").trim();
    }
    description = description
      .replace(/\s{2,}/g, " ")
      .replace(/[:.]+$/, "")
      .trim();

    // Determine amount and balance
    let amount: number = 0;
    let balance: number | undefined;

    if (parsedAmounts.length >= 3) {
      // Three or more: likely credit, debit, balance → pick the non-zero transaction amount
      const credit = parsedAmounts[0].value;
      const debit = parsedAmounts[1].value;
      balance = parsedAmounts[parsedAmounts.length - 1].value;

      if (credit > 0 && (debit === 0 || isNaN(debit))) {
        amount = credit;
      } else if (debit > 0 && (credit === 0 || isNaN(credit))) {
        amount = debit;
      } else {
        // If both non-zero, take the larger as transaction amount
        amount = Math.max(credit, debit);
      }
    } else if (parsedAmounts.length === 2) {
      // Two amounts: amount + balance
      amount = parsedAmounts[0].value;
      balance = parsedAmounts[1].value;
    } else {
      amount = parsedAmounts[0].value;
    }

    if (isNaN(amount) || amount === 0) continue;

    // Detect transaction mode
    const mode = detectTransactionMode(trimmed);

    // Extract time
    const time = extractTime(trimmed);

    // Determine type
    let type: TxType;
    if (txTypeOverride) {
      type = txTypeOverride;
    } else {
      const descLower = (description + " " + afterDate).toLowerCase();

      // Keyword-based classification
      const debitKeywords = [
        "debit", "withdrawal", "withdraw", "paid", "payment",
        "transfer to", "sent", "neft cr", "outward", "purchase",
        "charges", "fee", "commission", "tax", "tds", "gst",
      ];
      const creditKeywords = [
        "credit", "deposit", "received", "transfer from",
        "refund", "pay-in", "payin", "inward", "receipt",
        "interest", "dividend", "cashback",
      ];

      const isDebit = debitKeywords.some((k) => descLower.includes(k));
      const isCredit = creditKeywords.some((k) => descLower.includes(k));

      if (isDebit && !isCredit) {
        type = TxType.PAYOUT;
      } else if (isCredit && !isDebit) {
        type = TxType.PAYIN;
      } else {
        // Use position heuristic: in many bank statements, credits and debits 
        // appear in different columns (different X positions)
        type = amount >= 0 ? TxType.PAYIN : TxType.PAYOUT;
      }
    }

    rows.push({
      date,
      amount: Math.abs(amount),
      description: description || "No description provided",
      reference,
      type,
      balance: balance && !isNaN(balance) ? Math.abs(balance) : undefined,
      cellColor: undefined,
      rowIndex: rows.length + 1,
      rawData: { lineText: trimmed, dateStr, mode, time },
      isExcluded: false,
      mode,
      time,
    });
  }

  return { rows, headers };
}
