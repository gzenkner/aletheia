import type { Trade } from "./types";
import { parseDatetimeLocal } from "./format";

export type TradeStats = {
  count: number;
  grossPnl: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  biggestWin: number;
  biggestLoss: number;
  avgHoldMs: number;
};

export function computeStats(trades: Trade[]): TradeStats {
  const count = trades.length;
  let grossPnl = 0;
  let wins = 0;
  let losses = 0;
  let winSum = 0;
  let lossSum = 0;
  let biggestWin = -Infinity;
  let biggestLoss = Infinity;
  let holdSum = 0;
  let holdCount = 0;

  const sorted = [...trades].sort((a, b) => (a.openDatetime < b.openDatetime ? -1 : a.openDatetime > b.openDatetime ? 1 : 0));
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;

  for (const t of sorted) {
    const pnl = t.grossPnl;
    grossPnl += pnl;
    biggestWin = Math.max(biggestWin, pnl);
    biggestLoss = Math.min(biggestLoss, pnl);
    if (pnl > 0) {
      wins++;
      winSum += pnl;
    } else if (pnl < 0) {
      losses++;
      lossSum += Math.abs(pnl);
    }

    const open = parseDatetimeLocal(t.openDatetime);
    const close = parseDatetimeLocal(t.closeDatetime);
    if (open && close) {
      const ms = close.getTime() - open.getTime();
      if (ms > 0 && ms < 1000 * 60 * 60 * 24 * 30) {
        holdSum += ms;
        holdCount++;
      }
    }

    equity += pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }

  const avgWin = wins ? winSum / wins : 0;
  const avgLoss = losses ? lossSum / losses : 0;
  const winRate = count ? wins / count : 0;
  const profitFactor = lossSum > 0 ? winSum / lossSum : wins > 0 ? Infinity : 0;
  const expectancy = count ? grossPnl / count : 0;
  const avgHoldMs = holdCount ? holdSum / holdCount : 0;

  return {
    count,
    grossPnl,
    wins,
    losses,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy,
    maxDrawdown,
    biggestWin: biggestWin === -Infinity ? 0 : biggestWin,
    biggestLoss: biggestLoss === Infinity ? 0 : biggestLoss,
    avgHoldMs
  };
}

export function filterTrades(
  trades: Trade[],
  opts: { sideFilter: "all" | "L" | "S"; dateFrom?: string; dateTo?: string }
): Trade[] {
  return trades.filter((t) => {
    if (opts.sideFilter !== "all" && String(t.side).toUpperCase() !== opts.sideFilter) return false;
    if (opts.dateFrom && t.openDatetime.slice(0, 10) < opts.dateFrom) return false;
    if (opts.dateTo && t.openDatetime.slice(0, 10) > opts.dateTo) return false;
    return true;
  });
}

export function groupTradesByDay(trades: Trade[]): Array<{ day: string; trades: Trade[]; pnl: number }> {
  const buckets = new Map<string, Trade[]>();
  for (const t of trades) {
    const day = t.openDatetime.slice(0, 10);
    const list = buckets.get(day) ?? [];
    list.push(t);
    buckets.set(day, list);
  }
  const out = [...buckets.entries()].map(([day, list]) => ({
    day,
    trades: list.sort((a, b) => (a.openDatetime < b.openDatetime ? -1 : 1)),
    pnl: list.reduce((sum, t) => sum + t.grossPnl, 0)
  }));
  out.sort((a, b) => (a.day < b.day ? 1 : -1));
  return out;
}

export type WinLossBucket = {
  label: string;
  wins: number;
  losses: number;
  flat: number;
  pnl: number;
  total: number;
};

function addWinLoss(acc: WinLossBucket, pnl: number) {
  acc.total += 1;
  acc.pnl += pnl;
  if (pnl > 0) acc.wins += 1;
  else if (pnl < 0) acc.losses += 1;
  else acc.flat += 1;
}

export function bucketByEntryPrice(trades: Trade[], boundaries: number[]): WinLossBucket[] {
  const labels: string[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const a = boundaries[i];
    const b = boundaries[i + 1];
    if (a <= 0) labels.push(`< $${b}`);
    else if (!Number.isFinite(b)) labels.push(`$${a}+`);
    else labels.push(`$${a}–$${b}`);
  }

  const buckets: WinLossBucket[] = labels.map((label) => ({ label, wins: 0, losses: 0, flat: 0, pnl: 0, total: 0 }));
  const lastIdx = buckets.length - 1;

  for (const t of trades) {
    const p = t.entryPrice;
    let idx = lastIdx;
    for (let i = 0; i < boundaries.length - 1; i++) {
      const a = boundaries[i];
      const b = boundaries[i + 1];
      if (p >= a && p < b) {
        idx = i;
        break;
      }
    }
    addWinLoss(buckets[idx], t.grossPnl);
  }

  return buckets;
}

export function bucketByDayOfWeek(trades: Trade[]): WinLossBucket[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const buckets: WinLossBucket[] = labels.map((label) => ({ label, wins: 0, losses: 0, flat: 0, pnl: 0, total: 0 }));

  for (const t of trades) {
    const d = parseDatetimeLocal(t.openDatetime);
    if (!d) continue;
    const js = d.getDay(); // 0 Sun ... 6 Sat
    const idx = js === 0 ? 6 : js - 1;
    addWinLoss(buckets[idx], t.grossPnl);
  }

  return buckets;
}

export type TimeBucketId = "premarket" | "open" | "mid" | "lunch" | "power" | "after";

export const TIME_BUCKETS: Array<{ id: TimeBucketId; label: string; startMin: number; endMin: number | null }> = [
  { id: "premarket", label: "Pre", startMin: 0, endMin: 9 * 60 + 30 },
  { id: "open", label: "Open", startMin: 9 * 60 + 30, endMin: 10 * 60 + 30 },
  { id: "mid", label: "Mid", startMin: 10 * 60 + 30, endMin: 12 * 60 },
  { id: "lunch", label: "Lunch", startMin: 12 * 60, endMin: 14 * 60 },
  { id: "power", label: "Power", startMin: 14 * 60, endMin: 16 * 60 },
  { id: "after", label: "After", startMin: 16 * 60, endMin: null }
];

export function bucketByTimeOfDay(trades: Trade[]): WinLossBucket[] {
  const buckets: WinLossBucket[] = TIME_BUCKETS.map((t) => ({ label: t.label, wins: 0, losses: 0, flat: 0, pnl: 0, total: 0 }));

  for (const t of trades) {
    const d = parseDatetimeLocal(t.openDatetime);
    if (!d) continue;
    const mins = d.getHours() * 60 + d.getMinutes();
    let idx = buckets.length - 1;
    for (let i = 0; i < TIME_BUCKETS.length; i++) {
      const b = TIME_BUCKETS[i];
      if (mins >= b.startMin && (b.endMin === null || mins < b.endMin)) {
        idx = i;
        break;
      }
    }
    addWinLoss(buckets[idx], t.grossPnl);
  }

  return buckets;
}

export type HeatCell = { wins: number; losses: number; flat: number; pnl: number; total: number };

export function heatmapByDayAndTime(trades: Trade[]): { rows: string[]; cols: string[]; cells: HeatCell[][] } {
  const rows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const cols = TIME_BUCKETS.map((b) => b.label);
  const cells: HeatCell[][] = rows.map(() => cols.map(() => ({ wins: 0, losses: 0, flat: 0, pnl: 0, total: 0 })));

  for (const t of trades) {
    const d = parseDatetimeLocal(t.openDatetime);
    if (!d) continue;
    const js = d.getDay();
    const row = js === 0 ? 6 : js - 1;

    const mins = d.getHours() * 60 + d.getMinutes();
    let col = cols.length - 1;
    for (let i = 0; i < TIME_BUCKETS.length; i++) {
      const b = TIME_BUCKETS[i];
      if (mins >= b.startMin && (b.endMin === null || mins < b.endMin)) {
        col = i;
        break;
      }
    }

    const cell = cells[row][col];
    cell.total += 1;
    cell.pnl += t.grossPnl;
    if (t.grossPnl > 0) cell.wins += 1;
    else if (t.grossPnl < 0) cell.losses += 1;
    else cell.flat += 1;
  }

  return { rows, cols, cells };
}

export function bucketByHoldTimeMs(trades: Trade[], boundariesMs: number[]): WinLossBucket[] {
  const labels: string[] = [];
  for (let i = 0; i < boundariesMs.length - 1; i++) {
    const a = boundariesMs[i];
    const b = boundariesMs[i + 1];
    const fmt = (ms: number) => {
      if (!Number.isFinite(ms)) return "∞";
      const sec = Math.round(ms / 1000);
      if (sec < 60) return `${sec}s`;
      const min = Math.round(sec / 60);
      return `${min}m`;
    };
    if (a <= 0) labels.push(`<${fmt(b)}`);
    else if (!Number.isFinite(b)) labels.push(`${fmt(a)}+`);
    else labels.push(`${fmt(a)}–${fmt(b)}`);
  }

  const buckets: WinLossBucket[] = labels.map((label) => ({ label, wins: 0, losses: 0, flat: 0, pnl: 0, total: 0 }));
  const lastIdx = buckets.length - 1;

  for (const t of trades) {
    const open = parseDatetimeLocal(t.openDatetime);
    const close = parseDatetimeLocal(t.closeDatetime);
    if (!open || !close) continue;
    const hold = close.getTime() - open.getTime();
    if (!Number.isFinite(hold) || hold < 0) continue;

    let idx = lastIdx;
    for (let i = 0; i < boundariesMs.length - 1; i++) {
      const a = boundariesMs[i];
      const b = boundariesMs[i + 1];
      if (hold >= a && hold < b) {
        idx = i;
        break;
      }
    }
    addWinLoss(buckets[idx], t.grossPnl);
  }

  return buckets;
}
