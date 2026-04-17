import React from "react";
import type { Trade } from "../types";
import { computeStats } from "../analytics";
import { fmtMoney, fmtPct } from "../format";

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

function dayLabel(iso: string): string {
  const [yy, mm, dd] = iso.split("-").map(Number);
  const d = new Date(yy, (mm || 1) - 1, dd || 1);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${cx} ${cy} Z`;
}

function PiePL({
  angle,
  label,
  description,
  profitText,
  lossText,
  netText
}: {
  angle: number;
  label: string;
  description: string;
  profitText: string;
  lossText: string;
  netText: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-4" title={description}>
      <div className="text-sm font-semibold" title={description}>{label}</div>
      <div className="mt-3 flex items-center gap-4">
        <svg viewBox="0 0 140 140" className="h-28 w-28" aria-label={label}>
          {angle > 0 ? <path d={arcPath(70, 70, 58, 0, angle)} fill="var(--app-signal-green-fill)" opacity={0.9} /> : null}
          {angle < 360 ? <path d={arcPath(70, 70, 58, angle, 360)} fill="var(--app-signal-red-fill)" opacity={0.82} /> : null}
          <circle cx="70" cy="70" r="30" fill="var(--app-card)" />
        </svg>
        <div className="grid gap-1 text-sm">
          <div className="tabular-nums text-[color:var(--app-signal-green-text)]">{profitText}</div>
          <div className="tabular-nums text-[color:var(--app-signal-red-text)]">{lossText}</div>
          <div className="tabular-nums font-semibold">{netText}</div>
        </div>
      </div>
    </div>
  );
}

type HomeMetric = { label: string; value: string; description: string; tone?: "positive" | "negative" | "neutral" };
type MetricsRange = "5y" | "3y" | "1y" | "ytd" | "3m" | "1m" | "7d";

const RANGE_OPTIONS: MetricsRange[] = ["5y", "3y", "1y", "ytd", "3m", "1m", "7d"];
const RANGE_LABELS: Record<MetricsRange, string> = {
  "5y": "5Y",
  "3y": "3Y",
  "1y": "1Y",
  ytd: "YTD",
  "3m": "3M",
  "1m": "1M",
  "7d": "7D"
};

function MetricCard({ label, value, description, tone = "neutral" }: HomeMetric) {
  const toneClass =
    tone === "positive"
      ? "text-[color:var(--app-signal-green-text)] bg-[color:var(--app-signal-green-bg)] border-[color:var(--app-signal-green-border)]"
      : tone === "negative"
        ? "text-[color:var(--app-signal-red-text)] bg-[color:var(--app-signal-red-bg)] border-[color:var(--app-signal-red-border)]"
        : "text-[color:var(--app-text)] bg-[color:var(--app-card)] border-[color:var(--app-border)]";
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`} title={description}>
      <div className="text-xs opacity-70" title={description}>{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function HomeView({ trades, onOpenTrades }: { trades: Trade[]; onOpenTrades: () => void }) {
  const [metricsRange, setMetricsRange] = React.useState<MetricsRange>("1m");

  const metricsWindow = React.useMemo(() => {
    const end = isoDay(new Date());
    const start =
      metricsRange === "1m"
        ? addMonths(end, -1)
        : metricsRange === "3m"
          ? addMonths(end, -3)
          : metricsRange === "1y"
            ? addYears(end, -1)
            : metricsRange === "3y"
              ? addYears(end, -3)
                : metricsRange === "5y"
                  ? addYears(end, -5)
                  : metricsRange === "7d"
                    ? addDays(end, -6)
                  : `${end.slice(0, 4)}-01-01`;
    const filtered = trades.filter((t) => {
      const day = t.openDatetime.slice(0, 10);
      return day >= start && day <= end;
    });
    return { start, end, filtered };
  }, [metricsRange, trades]);

  const stats = React.useMemo(() => computeStats(metricsWindow.filtered), [metricsWindow.filtered]);
  const last7Days = React.useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    for (const t of trades) {
      const day = t.openDatetime.slice(0, 10);
      const cur = map.get(day) ?? { pnl: 0, count: 0 };
      cur.pnl += t.grossPnl;
      cur.count += 1;
      map.set(day, cur);
    }

    const today = isoDay(new Date());
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    return days.map((day) => {
      const v = map.get(day) ?? { pnl: 0, count: 0 };
      return { day, pnl: v.pnl, count: v.count };
    });
  }, [trades]);

  const pnlRange = React.useMemo(() => {
    let profit = 0;
    let loss = 0;
    for (const t of metricsWindow.filtered) {
      if (t.grossPnl > 0) profit += t.grossPnl;
      if (t.grossPnl < 0) loss += Math.abs(t.grossPnl);
    }
    const total = profit + loss;
    const profitAngle = total > 0 ? (profit / total) * 360 : 0;
    return { profit, loss, net: profit - loss, profitAngle };
  }, [metricsWindow.filtered]);

  const pnlRangeFraction = React.useMemo(() => {
    let wins = 0;
    let losses = 0;
    for (const t of metricsWindow.filtered) {
      if (t.grossPnl > 0) wins += 1;
      if (t.grossPnl < 0) losses += 1;
    }
    const total = wins + losses;
    const profitAngle = total > 0 ? (wins / total) * 360 : 0;
    return { wins, losses, net: wins - losses, profitAngle };
  }, [metricsWindow.filtered]);

  const pnlRangeAvgWinLoss = React.useMemo(() => {
    let winSum = 0;
    let lossSum = 0;
    let winCount = 0;
    let lossCount = 0;
    for (const t of metricsWindow.filtered) {
      if (t.grossPnl > 0) {
        winSum += t.grossPnl;
        winCount += 1;
      } else if (t.grossPnl < 0) {
        lossSum += Math.abs(t.grossPnl);
        lossCount += 1;
      }
    }
    const avgWin = winCount ? winSum / winCount : 0;
    const avgLoss = lossCount ? lossSum / lossCount : 0;
    const total = avgWin + avgLoss;
    const profitAngle = total > 0 ? (avgWin / total) * 360 : 0;
    const ratio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
    return { avgWin, avgLoss, ratio, profitAngle };
  }, [metricsWindow.filtered]);

  const metrics: HomeMetric[] = [
    {
      label: "Total P/L",
      value: fmtMoney(stats.grossPnl),
      description: "Sum of gross P/L across all trades in the selected range.",
      tone: stats.grossPnl >= 0 ? "positive" : "negative"
    },
    { label: "Trades", value: String(stats.count), description: "Number of trades in the selected range." },
    {
      label: "Win rate",
      value: stats.count ? fmtPct(stats.winRate * 100) : "—",
      description: "Winning trades divided by total trades in the selected range.",
      tone: stats.winRate >= 0.5 ? "positive" : "negative"
    },
    {
      label: "Expectancy",
      value: fmtMoney(stats.expectancy),
      description: "Average P/L per trade: total P/L divided by number of trades.",
      tone: stats.expectancy >= 0 ? "positive" : "negative"
    }
  ];

  if (!trades.length) {
    return (
      <div className="grid gap-4">
        <h2 className="text-xl font-semibold">Home</h2>
        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-5">
          <div className="text-base font-semibold">No trades loaded yet</div>
          <div className="mt-2 app-muted">Import your CSV first, then this page will show your P/L trend and key stats.</div>
          <button type="button" className="app-button app-button-primary mt-4 h-10 rounded-[0.6rem] px-4" onClick={onOpenTrades}>
            Go to Trades
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">Home</h2>
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((range) => (
          <button
            key={range}
            type="button"
            className={`rounded-[0.65rem] px-3 py-1.5 text-sm font-semibold ${
              range === metricsRange ? "app-nav-active border" : "app-ghost-outline"
            }`}
            onClick={() => setMetricsRange(range)}
          >
            {RANGE_LABELS[range]}
          </button>
        ))}
      </div>
      <div className="text-xs app-muted">
        Range: {RANGE_LABELS[metricsRange]} ({metricsWindow.start} → {metricsWindow.end})
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <PiePL
          angle={pnlRange.profitAngle}
          label={`Overall P/L (${RANGE_LABELS[metricsRange]})`}
          description="Pie split of gross profit vs gross loss by dollar amount for the selected range."
          profitText={`Gross profit: ${fmtMoney(pnlRange.profit)}`}
          lossText={`Gross loss: -${fmtMoney(pnlRange.loss).replace("-", "")}`}
          netText={`Net: ${fmtMoney(pnlRange.net)}`}
        />
        <PiePL
          angle={pnlRangeFraction.profitAngle}
          label={`Fraction P/L (${RANGE_LABELS[metricsRange]})`}
          description="Pie split of number of winning trades vs losing trades for the selected range."
          profitText={`Winning trades: ${pnlRangeFraction.wins}`}
          lossText={`Losing trades: ${pnlRangeFraction.losses}`}
          netText={`Win-loss delta: ${pnlRangeFraction.net}`}
        />
        <PiePL
          angle={pnlRangeAvgWinLoss.profitAngle}
          label={`Average win / loss (${RANGE_LABELS[metricsRange]})`}
          description="Pie split using average win size versus average loss size. Ratio = avg win ÷ avg loss."
          profitText={`Avg win: ${fmtMoney(pnlRangeAvgWinLoss.avgWin)}`}
          lossText={`Avg loss: -${fmtMoney(pnlRangeAvgWinLoss.avgLoss).replace("-", "")}`}
          netText={`Ratio: ${Number.isFinite(pnlRangeAvgWinLoss.ratio) ? pnlRangeAvgWinLoss.ratio.toFixed(2) : "∞"}:1`}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {last7Days.map((item) => {
          const tone =
            item.pnl > 0
              ? "text-[color:var(--app-signal-green-text)] bg-[color:var(--app-signal-green-bg)] border-[color:var(--app-signal-green-border)]"
              : item.pnl < 0
                ? "text-[color:var(--app-signal-red-text)] bg-[color:var(--app-signal-red-bg)] border-[color:var(--app-signal-red-border)]"
                : "text-[color:var(--app-text)] bg-[color:var(--app-card)] border-[color:var(--app-border)]";
          return (
            <div key={item.day} className={`rounded-xl border p-3 ${tone}`}>
              <div className="text-xs opacity-75">{dayLabel(item.day)}</div>
              <div className="mt-1 text-base font-semibold tabular-nums">{fmtMoney(item.pnl)}</div>
              <div className="mt-1 text-xs opacity-70">{item.count} trade{item.count === 1 ? "" : "s"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
