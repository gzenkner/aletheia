import React from "react";
import type { Trade } from "../types";
import { fmtMoney } from "../format";

type DayCell = {
  isoDay: string; // YYYY-MM-DD
  day: number;
  pnl: number;
  trades: number;
};

function toIsoMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(isoMonth: string): string {
  const [yy, mm] = isoMonth.split("-").map(Number);
  const d = new Date(yy, (mm || 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startDow(year: number, monthIndex: number): number {
  // 0=Sun..6=Sat
  return new Date(year, monthIndex, 1).getDay();
}

function isoDayFromParts(year: number, monthIndex: number, day: number): string {
  const y = String(year);
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pnlClass(pnl: number): string {
  if (pnl > 0) return "text-emerald-700";
  if (pnl < 0) return "text-rose-700";
  return "opacity-70";
}

function pnlCellClass(pnl: number): string {
  if (pnl > 0) return "border-emerald-200 bg-emerald-50/60";
  if (pnl < 0) return "border-rose-200 bg-rose-50/60";
  return "border-[color:var(--app-border)] bg-[color:var(--app-card)]";
}

function inferDefaultMonth(trades: Trade[]): string {
  if (trades.length) {
    const max = trades.reduce<string>((acc, t) => (t.openDatetime > acc ? t.openDatetime : acc), trades[0]!.openDatetime);
    return max.slice(0, 7);
  }
  return toIsoMonth(new Date());
}

export default function ReportsView({ trades }: { trades: Trade[] }) {
  const [isoMonth, setIsoMonth] = React.useState(() => inferDefaultMonth(trades));
  const todayIso = React.useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  React.useEffect(() => {
    // If there are trades and the current selection is empty/invalid, snap to latest month.
    if (!/^\d{4}-\d{2}$/.test(isoMonth)) setIsoMonth(inferDefaultMonth(trades));
  }, [isoMonth, trades]);

  const daily = React.useMemo(() => {
    const map = new Map<string, { pnl: number; trades: number }>();
    for (const t of trades) {
      const day = t.openDatetime.slice(0, 10);
      if (!day.startsWith(isoMonth)) continue;
      const cur = map.get(day) ?? { pnl: 0, trades: 0 };
      cur.pnl += t.grossPnl;
      cur.trades += 1;
      map.set(day, cur);
    }
    return map;
  }, [isoMonth, trades]);

  const calendar = React.useMemo(() => {
    const [yy, mm] = isoMonth.split("-").map(Number);
    const year = yy || new Date().getFullYear();
    const monthIndex = (mm || 1) - 1;
    const count = daysInMonth(year, monthIndex);
    const pad = startDow(year, monthIndex);
    const cells: Array<DayCell | null> = [];

    for (let i = 0; i < pad; i++) cells.push(null);
    for (let d = 1; d <= count; d++) {
      const isoDay = isoDayFromParts(year, monthIndex, d);
      const st = daily.get(isoDay) ?? { pnl: 0, trades: 0 };
      cells.push({ isoDay, day: d, pnl: st.pnl, trades: st.trades });
    }

    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: Array<Array<DayCell | null>> = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [daily, isoMonth]);

  const totals = React.useMemo(() => {
    let pnl = 0;
    let count = 0;
    for (const v of daily.values()) {
      pnl += v.pnl;
      count += v.trades;
    }
    return { pnl, count };
  }, [daily]);

  return (
    <div className="grid gap-4">
      <div className="app-card rounded-[1rem] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold">Reports</h2>
          <div className="text-sm app-muted">Monthly overview • {monthLabel(isoMonth)}</div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <div className="text-xs app-muted">Month</div>
            <input
              type="month"
              className="app-input h-11 rounded-[0.6rem] px-3 text-base focus:outline-none"
              value={isoMonth}
              onChange={(e) => setIsoMonth(e.target.value)}
            />
          </label>
          <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-2 text-sm">
            <span className="app-muted">Total P&amp;L:</span>{" "}
            <span className={cnText("font-semibold", pnlClass(totals.pnl))}>{fmtMoney(totals.pnl)}</span>{" "}
            <span className="app-muted">• {totals.count} trades</span>
          </div>
        </div>
      </div>
      </div>

      <div className="app-card overflow-x-auto rounded-[1rem] p-3">
        <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-2 text-sm">
          <thead>
            <tr>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, idx) => (
                <th
                  key={d}
                  className={cnText(
                    "rounded-[0.6rem] px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide",
                    idx === 0 || idx === 6 ? "text-rose-600" : "app-muted"
                  )}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendar.map((week, i) => (
              <tr key={i}>
                {week.map((cell, j) => (
                  <td key={j} className="align-top">
                    {cell ? (
                      <div
                        className={cnText(
                          "min-h-24 rounded-[0.75rem] border p-2",
                          pnlCellClass(cell.pnl),
                          cell.isoDay === todayIso ? "ring-2 ring-[color:var(--outcome-accent-strong)]" : ""
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold app-muted">{cell.day}</div>
                          {cell.isoDay === todayIso ? (
                            <span className="rounded-full border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] px-2 py-0.5 text-[10px] font-semibold">
                              Today
                            </span>
                          ) : null}
                        </div>
                        <div className={cnText("mt-2 text-sm font-semibold tabular-nums", pnlClass(cell.pnl))}>{fmtMoney(cell.pnl)}</div>
                        <div className="mt-1 text-xs app-muted">{cell.trades} trade{cell.trades === 1 ? "" : "s"}</div>
                      </div>
                    ) : (
                      <div className="min-h-24 rounded-[0.75rem] border border-dashed border-[color:var(--app-border)] opacity-40" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

function cnText(...parts: Array<string | null | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}
