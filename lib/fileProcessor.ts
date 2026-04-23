import * as XLSX from "xlsx";
import { TxType, FileType } from "@prisma/client";
import { detectColumns } from "./columnDetector";
import { GoogleGenerativeAI } from "@google/generative-ai";
import PDFParse from "pdf-parse";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
 *  AI-POWERED EXTRACTION ENGINE (Gemini)
 * ────────────────────────────────────────────────────────── */
async function processWithAI(input: string | Buffer, txTypeOverride?: TxType, isPDF: boolean = false): Promise<ParsedRow[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`[AI] Checking API Key... ${apiKey ? `Exists (length: ${apiKey.length})` : "MISSING"}`);
  
  if (!apiKey) {
    console.error("[AI] Critical: GEMINI_API_KEY is missing from environment.");
    return [];
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        responseMimeType: "application/json",
      }
    });

    let promptParts: any[] = [];
    if (isPDF && Buffer.isBuffer(input)) {
      console.log("[AI] Attempting Multimodal PDF Extraction...");
      promptParts = [
        {
          inlineData: {
            data: input.toString("base64"),
            mimeType: "application/pdf"
          }
        },
        {
          text: `Extract all transactions from this bank statement PDF. Return JSON array.
          Fields: date (YYYY-MM-DD), amount (number), description, reference, type (PAYIN/PAYOUT), mode.
          ${txTypeOverride ? `FORCE: All are ${txTypeOverride}.` : ""}`
        }
      ];
    } else {
      console.log("[AI] Attempting Text-based Extraction...");
      promptParts = [
        {
          text: `Extract transactions from this statement text:
          ${input.toString().substring(0, 50000)}
          Return JSON array. ${txTypeOverride ? `FORCE: ${txTypeOverride}` : ""}`
        }
      ];
    }

    const result = await model.generateContent({ contents: [{ role: "user", parts: promptParts }] });
    const response = await result.response;
    const text = response.text().trim();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    const transactions = Array.isArray(jsonData) ? jsonData : jsonData.transactions || [];

    console.log(`[AI] Successfully extracted ${transactions.length} rows.`);

    return transactions.map((item: any, index: number) => ({
      date: new Date(item.date),
      amount: Math.abs(Number(item.amount)),
      description: item.description || "Transaction",
      reference: item.reference || undefined,
      type: item.type === "PAYOUT" ? TxType.PAYOUT : TxType.PAYIN,
      mode: item.mode,
      rowIndex: index + 1,
      isExcluded: false,
      rawData: JSON.stringify(item)
    }));
  } catch (error) {
    console.error("[AI] Gemini Extraction Error:", error);
    return [];
  }
}

/* ──────────────────────────────────────────────────────────
 *  PDF PROCESSOR – Enhanced AI-like Extraction Engine
 * ────────────────────────────────────────────────────────── */
export async function processPDF(
  buffer: Buffer,
  txTypeOverride?: TxType
): Promise<{ rows: ParsedRow[]; headers: string[] }> {
  console.log("[PDF] Starting production extraction pipeline...");
  
  // Strategy 1: Multimodal Gemini (Robust for scanned/images)
  let rows = await processWithAI(buffer, txTypeOverride, true);
  
  // Strategy 2: Text-based fallback (If multimodal failed but text exists)
  if (rows.length === 0) {
    console.log("[PDF] Multimodal failed, trying text-based fallback...");
    try {
      const data = await PDFParse(buffer);
      if (data.text && data.text.trim().length > 20) {
        console.log(`[PDF] Extracted ${data.text.length} chars of text. Sending to AI...`);
        rows = await processWithAI(data.text, txTypeOverride, false);
      } else {
        console.warn("[PDF] No text extracted by pdf-parse.");
      }
    } catch (err) {
      console.error("[PDF] Text-based fallback error:", err);
    }
  }
  
  const headers = ["Date", "Description", "Reference", "Amount", "Type", "Balance", "Mode"];
  
  if (rows.length === 0) {
    console.error("[PDF] All extraction strategies failed.");
  }

  return { rows, headers };
}
