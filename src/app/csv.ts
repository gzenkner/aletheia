import type { Trade } from "./types";

export type CsvSchemaId = "trades" | "orders_webull_uk" | "orders_thebroker";

export const CSV_SCHEMAS: Array<{
  id: CsvSchemaId;
  label: string;
  description: string;
  requiredColumns: string[];
}> = [
  {
    id: "trades",
    label: "Trades CSV (TradeLogger)",
    description: "Already-normalized trades with Open/Close/Entry/Exit/P&L columns.",
    requiredColumns: ["Open Datetime", "Close Datetime", "Symbol", "Side", "Volume", "Entry Price", "Exit Price", "Gross P&L"]
  },
  {
    id: "orders_webull_uk",
    label: "Webull UK Orders CSV",
    description: "Order history / fills. Filled Buy/Sell rows are converted into round-trip trades per symbol.",
    requiredColumns: ["Symbol", "Side", "Filled Qty", "Avg Fill Price", "Status", "Update Time"]
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
    ]
  }
];

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
  // Accepts: "YYYY-MM-DD HH:MM" or "YYYY-MM-DD HH:MM:SS"
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value.trim());
}

export function parseTradesCsv(
  text: string,
  opts?: { strict?: boolean; schema?: CsvSchemaId }
): { trades: Trade[]; warnings: string[] } {
  const strict = opts?.strict ?? true;
  const schema = opts?.schema ?? "trades";
  const warnings: string[] = [];
  const rows = parseCsvRows(text);
  if (!rows.length) return { trades: [], warnings: ["CSV is empty."] };

  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h === name);

  if (schema === "orders_webull_uk") {
    return parseOrdersCsvToTrades(rows, header, strict);
  }
  if (schema === "orders_thebroker") {
    return parseOrdersCsvToTrades(rows, header, strict);
  }
  if (schema === "trades") {
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
      throw new Error(`Row ${r + 1}: Open Datetime must look like "YYYY-MM-DD HH:MM[:SS]": "${openDatetime}"`);
    }
    if (strict && closeDatetime && !looksLikeDateTime(closeDatetime)) {
      throw new Error(`Row ${r + 1}: Close Datetime must look like "YYYY-MM-DD HH:MM[:SS]": "${closeDatetime}"`);
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
      throw new Error(`Row ${r + 1}: Update Time must look like "YYYY-MM-DD HH:MM[:SS]": "${time}"`);
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

    fills.push({ symbol, side, qty, price, fee, time, orderId });
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
