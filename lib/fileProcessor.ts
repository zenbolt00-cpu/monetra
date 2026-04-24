import * as XLSX from "xlsx";
import { TxType, FileType } from "@prisma/client";
import { detectColumns } from "./columnDetector";

// Dynamic import for pdf-parse to avoid top-level issues on Vercel
let PDFParseClass: any = null;

// Types and interfaces

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
  vendor_name?: string | null;
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
 *  HIGH-PRECISION COORDINATE-BASED PDF PARSER
 *  Reconstructs tables by analyzing (x,y) text positions.
 * ────────────────────────────────────────────────────────── */
async function extractHighPrecisionTables(buffer: Buffer): Promise<string[][][]> {
  // Use legacy build for Node.js environments to prevent "Object.defineProperty called on non-object" errors
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Set worker to local path for Node.js
  const path = require("path");
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const allTables: string[][][] = [];
  let masterColBoundaries: number[] = [];

  console.log(`[PDF Engine] Total Pages to parse: ${pdf.numPages}`);

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as any[];

    if (items.length === 0) {
      console.log(`[PDF Engine] Page ${i} is empty, skipping.`);
      continue;
    }

    // Group items into rows based on Y coordinate
    const rowsMap = new Map<number, any[]>();
    const rowTolerance = 5;

    items.forEach(item => {
      const y = Math.round(item.transform[5] / rowTolerance) * rowTolerance;
      if (!rowsMap.has(y)) rowsMap.set(y, []);
      rowsMap.get(y)!.push(item);
    });

    const sortedY = Array.from(rowsMap.keys()).sort((a, b) => b - a);
    
    // 1. Identify the best header row on THIS page
    let pageHeaderY = -1;
    let maxHeaderScore = 0;
    const headerKeywords = ["date", "particulars", "description", "narration", "ref", "utr", "chq", "withdrawal", "deposit", "debit", "credit", "amount", "balance"];
    
    for (const y of sortedY) {
      const rowText = rowsMap.get(y)!.map(it => it.str.toLowerCase()).join(" ");
      const score = headerKeywords.filter(k => rowText.includes(k)).length;
      if (score > maxHeaderScore && score >= 2) {
        maxHeaderScore = score;
        pageHeaderY = y;
      }
    }

    // 2. If we found a clear header, update the master boundaries
    if (pageHeaderY !== -1) {
      const headerItems = rowsMap.get(pageHeaderY)!.sort((a, b) => a.transform[4] - b.transform[4]);
      masterColBoundaries = headerItems.map(it => it.transform[4]);
      console.log(`[PDF Engine] Page ${i}: Found header, updated boundaries.`);
    } else if (masterColBoundaries.length === 0) {
      // 3. Fallback to clustering ONLY if we haven't found any boundaries yet
      const allX = items.map(it => it.transform[4]).sort((a, b) => a - b);
      if (allX.length > 0) {
        let currentGroup = [allX[0]];
        for (let j = 1; j < allX.length; j++) {
          if (allX[j] - allX[j-1] < 15) {
            currentGroup.push(allX[j]);
          } else {
            masterColBoundaries.push(currentGroup.reduce((a, b) => a + b, 0) / currentGroup.length);
            currentGroup = [allX[j]];
          }
        }
        masterColBoundaries.push(currentGroup.reduce((a, b) => a + b, 0) / currentGroup.length);
        console.log(`[PDF Engine] Page ${i}: No header, used clustering for boundaries.`);
      }
    }

    const pageData: string[][] = [];
    if (masterColBoundaries.length > 0) {
      for (const y of sortedY) {
        const rowItems = rowsMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
        const rowData = new Array(masterColBoundaries.length).fill("");
        
        rowItems.forEach(item => {
          const x = item.transform[4];
          let bestCol = 0;
          let minDiff = Math.abs(x - masterColBoundaries[0]);
          for (let k = 1; k < masterColBoundaries.length; k++) {
            const diff = Math.abs(x - masterColBoundaries[k]);
            if (diff < minDiff) {
              minDiff = diff;
              bestCol = k;
            }
          }
          rowData[bestCol] = (rowData[bestCol] + " " + item.str).trim();
        });

        if (rowData.filter(c => c.length > 0).length >= 2) {
          pageData.push(rowData);
        }
      }
    }
    
    if (pageData.length > 0) {
      allTables.push(pageData);
      console.log(`[PDF Engine] Page ${i}: Extracted ${pageData.length} rows.`);
    }
  }

  return allTables;
}

export async function processPDF(
  buffer: Buffer,
  txTypeOverride?: TxType
): Promise<{ rows: ParsedRow[]; headers: string[] }> {
  // Scoped polyfill for DOMMatrix and navigator in Node.js
  if (typeof globalThis !== "undefined") {
    if (!(globalThis as any).navigator) (globalThis as any).navigator = { userAgent: "node" };
    if (!(globalThis as any).DOMMatrix) {
      (globalThis as any).DOMMatrix = class DOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        m11 = 1; m12 = 0; m13 = 0; m14 = 0; m21 = 0; m22 = 1; m23 = 0; m24 = 0;
        m31 = 0; m32 = 0; m33 = 1; m34 = 0; m41 = 0; m42 = 0; m43 = 0; m44 = 1;
        is2D = true; isIdentity = true;
        constructor(init?: any) { if (Array.isArray(init) && init.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init; }
        toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
      };
    }
  }

  console.log("[PDF Engine] Starting High-Precision Coordinate Extraction...");

  const headers = ["Date", "Description", "Reference", "Amount", "Type", "Balance", "Mode"];
  let rows: ParsedRow[] = [];

  try {
    // 1. Primary Strategy: High-Precision Coordinate-based Reconstruction
    const tables = await extractHighPrecisionTables(buffer);
    if (tables.length > 0) {
      rows = extractFromTables(tables, txTypeOverride);
      console.log(`[PDF Engine] Coordinate extraction found ${rows.length} transactions.`);
    }

    // 2. Fallback: Standard PDF-Parse (if HP failed or returned zero rows)
    if (rows.length === 0) {
      console.log("[PDF Engine] HP failed or empty, using standard parser...");
      if (!PDFParseClass) {
        const mod: any = await import("pdf-parse");
        PDFParseClass = mod.PDFParse || mod.default?.PDFParse || mod.default;
      }
      
      let parser;
      if (typeof PDFParseClass === "function" && PDFParseClass.prototype?.constructor) {
        parser = new PDFParseClass({ data: new Uint8Array(buffer) } as any);
        const tableResult = await parser.getTable();
        if (tableResult?.pages?.length > 0) {
          const allTables: string[][][] = [];
          for (const page of tableResult.pages) {
            if (page.tables?.length > 0) allTables.push(...page.tables);
          }
          rows = extractFromTables(allTables, txTypeOverride);
        }
        await parser.destroy();
      }
    }

    // 3. Last Resort: Raw Text Parsing
    if (rows.length === 0) {
      console.log("[PDF Engine] Table parsing failed, trying raw text...");
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
      const pdf = await loadingTask.promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((it: any) => it.str).join(" ") + "\n";
      }
      rows = extractFromText(fullText, txTypeOverride);
    }

  } catch (err: any) {
    console.error("[PDF Engine] Global Extraction Error:", err);
    throw new Error(`PDF Parsing Error: ${err.message}. Please ensure the PDF is not password protected.`);
  }

  // Post-process: Deduplicate and clean
  rows = rows.filter(r => r.amount > 0 && r.date);
  
  return { rows, headers };
}

/* ──────────────────────────────────────────────────────────
 *  Extract from Tables with Multi-Page Awareness
 * ────────────────────────────────────────────────────────── */
function extractFromTables(tables: string[][][], txTypeOverride?: TxType): ParsedRow[] {
  const allParsedRows: ParsedRow[] = [];
  let currentMapping: any = null;

  for (const table of tables) {
    if (!table || table.length < 1) continue;

    // Detect columns for each table segment (in case mapping changes)
    const headerLimit = Math.min(table.length, 5);
    let mapping: any = null;
    let headerIdx = -1;

    for (let i = 0; i < headerLimit; i++) {
      const m = detectColumns(table[i]);
      if (m.date && (m.amount || m.credit || m.debit)) {
        mapping = m;
        headerIdx = i;
        break;
      }
    }

    if (!mapping && currentMapping) {
      mapping = currentMapping; // Use previous table's mapping if this looks like a continuation
    } else if (mapping) {
      currentMapping = mapping;
    }

    if (!mapping) continue;

    const startRow = headerIdx === -1 ? 0 : headerIdx + 1;
    const headers = table[headerIdx === -1 ? 0 : headerIdx];

    const getCol = (key: string) => headers.findIndex(h => h.toLowerCase().includes(key.toLowerCase()));
    
    // Better column finding based on detected mapping
    const dateIdx = headers.indexOf(mapping.date);
    const descIdx = headers.indexOf(mapping.description);
    const amountIdx = headers.indexOf(mapping.amount);
    const creditIdx = headers.indexOf(mapping.credit);
    const debitIdx = headers.indexOf(mapping.debit);
    const balanceIdx = headers.indexOf(mapping.balance);
    const refIdx = headers.indexOf(mapping.reference);

    for (let r = startRow; r < table.length; r++) {
      const row = table[r];
      const dateStr = dateIdx >= 0 ? row[dateIdx] : "";
      if (!dateStr || dateStr.length < 5) {
        // Multi-line description support
        if (allParsedRows.length > 0 && descIdx >= 0 && row[descIdx]) {
          allParsedRows[allParsedRows.length - 1].description += " " + row[descIdx];
        }
        continue;
      }

      const date = parseDate(dateStr);
      if (isNaN(date.getTime())) continue;

      let amount = 0;
      let type: TxType = TxType.PAYIN;

      // Priority 1: Check separate credit/debit columns
      if (creditIdx >= 0 && row[creditIdx]) {
        const val = parseNumber(row[creditIdx]);
        if (!isNaN(val) && val !== 0) {
          amount = val;
          type = TxType.PAYIN;
        }
      }
      
      if (amount === 0 && debitIdx >= 0 && row[debitIdx]) {
        const val = parseNumber(row[debitIdx]);
        if (!isNaN(val) && val !== 0) {
          amount = val;
          type = TxType.PAYOUT;
        }
      }

      // Priority 2: Single amount column with a type/indicator column
      if (amount === 0 && amountIdx >= 0 && row[amountIdx]) {
        const val = parseNumber(row[amountIdx]);
        if (!isNaN(val) && val !== 0) {
          amount = Math.abs(val);
          // Check for indicator in the same cell or separate type column
          const rawAmountStr = String(row[amountIdx]).toLowerCase();
          const typeStr = mapping.type ? String(row[headers.indexOf(mapping.type)] || "").toLowerCase() : "";
          
          if (rawAmountStr.includes("cr") || typeStr.includes("cr") || typeStr.includes("credit") || typeStr.includes("deposit") || typeStr.includes("payin")) {
            type = TxType.PAYIN;
          } else if (rawAmountStr.includes("dr") || typeStr.includes("dr") || typeStr.includes("debit") || typeStr.includes("withdrawal") || typeStr.includes("payout")) {
            type = TxType.PAYOUT;
          } else {
            type = val < 0 ? TxType.PAYOUT : TxType.PAYIN;
          }
        }
      }

      if (amount === 0) continue;
      if (txTypeOverride) type = txTypeOverride;

      const description = descIdx >= 0 ? row[descIdx].trim() : "Transaction";
      const reference = refIdx >= 0 ? row[refIdx].trim() : extractReference(description + " " + row.join(" "));
      const balance = balanceIdx >= 0 ? parseNumber(row[balanceIdx]) : undefined;

      allParsedRows.push({
        date,
        amount,
        description,
        reference: reference || undefined,
        type,
        balance: isNaN(balance as number) ? undefined : balance,
        rowIndex: allParsedRows.length + 1,
        rawData: row,
        isExcluded: false,
        mode: detectTransactionMode(description),
        vendor_name: description.split(" ").slice(0, 2).join(" ")
      });
    }
  }

  return allParsedRows;
}

/* ──────────────────────────────────────────────────────────
 *  Intelligent Text Parsing (Regex Based Engine)
 * ────────────────────────────────────────────────────────── */
function extractFromText(text: string, txTypeOverride?: TxType): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  // Common Bank Statement Regex Patterns
  const datePatterns = [
    /(\d{1,2}[/\-. ](?:0?[1-9]|1[0-2]|[A-Z]{3,9})[/\-. ](?:\d{4}|\d{2}))/i,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/i,
    /(\d{4}[/\-.](?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01]))/,
  ];
  
  const amountPattern = /(?:\s|^)(-?\d{1,3}(?:,\d{3})*(?:\.\d{2}))(?:\s|$)/g;

  let currentTx: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 1. Detect Date
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
      // Save previous if valid
      if (currentTx && currentTx.amount) rows.push(currentTx);

      // Start new transaction
      currentTx = {
        date: foundDate,
        description: line.replace(dateStr, "").trim(),
        rowIndex: rows.length + 1,
        isExcluded: false,
        rawData: line,
        type: TxType.PAYIN, // Default
      };

      // 2. Detect Amounts in the same line
      const amounts = Array.from(line.matchAll(amountPattern));
      if (amounts.length > 0) {
        const firstAmount = parseNumber(amounts[0][1]);
        currentTx.amount = Math.abs(firstAmount);
        currentTx.type = firstAmount < 0 ? TxType.PAYOUT : TxType.PAYIN;
        
        if (amounts.length >= 2) {
          const secondAmount = parseNumber(amounts[amounts.length - 1][1]);
          currentTx.balance = Math.abs(secondAmount);
          // If first is smaller than second, first is likely the tx amount and second is balance
        }
      }

      // 3. Extract Reference
      currentTx.reference = extractReference(line);
      currentTx.mode = detectTransactionMode(line);
      
      // Simple vendor name heuristic
      currentTx.vendor_name = currentTx.description.split(/[\/\-\s]/).filter((w: string) => w.length > 2 && !/^\d+$/.test(w)).slice(0, 2).join(" ");
      
      if (txTypeOverride) currentTx.type = txTypeOverride;
      else {
        // Heuristic for type based on keywords
        if (line.toLowerCase().match(/payout|paid|withdrawal|dr|debit|outward|sent/)) {
          currentTx.type = TxType.PAYOUT;
        }
      }
    } else if (currentTx) {
      // Continuation line
      currentTx.description += " " + line;
      
      // Check for amounts if not found in first line
      if (!currentTx.amount) {
        const amounts = Array.from(line.matchAll(amountPattern));
        if (amounts.length > 0) {
          const firstAmount = parseNumber(amounts[0][1]);
          currentTx.amount = Math.abs(firstAmount);
          currentTx.type = firstAmount < 0 ? TxType.PAYOUT : TxType.PAYIN;
        }
      }
      
      if (!currentTx.reference) currentTx.reference = extractReference(line);
    }
  }

  if (currentTx && currentTx.amount) rows.push(currentTx);

  return rows;
}

