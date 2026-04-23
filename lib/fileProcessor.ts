import * as XLSX from "xlsx";
import { TxType, FileType } from "@prisma/client";
import { detectColumns } from "./columnDetector";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
async function processWithAI(text: string, txTypeOverride?: TxType): Promise<ParsedRow[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not found. Falling back to heuristic parsing.");
    return [];
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.1, // Low temperature for high precision
        topP: 0.95,
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      You are the Monetra Document Intelligence Engine, powered by Google's most advanced financial knowledge.
      Your goal is to extract EXACT and CORRECT transaction data from the provided bank statement text.

      MONETRA KNOWLEDGE BASE (INDIAN BANKING):
      - UPI: Usually looks like "UPI-ID-Name" or "UPI/123456789012/Narration". The 12-digit number is the RRN (Reference Number).
      - NEFT/RTGS: Often starts with a bank code (e.g., SBIN, HDFC, ICIC) followed by a 10-16 character alphanumeric UTR.
      - IMPS: Usually has a 12-digit RRN similar to UPI.
      - CHEQUE: Look for "CHQ NO", "CHEQUE NO" or 6-digit standalone numbers.
      - CHARGES: "CONSOLIDATED CHARGES", "GST", "ANNUAL FEE" are PAYOUTs.
      - INTEREST: "INTEREST PAID", "INT.CREDIT" are PAYINs.

      JSON STRUCTURE (STRICT):
      [
        {
          "date": "YYYY-MM-DD",
          "amount": number (Positive only),
          "description": "Cleaned narration without the reference number",
          "reference": "Clean UTR/RRN/Ref number",
          "type": "PAYIN" | "PAYOUT",
          "balance": number (Optional),
          "mode": "UPI" | "NEFT" | "IMPS" | "CASH" | "CHEQUE" | "TRANSFER"
        }
      ]

      RULES:
      1. Extraction must be 100% exact. Do not hallucinate.
      2. If a reference number is found inside a description, extract it into the "reference" field and remove it from "description".
      3. ${txTypeOverride ? `FORCE: All transactions are ${txTypeOverride}.` : "Deduce type from keywords like 'Cr', 'Dr', 'Deposit', 'Withdrawal', 'Sent to', 'Received from'."}
      4. Ensure all amounts are numeric. No commas or currency symbols.

      RAW STATEMENT TEXT:
      ${text.substring(0, 40000)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().trim();
    const data = JSON.parse(jsonText);

    return data.map((item: any, index: number) => ({
      date: new Date(item.date),
      amount: item.amount,
      description: item.description,
      reference: item.reference,
      type: item.type === "PAYOUT" ? TxType.PAYOUT : TxType.PAYIN,
      balance: item.balance,
      mode: item.mode,
      rowIndex: index + 1,
      isExcluded: false,
      rawData: JSON.stringify(item)
    }));
  } catch (error) {
    console.error("Gemini 1.5 Pro Extraction failed:", error);
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
  let textContent = "";

  // Strategy 1: Use pdfjs-dist for reliable text extraction
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // Disable worker for simpler Node.js execution if possible
    if ((pdfjsLib as any).GlobalWorkerOptions) {
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = false;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      // NEW: Collect all text items with their coordinates
      const items = content.items as any[];
      if (items.length === 0) continue;

      // Sort by Y (top to bottom), then X (left to right)
      // PDF Y is bottom-up, so we invert it for logical sorting
      items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff; // Different line
        return a.transform[4] - b.transform[4]; // Same line, left to right
      });

      // Group into lines with smart merging
      const lines: string[] = [];
      let currentLineY = items[0].transform[5];
      let currentLineText = "";

      for (const item of items) {
        const y = item.transform[5];
        if (Math.abs(y - currentLineY) > 5) {
          // New line
          if (currentLineText.trim()) lines.push(currentLineText);
          currentLineY = y;
          currentLineText = item.str;
        } else {
          // Same line - add space if there's a gap
          currentLineText += (item.str.startsWith(" ") ? "" : " ") + item.str;
        }
      }
      if (currentLineText.trim()) lines.push(currentLineText);
      pages.push(...lines);
    }

    textContent = pages.join("\n");
  } catch (pdfjsErr) {
    console.log("[PDF] pdfjs-dist failed, trying fallback:", pdfjsErr);
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      textContent = textResult.text || "";
      await parser.destroy().catch(() => {});
    } catch (parseErr) {
      return { rows: [], headers: ["Date", "Description", "Reference", "Amount", "Balance"] };
    }
  }

  const headers = ["Date", "Description", "Reference", "Amount", "Type", "Balance", "Mode"];
  const rows: ParsedRow[] = [];

  if (!textContent || textContent.trim().length === 0) return { rows, headers };

  const lines = textContent.split("\n");
  
  // Date Patterns - Very aggressive to catch any Indian bank format
  const datePatterns = [
    /(\d{1,2}[/\-. ](?:0?[1-9]|1[0-2]|[A-Z]{3,9})[/\-. ](?:\d{4}|\d{2}))/i,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/i,
    /(\d{4}[/\-.](?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01]))/
  ];

  // Amount Pattern - Catch integers or decimals with commas
  const amountPattern = /-?(?:\d{1,3}(?:,\d{2,3})*|\d+)(?:\.\d{1,2})?\b/g;

  // AGGRESSIVE EXTRACTION LOOP
  let currentTx: Partial<ParsedRow> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length < 5) continue;

    // Check for date in this line
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
      // If we already have a transaction being built, push it
      if (currentTx && currentTx.date && currentTx.amount) {
        rows.push(currentTx as ParsedRow);
      }

      // Start new transaction
      currentTx = {
        date: foundDate,
        description: line.replace(dateStr, "").trim(),
        rowIndex: rows.length + 1,
        isExcluded: false,
        rawData: line
      };

      // Extract amounts from this line
      const amountsFound = line.match(amountPattern) || [];
      const parsedAmounts = amountsFound
        .map(a => ({ original: a, value: Math.abs(parseFloat(a.replace(/,/g, ""))) }))
        .filter(a => a.value > 0.01);

      if (parsedAmounts.length > 0) {
        // Heuristic: Last is usually balance, first is amount
        currentTx.amount = parsedAmounts[0].value;
        if (parsedAmounts.length >= 2) {
          currentTx.balance = parsedAmounts[parsedAmounts.length - 1].value;
          if (parsedAmounts.length >= 3) {
            // [Credit, Debit, Balance] - pick the larger one as amount
            currentTx.amount = Math.max(parsedAmounts[0].value, parsedAmounts[1].value);
          }
        }
      }

      // Extract Reference & Mode
      currentTx.reference = extractReference(line);
      currentTx.mode = detectTransactionMode(line);
      currentTx.time = extractTime(line);

      // Determine Type
      currentTx.type = txTypeOverride || (line.toLowerCase().match(/payout|paid|withdrawal|dr|debit|outward|transfer to|sent/) ? TxType.PAYOUT : TxType.PAYIN);
    } else if (currentTx) {
      // This line doesn't have a date, but it might be a continuation of the previous description
      // or contain the amount if it was missing on the date line
      currentTx.description += " " + line;
      currentTx.rawData += "\n" + line;

      const amountsFound = line.match(amountPattern) || [];
      const parsedAmounts = amountsFound
        .map(a => ({ original: a, value: Math.abs(parseFloat(a.replace(/,/g, ""))) }))
        .filter(a => a.value > 0.01);

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

  // Push the last one
  if (currentTx && currentTx.date && currentTx.amount) {
    rows.push(currentTx as ParsedRow);
  }

  // Post-processing: clean descriptions
  rows.forEach(row => {
    if (row.reference) row.description = row.description.replace(row.reference, "");
    // Remove amount strings from description
    const amounts = row.description.match(amountPattern) || [];
    amounts.forEach(a => row.description = row.description.replace(a, ""));
    row.description = row.description.replace(/\s+/g, " ").trim();
    if (!row.description) row.description = "Transaction";
  });

  // Heuristic parsing finished. If it failed to find any rows, try AI.
  if (rows.length === 0 && textContent.length > 50 && process.env.GEMINI_API_KEY) {
    console.log("[PDF] Heuristic failed. Engaging AI Engine...");
    const aiRows = await processWithAI(textContent, txTypeOverride);
    if (aiRows.length > 0) return { rows: aiRows, headers: ["Date", "Description", "Reference", "Amount", "Type", "Balance", "Mode"] };
  }

  return { rows, headers };
}
