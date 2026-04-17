import type { InvestingActivity, Trading212Account } from "./types";

function detectDelimiter(text: string): "," | ";" {
  const lines = text.split(/\r?\n/);
  const first = lines.find((l) => l.trim().length > 0) ?? "";
  const commas = (first.match(/,/g) ?? []).length;
  const semis = (first.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

function stripBom(s: string): string {
  if (!s) return s;
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseDelimitedRows(text: string, delimiter: "," | ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    if (row.length === 1 && row[0] === "" && rows.length === 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === delimiter) {
      pushCell();
      i++;
      continue;
    }

    if (ch === "\n") {
      pushCell();
      pushRow();
      i++;
      continue;
    }

    if (ch === "\r") {
      i++;
      continue;
    }

    cell += ch;
    i++;
  }

  pushCell();
  if (row.length) pushRow();
  return rows;
}

function strictNum(value: string, field: string, rowNumber: number): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) throw new Error(`Row ${rowNumber}: invalid number for ${field}: "${value}"`);
  return parsed;
}

function str(value: string): string {
  return value ?? "";
}

function looksLikeT212Time(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value.trim());
}

function isMarketTradeAction(action: string): boolean {
  const a = action.trim().toLowerCase();
  return a === "market buy" || a === "market sell";
}

function safeIdFromRowKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `t212_${hash.toString(16)}`;
}

export function parseTrading212ActivityCsv(
  text: string,
  opts?: { strict?: boolean; account?: Trading212Account }
): { activities: InvestingActivity[]; warnings: string[] } {
  const strict = opts?.strict ?? true;
  const account = opts?.account ?? "isa";
  const warnings: string[] = [];
  const cleaned = stripBom(text);
  const delimiter = detectDelimiter(cleaned);
  const rows = parseDelimitedRows(cleaned, delimiter);
  if (!rows.length) return { activities: [], warnings: ["CSV is empty."] };

  const header = rows[0].map((h, idx) => (idx === 0 ? stripBom(h) : h).trim());
  const idx = (name: string) => header.findIndex((h) => h === name);

  // Trading 212 exports differ between ISA/regular and can change over time.
  // We only hard-require the columns needed to identify a transaction and read its total.
  const required = ["Action", "Time", "ID", "Total", "Currency (Total)"];

  const missing = required.filter((r) => idx(r) === -1);
  if (missing.length) {
    const msg = `CSV schema error: missing expected columns: ${missing.join(", ")}`;
    if (strict) throw new Error(msg);
    warnings.push(msg);
  }

  const get = (cells: string[], name: string) => {
    const i = idx(name);
    if (i === -1) return "";
    return cells[i] ?? "";
  };

  const activities: InvestingActivity[] = [];
  let skippedNonMarketTrade = 0;
  let skippedNonStockTrade = 0;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells.length || cells.every((c) => !c || !c.trim())) continue;

    try {
      const action = str(get(cells, "Action")).trim();
      const time = str(get(cells, "Time")).trim();
      const isin = str(get(cells, "ISIN")).trim();
      const ticker = str(get(cells, "Ticker")).trim();
      const name = str(get(cells, "Name")).trim();
      const notes = str(get(cells, "Notes")).trim();
      const rawId = str(get(cells, "ID")).trim();

      if (!action || !time) {
        warnings.push(`Row ${r + 1}: missing Action or Time (skipped).`);
        continue;
      }
      if (time && !looksLikeT212Time(time)) {
        warnings.push(`Row ${r + 1}: Time must look like "YYYY-MM-DD HH:MM:SS": "${time}" (skipped).`);
        continue;
      }

      // Keep the investing portal focused on executed trades only.
      // Explicitly accept Market buy / Market sell and skip everything else.
      if (!isMarketTradeAction(action)) {
        skippedNonMarketTrade++;
        continue;
      }

      const sharesRaw = get(cells, "No. of shares");
      const shares = sharesRaw.trim() ? strictNum(sharesRaw, "No. of shares", r + 1) : 0;
      const ppsRaw = get(cells, "Price / share");
      const pricePerShare = ppsRaw.trim() ? strictNum(ppsRaw, "Price / share", r + 1) : 0;
      const priceCurrency = str(get(cells, "Currency (Price / share)")).trim();
      const fxRaw = get(cells, "Exchange rate");
      const exchangeRate = fxRaw.trim() ? strictNum(fxRaw, "Exchange rate", r + 1) : 0;

      // Further narrow to stock executions only.
      // Require an instrument identifier and a positive quantity.
      const hasInstrument = Boolean(isin || ticker);
      if (!hasInstrument || shares <= 0) {
        skippedNonStockTrade++;
        continue;
      }

      const totalRaw = get(cells, "Total");
      const total = totalRaw.trim() ? strictNum(totalRaw, "Total", r + 1) : 0;
      const totalCurrency = str(get(cells, "Currency (Total)")).trim();

      const whtRaw = get(cells, "Withholding tax");
      const withholdingTax = whtRaw.trim() ? strictNum(whtRaw, "Withholding tax", r + 1) : 0;
      const withholdingTaxCurrency = str(get(cells, "Currency (Withholding tax)")).trim();

      const fxFeeRaw = get(cells, "Currency conversion fee");
      const currencyConversionFee = fxFeeRaw.trim() ? strictNum(fxFeeRaw, "Currency conversion fee", r + 1) : 0;
      const currencyConversionFeeCurrency = str(get(cells, "Currency (Currency conversion fee)")).trim();

      const fttRaw = get(cells, "French transaction tax");
      const frenchTransactionTax = fttRaw.trim() ? strictNum(fttRaw, "French transaction tax", r + 1) : 0;
      const frenchTransactionTaxCurrency = str(get(cells, "Currency (French transaction tax)")).trim();

      const derivedKey = [action, time, isin, ticker, name, String(shares), String(pricePerShare), totalCurrency, String(total)].join("|");
      const rawRowId = rawId || safeIdFromRowKey(derivedKey);
      const id = `${account}:${rawRowId}`;

      activities.push({
        id,
        account,
        action,
        time,
        isin,
        ticker,
        name,
        notes,
        shares,
        pricePerShare,
        priceCurrency,
        exchangeRate,
        result: 0,
        resultCurrency: "",
        total,
        totalCurrency,
        withholdingTax,
        withholdingTaxCurrency,
        stampDutyReserveTax: 0,
        stampDutyReserveTaxCurrency: "",
        currencyConversionFee,
        currencyConversionFeeCurrency,
        frenchTransactionTax,
        frenchTransactionTaxCurrency
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const msg = raw.startsWith(`Row ${r + 1}:`) ? raw : `Row ${r + 1}: ${raw}`;
      warnings.push(`${msg} (skipped).`);
      continue;
    }
  }

  if (skippedNonMarketTrade > 0) {
    warnings.push(`Filtered out ${skippedNonMarketTrade} non-market-trade row${skippedNonMarketTrade === 1 ? "" : "s"} (kept only Market buy/sell).`);
  }
  if (skippedNonStockTrade > 0) {
    warnings.push(
      `Filtered out ${skippedNonStockTrade} market trade row${skippedNonStockTrade === 1 ? "" : "s"} without an instrument/quantity.`
    );
  }

  if (activities.length === 0) {
    const msg = "CSV schema error: no valid activity rows found after validation.";
    if (strict) throw new Error(msg);
    warnings.push(msg);
  }

  return { activities, warnings };
}
