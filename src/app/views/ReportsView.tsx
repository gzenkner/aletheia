import React from "react";
import type { Trade } from "../types";
import { fmtMoney } from "../format";

type DayCell = {
  isoDay: string; // YYYY-MM-DD
  day: number;
  pnl: number;
  trades: number;
};

type TsRange = "5y" | "3y" | "1y" | "ytd" | "1m" | "1w";

const TS_RANGE_OPTIONS: TsRange[] = ["5y", "3y", "1y", "ytd", "1m", "1w"];

const TS_RANGE_LABEL: Record<TsRange, string> = {
  "5y": "5Y",
  "3y": "3Y",
  "1y": "1Y",
  ytd: "YTD",
  "1m": "1M",
  "1w": "1W"
};

function formatTsTick(iso: string, range: TsRange): string {
  const [yy, mm, dd] = iso.split("-").map(Number);
  const date = new Date(yy, (mm || 1) - 1, dd || 1);
  if (range === "1w" || range === "1m") return iso.slice(5);
  if (range === "ytd") return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

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

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, delta: number): string {
  const [yy, mm, dd] = iso.split("-").map(Number);
  const d = new Date(yy, (mm || 1) - 1, dd || 1);
  d.setDate(d.getDate() + delta);
  return isoDay(d);
}

function addMonths(iso: string, delta: number): string {
  const [yy, mm, dd] = iso.split("-").map(Number);
  const d = new Date(yy, (mm || 1) - 1, dd || 1);
  d.setMonth(d.getMonth() + delta);
  return isoDay(d);
}

function addYears(iso: string, delta: number): string {
  const [yy, mm, dd] = iso.split("-").map(Number);
  const d = new Date(yy, (mm || 1) - 1, dd || 1);
  d.setFullYear(d.getFullYear() + delta);
  return isoDay(d);
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
  const [tsRange, setTsRange] = React.useState<TsRange>("1m");
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

  const tsWindow = React.useMemo(() => {
    const end = todayIso;
    const start =
      tsRange === "1w"
        ? addDays(end, -6)
        : tsRange === "1m"
          ? addMonths(end, -1)
          : tsRange === "1y"
            ? addYears(end, -1)
            : tsRange === "3y"
              ? addYears(end, -3)
              : tsRange === "5y"
                ? addYears(end, -5)
                : `${end.slice(0, 4)}-01-01`;
    return { start, end };
  }, [todayIso, tsRange]);

  const tsSeries = React.useMemo(() => {
    const map = new Map<string, { volume: number; pnl: number }>();
    for (const t of trades) {
      const day = t.openDatetime.slice(0, 10);
      if (day < tsWindow.start || day > tsWindow.end) continue;
      const cur = map.get(day) ?? { volume: 0, pnl: 0 };
      cur.volume += Math.abs(t.volume);
      cur.pnl += t.grossPnl;
      map.set(day, cur);
    }

    const days: string[] = [];
    for (let d = tsWindow.start; d <= tsWindow.end; d = addDays(d, 1)) {
      days.push(d);
    }

    return days.map((day) => {
      const cur = map.get(day) ?? { volume: 0, pnl: 0 };
      return { day, volume: cur.volume, pnl: cur.pnl };
    });
  }, [trades, tsWindow.end, tsWindow.start]);

  const tsChart = React.useMemo(() => {
    const width = 980;
    const height = 260;
    const pad = { l: 48, r: 12, t: 12, b: 28 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const n = Math.max(1, tsSeries.length);
    const maxVolume = Math.max(1, ...tsSeries.map((d) => d.volume));
    const minPnl = Math.min(0, ...tsSeries.map((d) => d.pnl));
    const maxPnl = Math.max(0, ...tsSeries.map((d) => d.pnl));
    const pnlSpan = Math.max(1e-6, maxPnl - minPnl);
    const xFor = (i: number) => pad.l + (i / Math.max(1, n - 1)) * innerW;
    const yVol = (v: number) => pad.t + innerH - (v / maxVolume) * innerH;
    const yPnl = (v: number) => pad.t + innerH - ((v - minPnl) / pnlSpan) * innerH;
    const zeroY = yPnl(0);
    const barW = Math.max(1, (innerW / n) * 0.7);

    const pnlPath =
      tsSeries.length > 0
        ? tsSeries.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yPnl(d.pnl)}`).join(" ")
        : "";

    const tickEvery = Math.max(1, Math.floor(tsSeries.length / 7));

    return { width, height, pad, zeroY, barW, xFor, yVol, yPnl, pnlPath, tickEvery };
  }, [tsSeries]);

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

      <div className="app-card grid gap-3 rounded-[1rem] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-base font-semibold">Daily volume &amp; P/L time series</div>
          <div className="flex flex-wrap gap-2">
            {TS_RANGE_OPTIONS.map((range) => (
              <button
                key={range}
                type="button"
                className={cnText(
                  "rounded-[0.6rem] px-3 py-1.5 text-xs font-semibold",
                  range === tsRange ? "app-nav-active border" : "app-ghost-outline"
                )}
                onClick={() => setTsRange(range)}
              >
                {TS_RANGE_LABEL[range]}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs app-muted">
          Bars = volume • line = P/L • window: {tsWindow.start} → {tsWindow.end}
        </div>

        <div className="overflow-x-auto">
          <svg
            role="img"
            aria-label="Daily volume and profit/loss time series"
            className="block w-full min-w-[820px]"
            viewBox={`0 0 ${tsChart.width} ${tsChart.height}`}
            height={tsChart.height}
            preserveAspectRatio="xMidYMid meet"
          >
            <line x1={tsChart.pad.l} x2={tsChart.width - tsChart.pad.r} y1={tsChart.zeroY} y2={tsChart.zeroY} stroke="var(--app-border)" />
            {tsSeries.map((d, i) => {
              const x = tsChart.xFor(i) - tsChart.barW / 2;
              const y = tsChart.yVol(d.volume);
              const h = tsChart.pad.t + (tsChart.height - tsChart.pad.t - tsChart.pad.b) - y;
              return (
                <g key={`${d.day}-vol`}>
                  <rect
                    x={x}
                    y={y}
                    width={tsChart.barW}
                    height={Math.max(1, h)}
                    fill="var(--outcome-accent)"
                    opacity={0.7}
                  />
                  <title>{`${d.day}\nVolume: ${d.volume.toFixed(0)}\nP/L: ${fmtMoney(d.pnl)}`}</title>
                </g>
              );
            })}
            {tsChart.pnlPath ? (
              <path d={tsChart.pnlPath} fill="none" stroke="var(--outcome-accent-strong)" strokeWidth={2.5} strokeLinecap="round" />
            ) : null}
            {tsSeries.map((d, i) => (
              <circle key={`${d.day}-point`} cx={tsChart.xFor(i)} cy={tsChart.yPnl(d.pnl)} r={3.2} fill="var(--outcome-accent-strong)">
                <title>{`${d.day}\nVolume: ${d.volume.toFixed(0)}\nP/L: ${fmtMoney(d.pnl)}`}</title>
              </circle>
            ))}
            {tsSeries.map((d, i) => (
              <rect
                key={`${d.day}-hover`}
                x={tsChart.xFor(i) - Math.max(8, tsChart.barW * 0.55)}
                y={tsChart.pad.t}
                width={Math.max(16, tsChart.barW * 1.1)}
                height={tsChart.height - tsChart.pad.t - tsChart.pad.b}
                fill="transparent"
              >
                <title>{`${d.day}\nVolume: ${d.volume.toFixed(0)}\nP/L: ${fmtMoney(d.pnl)}`}</title>
              </rect>
            ))}
            {tsSeries.map((d, i) => {
              if (i % tsChart.tickEvery !== 0 && i !== tsSeries.length - 1) return null;
              return (
                <text key={`${d.day}-tick`} x={tsChart.xFor(i)} y={tsChart.height - 8} textAnchor="middle" fontSize="10" fill="var(--app-muted)">
                  {formatTsTick(d.day, tsRange)}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

function cnText(...parts: Array<string | null | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}
