import * as XLSX from "xlsx";
import { TxType, FileType } from "@prisma/client";
import { detectColumns } from "./columnDetector";

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
}

function parseNumber(val: any): number {
  if (typeof val === "number") return val;
  if (!val) return NaN;
  return parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
}

function parseDate(val: any): Date {
  if (val instanceof Date) return val;
  if (!val) return new Date();

  // Try standard JS parsing first
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;

  const str = String(val).trim();

  // Try DD/MM/YYYY or DD-MM-YYYY format
  const slashParts = str.includes("/") ? str.split("/") : null;
  const dashParts = !slashParts ? str.split("-") : null;
  const parts = slashParts || dashParts;

  if (parts && parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000;

    if (
      year > 1900 &&
      month >= 0 &&
      month < 12 &&
      day > 0 &&
      day <= 31
    ) {
      return new Date(year, month, day);
    }
  }

  // Try DD MMM YYYY (e.g., "12 Apr 2023" or "12-Apr-2023")
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const dmy = str.match(
    /(\d{1,2})\s*[-\s]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-\s]\s*(\d{2,4})/i
  );
  if (dmy) {
    const day = parseInt(dmy[1]);
    const month = monthNames[dmy[2].toLowerCase()];
    let year = parseInt(dmy[3]);
    if (year < 100) year += 2000;
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }

  return new Date();
}

export async function processExcel(
  buffer: Buffer,
  fileType: FileType,
  txTypeOverride?: TxType
): Promise<{ rows: ParsedRow[]; headers: string[] }> {
  // Read workbook with cell styles enabled for color extraction
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellStyles: true,
    cellDates: true,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON with header row
  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (jsonData.length < 1) return { rows: [], headers: [] };

  const headers = (jsonData[0] as string[]).map((h) =>
    String(h || "").trim()
  );
  const mapping = detectColumns(headers);

  const rows: ParsedRow[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const rawRow = jsonData[i];
    if (!rawRow || rawRow.length === 0) continue;

    const rowData: any = {};
    headers.forEach((header, index) => {
      rowData[header] = rawRow[index];
    });

    // Color extraction from cell styles
    let cellColor: string | undefined;
    // Check multiple columns for color
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
      // Separate Credit/Debit columns (common in bank statements)
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
        continue; // Skip rows with no amount
      }
    } else if (mapping.amount) {
      // Single amount column
      const rawAmount = parseNumber(rowData[mapping.amount]);
      if (isNaN(rawAmount) || rawAmount === 0) continue;

      amount = Math.abs(rawAmount);

      // Check for a type column
      if (mapping.type) {
        const typeVal = String(rowData[mapping.type] || "")
          .toLowerCase()
          .trim();
        if (
          typeVal === "cr" ||
          typeVal === "credit" ||
          typeVal === "c" ||
          typeVal === "payin"
        ) {
          type = TxType.PAYIN;
        } else if (
          typeVal === "dr" ||
          typeVal === "debit" ||
          typeVal === "d" ||
          typeVal === "payout"
        ) {
          type = TxType.PAYOUT;
        } else {
          type = rawAmount >= 0 ? TxType.PAYIN : TxType.PAYOUT;
        }
      } else {
        // Determine from sign
        type = rawAmount >= 0 ? TxType.PAYIN : TxType.PAYOUT;
      }
    } else {
      continue; // No amount column found
    }

    // If user explicitly specified a type override, use it
    if (txTypeOverride) {
      type = txTypeOverride;
    }

    const dateValue = rowData[mapping.date || ""];
    const date = parseDate(dateValue);

    const description = String(
      rowData[mapping.description || ""] || "No description"
    ).trim();
    const reference = String(
      rowData[mapping.reference || ""] || ""
    ).trim();
    const balance = mapping.balance
      ? parseNumber(rowData[mapping.balance])
      : undefined;

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
    });
  }

  return { rows, headers };
}

export async function processPDF(
  buffer: Buffer,
  txTypeOverride?: TxType
): Promise<{ rows: ParsedRow[]; headers: string[] }> {
  // pdf-parse v2 uses a class-based API
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  const headers = ["Date", "Description", "Credit", "Debit", "Balance"];
  const rows: ParsedRow[] = [];

  // Try table extraction first (structured PDFs)
  try {
    const tableResult = await parser.getTable();
    if (tableResult && tableResult.pages) {
      for (const page of tableResult.pages) {
        if (!page.tables || page.tables.length === 0) continue;

        for (const table of page.tables) {
          if (!Array.isArray(table) || table.length < 2) continue;

          // Detect columns from the first row (header row)
          const headerRow = table[0].map((cell: any) =>
            String(cell || "").trim()
          );
          const mapping = (await import("./columnDetector")).detectColumns(
            headerRow
          );

          for (let i = 1; i < table.length; i++) {
            const row = table[i];
            if (!row || row.length === 0) continue;

            const rowData: Record<string, string> = {};
            headerRow.forEach((h: string, idx: number) => {
              rowData[h] = String(row[idx] || "").trim();
            });

            // Extract data using column mapping
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
              } else {
                continue;
              }
            } else if (mapping.amount) {
              const rawAmount = parseNumber(rowData[mapping.amount]);
              if (isNaN(rawAmount) || rawAmount === 0) continue;
              amount = Math.abs(rawAmount);
              type = rawAmount >= 0 ? TxType.PAYIN : TxType.PAYOUT;
            } else {
              continue;
            }

            if (txTypeOverride) type = txTypeOverride;

            const dateValue = rowData[mapping.date || ""];
            const date = parseDate(dateValue);
            if (isNaN(date.getTime())) continue;

            const description = String(
              rowData[mapping.description || ""] || "No description"
            ).trim();
            const reference = String(
              rowData[mapping.reference || ""] || ""
            ).trim();
            const balance = mapping.balance
              ? parseNumber(rowData[mapping.balance])
              : undefined;

            rows.push({
              date,
              amount,
              description,
              reference: reference || undefined,
              type,
              balance: balance && !isNaN(balance) ? balance : undefined,
              cellColor: undefined,
              rowIndex: rows.length + 1,
              rawData: rowData,
              isExcluded: false,
            });
          }
        }
      }
    }
  } catch (tableErr) {
    // Table extraction is optional — fall through to text extraction
    console.log("[PDF] Table extraction unavailable, using text extraction");
  }

  // If table extraction found rows, return them
  if (rows.length > 0) {
    await parser.destroy().catch(() => {});
    return { rows, headers };
  }

  // Fallback: text extraction (unstructured PDFs)
  try {
    const textResult = await parser.getText();
    const text = textResult.text || "";
    const lines = text.split("\n");

    // Robust date patterns for banking statements
    const datePattern =
      /(?:^|\s)(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s*[-\s]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-\s]\s*\d{2,4})(?=\s|$)/i;

    lines.forEach((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const dateMatch = trimmed.match(datePattern);
      if (!dateMatch) return;

      const dateStr = dateMatch[1];
      const date = parseDate(dateStr);

      if (isNaN(date.getTime())) return;

      // Isolate the remaining content after the date
      const idxDate = trimmed.indexOf(dateStr);
      const afterDate = trimmed.substring(idxDate + dateStr.length).trim();

      // Look for amounts: numbers with optional commas and decimal places
      const decimalMatchPattern = /-?\d{1,3}(?:,\d{3})*\.?\d{0,2}/g;
      const allMatches = afterDate.match(decimalMatchPattern);

      if (!allMatches || allMatches.length === 0) return;

      // Extract UTR/Reference using common patterns
      const utrPattern = /(?:UTR|REF|REFERENCE|TRANS|TXN|PAYMENT|INSTRUMENT)\s*(?:NO|ID|NUMBER|ID)?[:.]?\s*([A-Za-z0-9]{8,22})/i;
      const utrMatch = trimmed.match(utrPattern);
      const extractedRef = utrMatch ? utrMatch[1] : undefined;

      // Filter to meaningful amounts
      const decimals = allMatches.filter((m) => {
        const v = parseFloat(m.replace(/,/g, ""));
        // Filter out things that look like UTRs (if they match the decimal pattern accidentally)
        if (extractedRef && m.includes(extractedRef)) return false;
        return !isNaN(v) && Math.abs(v) >= 1;
      });

      if (decimals.length === 0) return;

      let amount: number = 0;
      let balance: number | undefined;

      if (decimals.length >= 2) {
        balance = parseFloat(
          decimals[decimals.length - 1].replace(/,/g, "")
        );
        amount = parseFloat(
          decimals[decimals.length - 2].replace(/,/g, "")
        );
      } else {
        amount = parseFloat(decimals[0].replace(/,/g, ""));
      }

      if (isNaN(amount) || amount === 0) return;

      // Description is everything before the first recognized amount,
      // but let's be more precise by excluding the date and any trailing UTR markers
      let description = afterDate;
      const firstAmountIdx = description.indexOf(decimals[0]);
      if (firstAmountIdx !== -1) {
        description = description.substring(0, firstAmountIdx).trim();
      }

      // Cleanup description: remove UTR info if it's already extracted
      if (extractedRef) {
        description = description.replace(utrPattern, "").replace(/\s+/g, " ").trim();
      }

      // Determine type
      let type: TxType;
      if (txTypeOverride) {
        type = txTypeOverride;
      } else {
        const descLower = description.toLowerCase();
        const isDebit =
          descLower.includes("debit") ||
          descLower.includes("withdrawal") ||
          descLower.includes("paid") ||
          descLower.includes("transfer to") ||
          descLower.includes("payment") ||
          descLower.includes("neft") ||
          descLower.includes("rtgs") ||
          descLower.includes("imps");
        const isCredit =
          descLower.includes("credit") ||
          descLower.includes("deposit") ||
          descLower.includes("received") ||
          descLower.includes("transfer from") ||
          descLower.includes("refund") ||
          descLower.includes("pay-in");

        if (isDebit) {
          type = TxType.PAYOUT;
        } else if (isCredit) {
          type = TxType.PAYIN;
        } else {
          type = amount >= 0 ? TxType.PAYIN : TxType.PAYOUT;
        }
      }

      rows.push({
        date,
        amount: Math.abs(amount),
        description: description || "No description provided",
        reference: extractedRef,
        type,
        balance: balance && !isNaN(balance) ? balance : undefined,
        cellColor: undefined,
        rowIndex: rows.length + 1,
        rawData: { lineText: trimmed },
        isExcluded: false,
      });
    });
  } catch (textErr: any) {
    console.error("[PDF] Text extraction failed:", textErr.message);
  }

  await parser.destroy().catch(() => {});
  return { rows, headers };
}

