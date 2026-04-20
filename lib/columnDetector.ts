export interface ColumnMapping {
  date?: string;
  amount?: string;
  credit?: string;
  debit?: string;
  description?: string;
  reference?: string;
  type?: string;
  balance?: string;
  category?: string;
}

const DATE_HEADERS = [
  "date", "on", "when", "time", "datetime", "transaction date",
  "tx date", "value date", "txn date", "posting date", "effective date",
];
const CREDIT_HEADERS = [
  "credit", "deposit", "cr", "received", "pay-in", "payin",
  "cr amount", "credit amount", "deposits", "money in", "credit(cr)",
];
const DEBIT_HEADERS = [
  "debit", "withdrawal", "dr", "paid", "payout", "pay-out",
  "dr amount", "debit amount", "withdrawals", "money out", "debit(dr)",
  "withdraw",
];
const AMOUNT_HEADERS = [
  "amount", "pay", "value", "sum", "total", "txn amount",
  "transaction amount", "net amount", "amount(inr)",
];
const DESCRIPTION_HEADERS = [
  "description", "narration", "particulars", "remarks", "note",
  "detail", "transaction details", "tx description", "payment details",
  "info", "memo", "narrative", "reference",
];
const REFERENCE_HEADERS = [
  "ref", "ref no", "reference", "cheque", "utr", "txn id",
  "transaction id", "chq no", "chq", "instrument id",
  "reference number", "instrument no", "instrument no.",
  "ref id", "utr no", "utr number", "utr no.",
];
const TYPE_HEADERS = [
  "type", "cr/dr", "transaction type", "txn type", "mode", "dr/cr",
  "indicator", "debit/credit",
];
const BALANCE_HEADERS = [
  "balance", "closing balance", "running balance", "available balance",
  "current balance", "bal", "closing",
];

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  // First pass: try exact matches
  headers.forEach((header) => {
    const h = header.toLowerCase().trim();

    if (
      !mapping.date &&
      DATE_HEADERS.some((pattern) => h === pattern || h.includes(pattern))
    ) {
      mapping.date = header;
    } else if (
      !mapping.credit &&
      CREDIT_HEADERS.some((pattern) => h === pattern || h.includes(pattern))
    ) {
      mapping.credit = header;
    } else if (
      !mapping.debit &&
      DEBIT_HEADERS.some((pattern) => h === pattern || h.includes(pattern))
    ) {
      mapping.debit = header;
    } else if (
      !mapping.balance &&
      BALANCE_HEADERS.some((pattern) => h === pattern || h.includes(pattern))
    ) {
      mapping.balance = header;
    } else if (
      !mapping.amount &&
      AMOUNT_HEADERS.some((pattern) => h === pattern || h.includes(pattern))
    ) {
      mapping.amount = header;
    } else if (
      !mapping.description &&
      DESCRIPTION_HEADERS.some(
        (pattern) => h === pattern || h.includes(pattern)
      )
    ) {
      mapping.description = header;
    } else if (
      !mapping.reference &&
      REFERENCE_HEADERS.some(
        (pattern) => h === pattern || h.includes(pattern)
      )
    ) {
      mapping.reference = header;
    } else if (
      !mapping.type &&
      TYPE_HEADERS.some((pattern) => h === pattern || h.includes(pattern))
    ) {
      mapping.type = header;
    }
  });

  return mapping;
}
