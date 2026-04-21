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
  bankName?: string;
  accountNumber?: string;
  time?: string;
  mode?: string;
}

const DATE_HEADERS = [
  "date", "on", "when", "datetime", "transaction date",
  "tx date", "value date", "txn date", "posting date", "effective date",
  "trans date", "trn date", "txn dt", "tran date", "entry date",
  "settlement date",
];
const CREDIT_HEADERS = [
  "credit", "deposit", "cr", "received", "pay-in", "payin",
  "cr amount", "credit amount", "deposits", "money in", "credit(cr)",
  "credit (cr)", "cr.", "credits", "amount credited", "inflow",
  "receipt", "receipts",
];
const DEBIT_HEADERS = [
  "debit", "withdrawal", "dr", "paid", "payout", "pay-out",
  "dr amount", "debit amount", "withdrawals", "money out", "debit(dr)",
  "debit (dr)", "dr.", "debits", "amount debited", "outflow",
  "withdraw", "payment", "payments",
];
const AMOUNT_HEADERS = [
  "amount", "pay", "value", "sum", "total", "txn amount",
  "transaction amount", "net amount", "amount(inr)", "amount (inr)",
  "amt", "transaction value", "txn value",
];
const DESCRIPTION_HEADERS = [
  "description", "narration", "particulars", "remarks", "note",
  "detail", "transaction details", "tx description", "payment details",
  "info", "memo", "narrative", "details", "transaction narration",
  "transaction description", "txn description", "txn details",
  "remark", "notes", "transaction particulars",
];
const REFERENCE_HEADERS = [
  "ref", "ref no", "reference", "cheque", "utr", "txn id",
  "transaction id", "chq no", "chq", "instrument id",
  "reference number", "instrument no", "instrument no.",
  "ref id", "utr no", "utr number", "utr no.",
  "ref no.", "reference no", "reference no.", "rrn",
  "receipt no", "receipt number", "voucher no", "voucher number",
  "cheque no", "cheque number", "chq/ref no", "chq/ref",
  "arn", "approval code", "auth code",
];
const TYPE_HEADERS = [
  "type", "cr/dr", "transaction type", "txn type", "mode", "dr/cr",
  "indicator", "debit/credit", "credit/debit", "txn mode",
  "transaction mode", "payment mode", "pay mode",
];
const BALANCE_HEADERS = [
  "balance", "closing balance", "running balance", "available balance",
  "current balance", "bal", "closing", "closing bal", "running bal",
  "available bal", "net balance", "total balance",
];
const TIME_HEADERS = [
  "time", "txn time", "transaction time",
];
const MODE_HEADERS = [
  "mode", "channel", "payment method", "payment channel",
  "txn channel", "transfer mode", "transfer type",
];

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  // Normalize all headers
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: h.toLowerCase().trim().replace(/[_\-\s]+/g, " ").replace(/\./g, ""),
  }));

  // Priority-based matching: more specific patterns first
  const matchers: Array<{
    key: keyof ColumnMapping;
    patterns: string[];
    priority: number;
  }> = [
    // High priority: specific column types that shouldn't be confused
    { key: "reference", patterns: REFERENCE_HEADERS, priority: 10 },
    { key: "credit", patterns: CREDIT_HEADERS, priority: 9 },
    { key: "debit", patterns: DEBIT_HEADERS, priority: 9 },
    { key: "balance", patterns: BALANCE_HEADERS, priority: 8 },
    { key: "date", patterns: DATE_HEADERS, priority: 7 },
    { key: "amount", patterns: AMOUNT_HEADERS, priority: 6 },
    { key: "type", patterns: TYPE_HEADERS, priority: 5 },
    { key: "time", patterns: TIME_HEADERS, priority: 4 },
    { key: "mode", patterns: MODE_HEADERS, priority: 3 },
    { key: "description", patterns: DESCRIPTION_HEADERS, priority: 2 },
  ];

  // Sort by priority (highest first)
  matchers.sort((a, b) => b.priority - a.priority);

  const assignedHeaders = new Set<string>();

  for (const matcher of matchers) {
    if (mapping[matcher.key]) continue;

    for (const { original, normalized } of normalizedHeaders) {
      if (assignedHeaders.has(original)) continue;

      // Special handling: "reference" in description headers should be lower priority
      // than in reference headers
      const isMatch = matcher.patterns.some(
        (pattern) => normalized === pattern || normalized.includes(pattern)
      );

      if (isMatch) {
        // Double-check: if this header matched "reference" as a description keyword
        // but also matches as a reference header, prefer reference
        if (matcher.key === "description" && normalized === "reference") {
          // Only assign to description if reference isn't already assigned
          if (!mapping.reference) {
            // Actually assign to reference instead
            mapping.reference = original;
            assignedHeaders.add(original);
            continue;
          }
        }

        mapping[matcher.key] = original;
        assignedHeaders.add(original);
        break;
      }
    }
  }

  return mapping;
}
