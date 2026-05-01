import type { Trade } from "./types";

export type CsvSchemaId = "trades" | "tradervue" | "orders_webull_uk" | "orders_thebroker";

export type CsvSchemaMapping = {
  source: string;
  target: string;
  notes?: string;
};

export const NORMALIZED_TRADE_COLUMNS = [
  "Open Datetime",
  "Close Datetime",
  "Symbol",
  "Side",
  "Volume",
  "Exec Count",
  "Entry Price",
  "Exit Price",
  "Gross P&L",
  "Gross P&L (%)",
  "Shared",
  "Notes",
  "Tags",
  "Gross P&L (t)",
  "Position MFE",
  "Position MAE",
  "Price MFE",
  "Price MAE",
  "Position MFE Datetime",
  "Position MAE Datetime",
  "Price MFE Datetime",
  "Price MAE Datetime"
] as const;

export const CSV_SCHEMAS: Array<{
  id: CsvSchemaId;
  label: string;
  description: string;
  requiredColumns: string[];
  targetColumns: string[];
  mappings: CsvSchemaMapping[];
}> = [
  {
    id: "trades",
    label: "Trades CSV (Open/Close trade export)",
    description: "Already-normalized trades with headers like Open Datetime, Close Datetime, Symbol, Side, Volume, Entry Price, Exit Price, and Gross P&L.",
    requiredColumns: ["Open Datetime", "Close Datetime", "Symbol", "Side", "Volume", "Entry Price", "Exit Price", "Gross P&L"],
    targetColumns: [...NORMALIZED_TRADE_COLUMNS],
    mappings: [
      { source: "Open Datetime", target: "Open Datetime" },
      { source: "Close Datetime", target: "Close Datetime" },
      { source: "Symbol", target: "Symbol" },
      { source: "Side", target: "Side" },
      { source: "Volume", target: "Volume" },
      { source: "Exec Count", target: "Exec Count", notes: "Optional direct pass-through when present." },
      { source: "Entry Price", target: "Entry Price" },
      { source: "Exit Price", target: "Exit Price" },
      { source: "Gross P&L", target: "Gross P&L" }
    ]
  },
  {
    id: "tradervue",
    label: "Tradervue Trades CSV",
    description: "Tradervue normalized trade export. Loads directly into the day-trading journal as open/close trades.",
    requiredColumns: ["Open Datetime", "Close Datetime", "Symbol", "Side", "Volume", "Entry Price", "Exit Price", "Gross P&L"],
    targetColumns: [...NORMALIZED_TRADE_COLUMNS],
    mappings: [
      { source: "Open Datetime", target: "Open Datetime" },
      { source: "Close Datetime", target: "Close Datetime" },
      { source: "Symbol", target: "Symbol" },
      { source: "Side", target: "Side" },
      { source: "Volume", target: "Volume" },
      { source: "Exec Count", target: "Exec Count" },
      { source: "Entry Price", target: "Entry Price" },
      { source: "Exit Price", target: "Exit Price" },
      { source: "Gross P&L", target: "Gross P&L" },
      { source: "Gross P&L (%)", target: "Gross P&L (%)" },
      { source: "Notes", target: "Notes" },
      { source: "Tags", target: "Tags" }
    ]
  },
  {
    id: "orders_webull_uk",
    label: "Webull UK Orders CSV",
    description: "Order history / fills. Filled Buy/Sell rows are converted into round-trip trades per symbol.",
    requiredColumns: ["Symbol", "Side", "Filled Qty", "Avg Fill Price", "Status", "Update Time"],
    targetColumns: [...NORMALIZED_TRADE_COLUMNS],
    mappings: [
      { source: "Symbol", target: "Symbol" },
      { source: "Side", target: "Side", notes: "Buy/Sell fills are paired into one long or short trade direction." },
      { source: "Filled Qty", target: "Volume", notes: "Entry and exit fills are matched and normalized into trade size." },
      { source: "Avg Fill Price", target: "Entry Price / Exit Price", notes: "Buy and sell fill prices become trade entry and exit." },
      { source: "Update Time", target: "Open Datetime / Close Datetime", notes: "Timestamps are normalized to ISO 8601 and paired into round trips." },
      { source: "Fee", target: "Gross P&L", notes: "Fees are subtracted when normalized P/L is calculated." },
      { source: "Order ID", target: "Notes", notes: "Order ids are retained as part of the imported order context." }
    ]
  },
  {
    id: "orders_thebroker",
    label: "TheBroker Orders CSV",
    description: "Order history / fills. Filled Buy/Sell rows are converted into round-trip trades per symbol.",
    requiredColumns: [
      "Symbol",
      "Side",
      "Type",
      "Qty",
      "Filled Qty",
      "Limit Price",
      "Stop Price",
      "Avg Fill Price",
      "Status",
      "Update Time",
      "currency",
      "Fee",
      "Order ID"
    ],
    targetColumns: [...NORMALIZED_TRADE_COLUMNS],
    mappings: [
      { source: "Symbol", target: "Symbol" },
      { source: "Side", target: "Side", notes: "Buy/Sell fills are paired into one long or short trade direction." },
      { source: "Filled Qty", target: "Volume", notes: "Entry and exit fills are matched and normalized into trade size." },
      { source: "Avg Fill Price", target: "Entry Price / Exit Price", notes: "Buy and sell fill prices become trade entry and exit." },
      { source: "Update Time", target: "Open Datetime / Close Datetime", notes: "Timestamps are normalized and paired into round trips." },
      { source: "Fee", target: "Gross P&L", notes: "Fees are subtracted when normalized P/L is calculated." },
      { source: "Order ID", target: "Notes", notes: "Order ids are retained as part of the imported order context." }
    ]
  }
];

function matchesRequiredColumns(header: string[], requiredColumns: string[]): boolean {
  return requiredColumns.every((name) => header.includes(name));
}

function detectSchemaFromHeader(header: string[]): CsvSchemaId {
  const theBrokerSchema = CSV_SCHEMAS.find((schema) => schema.id === "orders_thebroker");
  if (theBrokerSchema && matchesRequiredColumns(header, theBrokerSchema.requiredColumns)) return "orders_thebroker";

  const webullSchema = CSV_SCHEMAS.find((schema) => schema.id === "orders_webull_uk");
  if (webullSchema && matchesRequiredColumns(header, webullSchema.requiredColumns)) return "orders_webull_uk";

  return "trades";
}

function safeIdFromTrade(t: Omit<Trade, "id">): string {
  const key = [
    t.openDatetime,
    t.closeDatetime,
    t.symbol,
    t.side,
    String(t.volume),
    String(t.entryPrice),
    String(t.exitPrice),
    String(t.grossPnl)
  ].join("|");
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `trade_${hash.toString(16)}`;
}

function parseCsvRows(text: string): string[][] {
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
    // ignore completely empty trailing lines
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

    if (ch === ",") {
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

function num(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

function strictNum(value: string, field: string, rowNumber: number): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowNumber}: invalid number for ${field}: "${value}"`);
  }
  return parsed;
}

function bool(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function str(value: string): string {
  return value ?? "";
}

function looksLikeDateTime(value: string): boolean {
  // Accepts:
  // - "YYYY-MM-DD HH:MM"
  // - "YYYY-MM-DD HH:MM:SS"
  // - "YYYY-MM-DDTHH:MM:SS"
  // - "YYYY-MM-DDTHH:MM:SSZ"
  // - "YYYY-MM-DDTHH:MM:SS+01:00"
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/.test(value.trim());
}

function lastSundayOfMonth(year: number, monthIndex: number): number {
  const d = new Date(year, monthIndex + 1, 0);
  return d.getDate() - d.getDay();
}

function londonOffsetForLocalDateTime(year: number, month: number, day: number, hour: number): "+00:00" | "+01:00" {
  if (month < 3 || month > 10) return "+00:00";
  if (month > 3 && month < 10) return "+01:00";

  if (month === 3) {
    const dstStartDay = lastSundayOfMonth(year, 2);
    if (day > dstStartDay) return "+01:00";
    if (day < dstStartDay) return "+00:00";
    return hour >= 2 ? "+01:00" : "+00:00";
  }

  const dstEndDay = lastSundayOfMonth(year, 9);
  if (day < dstEndDay) return "+01:00";
  if (day > dstEndDay) return "+00:00";
  return hour >= 2 ? "+00:00" : "+01:00";
}

function normalizeLondonImportDateTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const withZoneMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:\d{2})$/);
  if (withZoneMatch) {
    const [, datePart, timePart, zonePart] = withZoneMatch;
    const normalizedTime = timePart.length === 5 ? `${timePart}:00` : timePart;
    return `${datePart}T${normalizedTime}${zonePart}`;
  }

  const plainMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!plainMatch) return trimmed;

  const [, yy, mm, dd, hh, min, ss] = plainMatch;
  const year = Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  const hour = Number(hh);
  const offset = londonOffsetForLocalDateTime(year, month, day, hour);
  const seconds = ss ?? "00";
  return `${yy}-${mm}-${dd}T${hh}:${min}:${seconds}${offset}`;
}

export function parseTradesCsv(
  text: string,
  opts?: { strict?: boolean; schema?: CsvSchemaId }
): { trades: Trade[]; warnings: string[] } {
  const strict = opts?.strict ?? true;
  const requestedSchema = opts?.schema ?? "trades";
  const warnings: string[] = [];
  const rows = parseCsvRows(text);
  if (!rows.length) return { trades: [], warnings: ["CSV is empty."] };

  const header = rows[0].map((h) => h.trim());
  const schema = requestedSchema === "trades" ? detectSchemaFromHeader(header) : requestedSchema;
  const idx = (name: string) => header.findIndex((h) => h === name);

  if (schema === "orders_webull_uk") {
    return parseOrdersCsvToTrades(rows, header, strict);
  }
  if (schema === "orders_thebroker") {
    return parseOrdersCsvToTrades(rows, header, strict);
  }
  if (schema === "trades" || schema === "tradervue") {
    // continue into trades parser below
  } else {
    if (strict) throw new Error(`CSV schema error: unknown schema "${schema}"`);
  }

  const required = ["Open Datetime", "Close Datetime", "Symbol", "Side", "Volume", "Entry Price", "Exit Price", "Gross P&L"];
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

  const trades: Trade[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells.length || cells.every((c) => !c || !c.trim())) continue;

    const openDatetime = str(get(cells, "Open Datetime"));
    const closeDatetime = str(get(cells, "Close Datetime"));
    const symbol = str(get(cells, "Symbol"));
    const side = str(get(cells, "Side"));

    if (!openDatetime || !symbol) {
      const msg = `Row ${r + 1}: missing Open Datetime or Symbol`;
      if (strict) throw new Error(msg);
      warnings.push(msg);
      continue;
    }

    if (strict && !looksLikeDateTime(openDatetime)) {
      throw new Error(`Row ${r + 1}: Open Datetime must look like "YYYY-MM-DD HH:MM[:SS]" or ISO 8601: "${openDatetime}"`);
    }
    if (strict && closeDatetime && !looksLikeDateTime(closeDatetime)) {
      throw new Error(`Row ${r + 1}: Close Datetime must look like "YYYY-MM-DD HH:MM[:SS]" or ISO 8601: "${closeDatetime}"`);
    }

    const readNum = (col: string): number => {
      const value = get(cells, col);
      return strict ? strictNum(value, col, r + 1) : num(value);
    };

    const tradeNoId: Omit<Trade, "id"> = {
      openDatetime,
      closeDatetime,
      symbol,
      side,
      volume: readNum("Volume"),
      execCount: readNum("Exec Count"),
      entryPrice: readNum("Entry Price"),
      exitPrice: readNum("Exit Price"),
      grossPnl: readNum("Gross P&L"),
      grossPnlPct: readNum("Gross P&L (%)"),
      shared: bool(get(cells, "Shared")),
      notes: str(get(cells, "Notes")),
      tags: str(get(cells, "Tags")),
      grossPnlT: readNum("Gross P&L (t)"),
      positionMfe: readNum("Position MFE"),
      positionMae: readNum("Position MAE"),
      priceMfe: readNum("Price MFE"),
      priceMae: readNum("Price MAE"),
      positionMfeDatetime: str(get(cells, "Position MFE Datetime")),
      positionMaeDatetime: str(get(cells, "Position MAE Datetime")),
      priceMfeDatetime: str(get(cells, "Price MFE Datetime")),
      priceMaeDatetime: str(get(cells, "Price MAE Datetime"))
    };

    trades.push({ ...tradeNoId, id: safeIdFromTrade(tradeNoId) });
  }

  if (strict && trades.length === 0) {
    throw new Error("CSV schema error: no valid trade rows found after validation.");
  }

  return { trades, warnings };
}

type OrderFill = {
  symbol: string;
  side: "Buy" | "Sell";
  qty: number;
  price: number;
  fee: number;
  time: string; // "YYYY-MM-DD HH:MM:SS"
  orderId: string;
};

function parseOrdersCsvToTrades(rows: string[][], header: string[], strict: boolean): { trades: Trade[]; warnings: string[] } {
  const warnings: string[] = [];
  const idx = (name: string) => header.findIndex((h) => h === name);

  const required = ["Symbol", "Side", "Filled Qty", "Avg Fill Price", "Status", "Update Time"];
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

  const fills: OrderFill[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells.length || cells.every((c) => !c || !c.trim())) continue;

    const status = str(get(cells, "Status")).trim();
    if (status.toLowerCase() !== "filled") continue;

    const symbol = str(get(cells, "Symbol")).trim();
    const sideRaw = str(get(cells, "Side")).trim();
    const time = str(get(cells, "Update Time")).trim();
    const orderId = str(get(cells, "Order ID")).trim();

    if (strict && (!symbol || !time || !sideRaw)) {
      throw new Error(`Row ${r + 1}: missing Symbol, Side, or Update Time`);
    }
    if (strict && time && !looksLikeDateTime(time)) {
      throw new Error(`Row ${r + 1}: Update Time must look like "YYYY-MM-DD HH:MM[:SS]" or ISO 8601: "${time}"`);
    }

    const side = sideRaw === "Buy" || sideRaw === "Sell" ? (sideRaw as "Buy" | "Sell") : null;
    if (strict && !side) throw new Error(`Row ${r + 1}: Side must be "Buy" or "Sell": "${sideRaw}"`);
    if (!side) continue;

    const qtyRaw = get(cells, "Filled Qty");
    const priceRaw = get(cells, "Avg Fill Price");
    const feeRaw = get(cells, "Fee");
    const qty = strict ? strictNum(qtyRaw, "Filled Qty", r + 1) : num(qtyRaw);
    const price = strict ? strictNum(priceRaw, "Avg Fill Price", r + 1) : num(priceRaw);
    const fee = feeRaw ? (strict ? strictNum(feeRaw, "Fee", r + 1) : num(feeRaw)) : 0;

    if (strict && (qty <= 0 || price <= 0)) {
      throw new Error(`Row ${r + 1}: Filled Qty and Avg Fill Price must be > 0`);
    }
    if (qty <= 0 || price <= 0) continue;

    fills.push({ symbol, side, qty, price, fee, time: normalizeLondonImportDateTime(time), orderId });
  }

  fills.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  type Tracker = {
    pos: number; // +long shares, -short shares
    openTime: string | null;
    closeTime: string | null;
    symbol: string;
    entryQty: number;
    entryNotional: number;
    exitQty: number;
    exitNotional: number;
    fees: number;
    execCount: number;
    orderIds: string[];
  };

  const trackers = new Map<string, Tracker>();

  const ensureTracker = (symbol: string): Tracker => {
    const existing = trackers.get(symbol);
    if (existing) return existing;
    const t: Tracker = {
      pos: 0,
      openTime: null,
      closeTime: null,
      symbol,
      entryQty: 0,
      entryNotional: 0,
      exitQty: 0,
      exitNotional: 0,
      fees: 0,
      execCount: 0,
      orderIds: []
    };
    trackers.set(symbol, t);
    return t;
  };

  const out: Trade[] = [];

  // Add direction tracking cleanly
  const resetTrackerForNewTrade = (t: Tracker) => {
    t.openTime = null;
    t.closeTime = null;
    t.entryQty = 0;
    t.entryNotional = 0;
    t.exitQty = 0;
    t.exitNotional = 0;
    t.fees = 0;
    t.execCount = 0;
    t.orderIds = [];
  };

  // Track direction explicitly
  const direction = new Map<string, "L" | "S">();

  for (const f of fills) {
    const t = ensureTracker(f.symbol);

    const beforePos = t.pos;
    const delta = f.side === "Buy" ? f.qty : -f.qty;
    const afterPos = beforePos + delta;

    if (beforePos === 0) {
      resetTrackerForNewTrade(t);
      t.openTime = f.time;
      direction.set(f.symbol, delta > 0 ? "L" : "S");
    }

    const dir = direction.get(f.symbol) ?? "L";

    t.execCount += 1;
    if (f.orderId) t.orderIds.push(f.orderId);
    t.fees += f.fee;

    // Classify as entry vs exit based on direction
    if (dir === "L") {
      if (f.side === "Buy") {
        t.entryQty += f.qty;
        t.entryNotional += f.qty * f.price;
      } else {
        t.exitQty += f.qty;
        t.exitNotional += f.qty * f.price;
      }
    } else {
      // short: Sell is entry, Buy is exit
      if (f.side === "Sell") {
        t.entryQty += f.qty;
        t.entryNotional += f.qty * f.price;
      } else {
        t.exitQty += f.qty;
        t.exitNotional += f.qty * f.price;
      }
    }

    t.pos = afterPos;
    t.closeTime = f.time;

    if (t.pos === 0) {
      const entryPrice = t.entryQty ? t.entryNotional / t.entryQty : 0;
      const exitPrice = t.exitQty ? t.exitNotional / t.exitQty : 0;
      const qty = Math.min(t.entryQty, t.exitQty);
      const gross = dir === "L" ? (exitPrice - entryPrice) * qty : (entryPrice - exitPrice) * qty;
      const grossAfterFees = gross - t.fees;
      const grossPct = entryPrice > 0 ? (grossAfterFees / (entryPrice * qty)) * 100 : 0;

      const tradeNoId: Omit<Trade, "id"> = {
        openDatetime: t.openTime ?? f.time,
        closeDatetime: t.closeTime ?? f.time,
        symbol: f.symbol,
        side: dir,
        volume: qty,
        execCount: t.execCount,
        entryPrice,
        exitPrice,
        grossPnl: Number.isFinite(grossAfterFees) ? grossAfterFees : 0,
        grossPnlPct: Number.isFinite(grossPct) ? grossPct : 0,
        shared: false,
        notes: t.fees ? `Imported from orders CSV. Fees: ${t.fees.toFixed(2)}.` : "Imported from orders CSV.",
        tags: "orders_csv",
        grossPnlT: Number.isFinite(grossAfterFees) ? grossAfterFees : 0,
        positionMfe: 0,
        positionMae: 0,
        priceMfe: 0,
        priceMae: 0,
        positionMfeDatetime: "",
        positionMaeDatetime: "",
        priceMfeDatetime: "",
        priceMaeDatetime: ""
      };

      out.push({ ...tradeNoId, id: safeIdFromTrade(tradeNoId) });
      // Ready for next trade
      t.pos = 0;
      resetTrackerForNewTrade(t);
      direction.delete(f.symbol);
    }
  }

  if (strict && out.length === 0) {
    throw new Error("CSV schema error: no round-trip trades could be constructed from order fills.");
  }

  // warn if there are open positions
  for (const [sym, t] of trackers.entries()) {
    if (t.pos !== 0) warnings.push(`Open position not closed for ${sym}; ignoring incomplete trade.`);
  }

  return { trades: out, warnings };
}
