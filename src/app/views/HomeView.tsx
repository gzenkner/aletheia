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

function HoverMetricCard({
  tooltip,
  className,
  children
}: {
  tooltip: string;
  className?: string;
  children: React.ReactNode;
}) {
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const [tooltipShift, setTooltipShift] = React.useState(0);

  const updateTooltipPosition = React.useCallback(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const rect = tooltip.getBoundingClientRect();
    const padding = 12;
    let shift = 0;
    if (rect.right > window.innerWidth - padding) {
      shift -= rect.right - (window.innerWidth - padding);
    }
    if (rect.left < padding) {
      shift += padding - rect.left;
    }
    setTooltipShift(shift);
  }, []);

  return (
    <div
      className={`group relative cursor-help ${className ?? ""}`}
      onMouseEnter={updateTooltipPosition}
      onFocus={updateTooltipPosition}
    >
      {children}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 w-72 rounded-[0.45rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-2 py-1 text-[10px] leading-4 text-[color:var(--app-text)] opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        style={{ transform: `translateX(${tooltipShift}px)` }}
      >
        {tooltip}
      </div>
    </div>
  );
}

function PiePL({
  angle,
  label,
  tooltip,
  profitText,
  lossText,
  netText
}: {
  angle: number;
  label: string;
  tooltip: string;
  profitText: string;
  lossText: string;
  netText: string;
}) {
  return (
    <HoverMetricCard tooltip={tooltip}>
      <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-3">
        <div className="text-[13px] font-semibold leading-5">{label}</div>
        <div className="mt-2 flex items-center gap-3">
          <svg viewBox="0 0 140 140" className="h-16 w-16 shrink-0" aria-label={label}>
            {angle > 0 ? <path d={arcPath(70, 70, 58, 0, angle)} fill="var(--app-signal-green-fill)" opacity={0.9} /> : null}
            {angle < 360 ? <path d={arcPath(70, 70, 58, angle, 360)} fill="var(--app-signal-red-fill)" opacity={0.82} /> : null}
            <circle cx="70" cy="70" r="30" fill="var(--app-card)" />
          </svg>
          <div className="grid min-w-0 gap-0.5 text-[12px] leading-5">
            <div className="truncate tabular-nums text-[color:var(--app-signal-green-text)]">{profitText}</div>
            <div className="truncate tabular-nums text-[color:var(--app-signal-red-text)]">{lossText}</div>
            <div className="truncate tabular-nums font-semibold">{netText}</div>
          </div>
        </div>
      </div>
    </HoverMetricCard>
  );
}

type HomeMetric = { label: string; value: string; tooltip: string; tone?: "positive" | "negative" | "neutral" };
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

const RANGE_STATUS_LABELS: Record<MetricsRange, string> = {
  "5y": "Last 5 years",
  "3y": "Last 3 years",
  "1y": "Last 12 months",
  ytd: "Year to date",
  "3m": "Last 3 months",
  "1m": "Last 30 days",
  "7d": "Last 7 days"
};

const PRICE_LEVEL_BUCKETS = [
  { label: "1-4", min: 1, max: 4 },
  { label: "4-8", min: 4, max: 8 },
  { label: "8-12", min: 8, max: 12 },
  { label: "12-16", min: 12, max: 16 },
  { label: "16-20", min: 16, max: 20 },
  { label: "20+", min: 20, max: Number.POSITIVE_INFINITY }
] as const;

const TIME_OF_DAY_BUCKETS = [
  { label: "2:30-3", startMinutes: 14 * 60 + 30, endMinutes: 15 * 60 },
  { label: "3-3:30", startMinutes: 15 * 60, endMinutes: 15 * 60 + 30 },
  { label: "3:30-4", startMinutes: 15 * 60 + 30, endMinutes: 16 * 60 },
  { label: "4-5", startMinutes: 16 * 60, endMinutes: 17 * 60 },
  { label: "After 5", startMinutes: 17 * 60, endMinutes: Number.POSITIVE_INFINITY }
] as const;

function MetricCard({ label, value, tooltip, tone = "neutral" }: HomeMetric) {
  const toneClass =
    tone === "positive"
      ? "text-[color:var(--app-signal-green-text)] bg-[color:var(--app-signal-green-bg)] border-[color:var(--app-signal-green-border)]"
      : tone === "negative"
        ? "text-[color:var(--app-signal-red-text)] bg-[color:var(--app-signal-red-bg)] border-[color:var(--app-signal-red-border)]"
        : "text-[color:var(--app-text)] bg-[color:var(--app-card)] border-[color:var(--app-border)]";
  return (
    <HoverMetricCard tooltip={tooltip}>
      <div className={`rounded-xl border p-3 ${toneClass}`}>
        <div className="text-xs opacity-70">{label}</div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </HoverMetricCard>
  );
}

function minutesFromTradeDatetime(datetime: string): number | null {
  const match = datetime.match(/\b(\d{2}):(\d{2})(?::\d{2})?\b/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
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

  const priceLevelPnl = React.useMemo(() => {
    const buckets = PRICE_LEVEL_BUCKETS.map((bucket) => ({
      ...bucket,
      pnl: 0,
      tradeCount: 0
    }));

    for (const trade of metricsWindow.filtered) {
      const entryPrice = Number(trade.entryPrice);
      if (!Number.isFinite(entryPrice) || entryPrice < 1) continue;
      const bucket = buckets.find((item) => entryPrice >= item.min && entryPrice < item.max);
      if (!bucket) continue;
      bucket.pnl += trade.grossPnl;
      bucket.tradeCount += 1;
    }

    const maxAbsPnl = Math.max(1, ...buckets.map((bucket) => Math.abs(bucket.pnl)));
    return { buckets, maxAbsPnl };
  }, [metricsWindow.filtered]);

  const timeOfDayPnl = React.useMemo(() => {
    const buckets = TIME_OF_DAY_BUCKETS.map((bucket) => ({
      ...bucket,
      pnl: 0,
      tradeCount: 0
    }));

    for (const trade of metricsWindow.filtered) {
      const minutes = minutesFromTradeDatetime(trade.openDatetime);
      if (minutes === null) continue;
      const bucket = buckets.find((item) => minutes >= item.startMinutes && minutes < item.endMinutes);
      if (!bucket) continue;
      bucket.pnl += trade.grossPnl;
      bucket.tradeCount += 1;
    }

    const maxAbsPnl = Math.max(1, ...buckets.map((bucket) => Math.abs(bucket.pnl)));
    return { buckets, maxAbsPnl };
  }, [metricsWindow.filtered]);

  const metrics: HomeMetric[] = [
    {
      label: "Total P/L",
      value: fmtMoney(stats.grossPnl),
      tooltip: `Metric: Total P/L. Calculation: sum of gross P/L across all trades in the selected range. Example: if three trades are +£120, -£50, and +£30, total P/L = +£100.`,
      tone: stats.grossPnl >= 0 ? "positive" : "negative"
    },
    {
      label: "Trades",
      value: String(stats.count),
      tooltip: "Metric: Trades. Calculation: count every trade whose open date falls inside the selected range. Example: if 18 trades opened during the range, Trades = 18."
    },
    {
      label: "Win rate",
      value: stats.count ? fmtPct(stats.winRate * 100) : "—",
      tooltip: "Metric: Win rate. Calculation: winning trades divided by total trades in the selected range. Example: 12 winning trades out of 20 total trades = 60% win rate.",
      tone: stats.winRate >= 0.5 ? "positive" : "negative"
    },
    {
      label: "Expectancy",
      value: fmtMoney(stats.expectancy),
      tooltip: "Metric: Expectancy. Calculation: total P/L divided by number of trades. Example: if total P/L is +£250 across 10 trades, expectancy = +£25 per trade.",
      tone: stats.expectancy >= 0 ? "positive" : "negative"
    }
  ];

  if (!trades.length) {
    return (
      <div className="grid gap-4">
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
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="grid gap-3">
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
          <div className="inline-flex w-fit items-center gap-2 rounded-[0.8rem] border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] px-3 py-2 text-sm shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-muted)]">Range</span>
            <span className="font-semibold tabular-nums text-[color:var(--outcome-ink)]">
              {RANGE_STATUS_LABELS[metricsRange]} <span className="opacity-80">({metricsWindow.start} → {metricsWindow.end})</span>
            </span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[420px] xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <PiePL
          angle={pnlRange.profitAngle}
          label={`Overall P/L (${RANGE_LABELS[metricsRange]})`}
          tooltip="Metric: Overall P/L split. Calculation: add all positive P/L to gross profit, add the absolute value of all negative P/L to gross loss, then compare the two. Example: +£400 total winners and -£150 total losers gives gross profit £400, gross loss £150, net +£250."
          profitText={`Gross profit: ${fmtMoney(pnlRange.profit)}`}
          lossText={`Gross loss: -${fmtMoney(pnlRange.loss).replace("-", "")}`}
          netText={`Net: ${fmtMoney(pnlRange.net)}`}
        />
        <PiePL
          angle={pnlRangeFraction.profitAngle}
          label={`Fraction P/L (${RANGE_LABELS[metricsRange]})`}
          tooltip="Metric: Fraction P/L. Calculation: count winning trades and losing trades in the selected range, then compare those counts. Example: 7 winners and 3 losers means the split is 70% winners and 30% losers."
          profitText={`Winning trades: ${pnlRangeFraction.wins}`}
          lossText={`Losing trades: ${pnlRangeFraction.losses}`}
          netText={`Win-loss delta: ${pnlRangeFraction.net}`}
        />
        <PiePL
          angle={pnlRangeAvgWinLoss.profitAngle}
          label={`Average win / loss (${RANGE_LABELS[metricsRange]})`}
          tooltip="Metric: Average win / loss. Calculation: average all winning-trade P/L values, average the absolute value of all losing-trade P/L values, then divide avg win by avg loss. Example: average win £80 and average loss £40 gives a 2.00:1 ratio."
          profitText={`Avg win: ${fmtMoney(pnlRangeAvgWinLoss.avgWin)}`}
          lossText={`Avg loss: -${fmtMoney(pnlRangeAvgWinLoss.avgLoss).replace("-", "")}`}
          netText={`Ratio: ${Number.isFinite(pnlRangeAvgWinLoss.ratio) ? pnlRangeAvgWinLoss.ratio.toFixed(2) : "∞"}:1`}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">P/L by stock price level</div>
              <div className="text-xs app-muted">Buckets use entry price within the selected range</div>
            </div>
          </div>
          <div className="mt-4 max-w-[20rem] space-y-2">
            {priceLevelPnl.buckets.map((bucket) => {
              const barWidthPct = Math.max(2, Math.abs(bucket.pnl) / priceLevelPnl.maxAbsPnl * 100);
              const fillClass =
                bucket.pnl >= 0
                  ? "bg-[color:var(--app-signal-green-fill)]"
                  : "bg-[color:var(--app-signal-red-fill)]";
              return (
                <HoverMetricCard
                  key={bucket.label}
                  tooltip={`${bucket.label}. Metric: total P/L for trades with entry prices in this level. Calculation: sum gross P/L for all trades with entry price ${bucket.label === "20+" ? "20 or more" : `from ${bucket.min} up to ${bucket.max}`}. Trades: ${bucket.tradeCount}. P/L: ${fmtMoney(bucket.pnl)}.`}
                >
                  <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-2">
                    <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">{bucket.label}</div>
                    <div className="h-3 rounded-full bg-[color:var(--app-elevated)]">
                      <div className={`h-3 rounded-full ${fillClass}`} style={{ width: `${barWidthPct}%` }} />
                    </div>
                    <div className="text-[11px] font-semibold tabular-nums">{fmtMoney(bucket.pnl)}</div>
                  </div>
                </HoverMetricCard>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">P/L by time of day</div>
              <div className="text-xs app-muted">Buckets use trade open time within the selected range</div>
            </div>
          </div>
          <div className="mt-4 max-w-[20rem] space-y-2">
            {timeOfDayPnl.buckets.map((bucket) => {
              const barWidthPct = Math.max(2, Math.abs(bucket.pnl) / timeOfDayPnl.maxAbsPnl * 100);
              const fillClass =
                bucket.pnl >= 0
                  ? "bg-[color:var(--app-signal-green-fill)]"
                  : "bg-[color:var(--app-signal-red-fill)]";
              return (
                <HoverMetricCard
                  key={bucket.label}
                  tooltip={`${bucket.label}. Metric: total P/L for trades opened in this time bucket. Calculation: sum gross P/L for all trades whose open time falls between ${bucket.label === "After 5" ? "17:00 and later" : bucket.label}. Trades: ${bucket.tradeCount}. P/L: ${fmtMoney(bucket.pnl)}.`}
                >
                  <div className="grid grid-cols-[3.8rem_1fr_auto] items-center gap-2">
                    <div className="text-[11px] font-semibold text-[color:var(--app-muted)]">{bucket.label}</div>
                    <div className="h-3 rounded-full bg-[color:var(--app-elevated)]">
                      <div className={`h-3 rounded-full ${fillClass}`} style={{ width: `${barWidthPct}%` }} />
                    </div>
                    <div className="text-[11px] font-semibold tabular-nums">{fmtMoney(bucket.pnl)}</div>
                  </div>
                </HoverMetricCard>
              );
            })}
          </div>
        </div>
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
            <HoverMetricCard
              key={item.day}
              tooltip={`${dayLabel(item.day)} (${item.day}). Metric: realized day P/L and trade count. Calculation: sum gross P/L for all trades opened on this day and count those trades. Example: trades of +£90, -£35, and +£10 on the same day produce day P/L of +£65 across 3 trades.`}
            >
              <div className={`rounded-xl border p-3 ${tone}`}>
                <div className="text-xs opacity-75">{dayLabel(item.day)}</div>
                <div className="mt-1 text-base font-semibold tabular-nums">{fmtMoney(item.pnl)}</div>
                <div className="mt-1 text-xs opacity-70">{item.count} trade{item.count === 1 ? "" : "s"}</div>
              </div>
            </HoverMetricCard>
          );
        })}
      </div>
    </div>
  );
}
