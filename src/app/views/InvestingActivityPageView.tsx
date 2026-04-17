import React from "react";
import type { ImportSummary, InvestingActivity } from "../types";
import { actions, useAppState } from "../store";
import { convertAmount, type ReportingCurrency } from "../fx";
import InvestingActivityView from "./InvestingActivityView";
import InvestingLoadView from "./InvestingLoadView";

function isMarketBuy(action: string): boolean {
  return action.trim().toLowerCase() === "market buy";
}

function isMarketSell(action: string): boolean {
  return action.trim().toLowerCase() === "market sell";
}

function asReportingCurrency(currency: string): ReportingCurrency | undefined {
  if (currency === "GBP" || currency === "USD" || currency === "EUR") return currency;
  return undefined;
}

type CashFlow = { date: string; amount: number };
type Lot = { qty: number; boughtAt: Date };
type PurchaseTimelinePoint = { period: string; amount: number };

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

function npvAtRate(rate: number, flows: CashFlow[]): number {
  const t0 = new Date(`${flows[0]!.date}T00:00:00Z`);
  let sum = 0;
  for (const f of flows) {
    const t = new Date(`${f.date}T00:00:00Z`);
    const years = daysBetween(t0, t) / 365.2425;
    sum += f.amount / Math.pow(1 + rate, years);
  }
  return sum;
}

function computeXirr(flows: CashFlow[]): number | undefined {
  if (flows.length < 2) return undefined;
  const hasPos = flows.some((f) => f.amount > 0);
  const hasNeg = flows.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) return undefined;

  let lo = -0.9999;
  let hi = 10;
  let fLo = npvAtRate(lo, flows);
  let fHi = npvAtRate(hi, flows);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return undefined;

  for (let i = 0; i < 12 && fLo * fHi > 0; i++) {
    hi *= 2;
    fHi = npvAtRate(hi, flows);
    if (!Number.isFinite(fHi)) return undefined;
  }
  if (fLo * fHi > 0) return undefined;

  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAtRate(mid, flows);
    if (!Number.isFinite(fMid)) return undefined;
    if (Math.abs(fMid) < 1e-8) return mid;
    if (fLo * fMid <= 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
    if (Math.abs(hi - lo) < 1e-10) return (lo + hi) / 2;
  }

  return (lo + hi) / 2;
}

function fmtMoney(n: number, currency: ReportingCurrency): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}${symbol}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function clampPct(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function pnlToneClasses(value: number | undefined): string {
  if (typeof value !== "number") return "border-[color:var(--app-border)] bg-[color:var(--app-elevated)]";
  if (value > 0) return "border-emerald-300 bg-emerald-50/70";
  if (value < 0) return "border-rose-300 bg-rose-50/70";
  return "border-[color:var(--app-border)] bg-[color:var(--app-elevated)]";
}

function inferAsOfDay(activities: InvestingActivity[]): string {
  let max = "";
  for (const a of activities) {
    const d = (a.time || "").slice(0, 10);
    if (d && d > max) max = d;
  }
  return max;
}

function inferDateRange(activities: InvestingActivity[]): { minDay: string; maxDay: string } {
  let minDay = "";
  let maxDay = "";
  for (const a of activities) {
    const d = (a.time || "").slice(0, 10);
    if (!d) continue;
    if (!minDay || d < minDay) minDay = d;
    if (!maxDay || d > maxDay) maxDay = d;
  }
  return { minDay, maxDay };
}

function buildPurchaseTimeline(activities: InvestingActivity[], currency: ReportingCurrency): PurchaseTimelinePoint[] {
  const spendByPeriod = new Map<string, number>();
  for (const activity of activities) {
    if (!isMarketBuy(activity.action)) continue;
    const day = (activity.time || "").slice(0, 10);
    if (!day) continue;
    const total = Number(activity.total || 0);
    if (!Number.isFinite(total) || total <= 0) continue;
    const sourceCurrency = asReportingCurrency(activity.totalCurrency || "");
    if (!sourceCurrency) continue;
    const convertedTotal = convertAmount(total, sourceCurrency, currency, day);
    if (typeof convertedTotal !== "number") continue;
    const period = day.slice(0, 7);
    spendByPeriod.set(period, (spendByPeriod.get(period) ?? 0) + convertedTotal);
  }
  return [...spendByPeriod.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([period, amount]) => ({ period, amount }));
}

function formatMonth(period: string): string {
  const [yearRaw, monthRaw] = period.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return period;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" });
}

function formatIsoDateHuman(isoDay: string): string {
  const [yearRaw, monthRaw, dayRaw] = isoDay.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDay || "-";
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}


const METRIC_TOOLTIPS = {
  mwrr: "Money-weighted return (XIRR) from buy/sell cash flows plus current portfolio value.",
  totalPnl: "Realized P/L plus unrealized P/L. Requires current value to compute unrealized.",
  realizedPnl: "Profit/loss from closed shares using average-cost matching.",
  amountInvested: "Total value of all buy transactions in selected currency.",
  netDeposits: "Total buys minus total sells in selected currency. Positive means net cash invested.",
  totalFxFees: "Sum of currency conversion fees in selected currency.",
  soldPct: "Sold shares divided by bought shares, shown as a percentage.",
  unique: "Number of unique instruments traded (ticker/ISIN based).",
  holdSold: "Average holding period in days for sold shares, weighted by sold quantity.",
  openPos: "Count of positions with remaining shares and positive cost basis.",
  openBasis: "Current cost basis of all open positions in selected currency."
} as const;

function MetricCard({
  tooltip,
  className,
  children
}: {
  tooltip: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`group relative rounded-[0.55rem] border px-2 py-1.5 cursor-help ${className ?? "border-[color:var(--app-border)] bg-[color:var(--app-elevated)]"}`}>
      {children}
      <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 w-60 rounded-[0.45rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-2 py-1 text-[10px] leading-4 text-[color:var(--app-text)] opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {tooltip}
      </div>
    </div>
  );
}

export default function InvestingActivityPageView({
  activities,
  selectedId,
  onSelect
}: {
  activities: InvestingActivity[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const account = useAppState((s) => s.investing.ui.trading212Account);
  const currentValueByAccount = useAppState((s) => s.investing.ui.trading212CurrentValueGbpByAccount);
  const [importOpen, setImportOpen] = React.useState(!activities.length);
  const [lastImportSummary, setLastImportSummary] = React.useState<ImportSummary | null>(null);
  const [reportingCurrency, setReportingCurrency] = React.useState<ReportingCurrency>("GBP");
  const currentValueGbp = currentValueByAccount[account];

  const profiler = React.useMemo(() => {
    const ordered = [...activities].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    const positions = new Map<string, { qty: number; cost: number }>();
    const lotsByStock = new Map<string, Lot[]>();
    const stockSet = new Set<string>();
    let buys = 0;
    let sells = 0;
    let buyCount = 0;
    let sellCount = 0;
    let boughtShares = 0;
    let soldShares = 0;
    let soldHoldMs = 0;
    let soldHoldShares = 0;
    let realizedPnl = 0;
    let totalFxFees = 0;
    const flows: CashFlow[] = [];

    for (const a of ordered) {
      const day = (a.time || "").slice(0, 10);
      if (!day) continue;
      const totalRaw = Number(a.total || 0);
      const shares = Number(a.shares || 0);
      const sourceCurrency = asReportingCurrency(a.totalCurrency || "");
      if (!sourceCurrency) continue;
      if (!Number.isFinite(totalRaw) || totalRaw <= 0) continue;
      const total = convertAmount(totalRaw, sourceCurrency, reportingCurrency, day);
      if (typeof total !== "number" || !Number.isFinite(total) || total <= 0) continue;
      if (!Number.isFinite(shares) || shares <= 0) continue;
      const fxFeeRaw = Number(a.currencyConversionFee || 0);
      const fxFeeCurrency = asReportingCurrency(a.currencyConversionFeeCurrency || a.totalCurrency || "");
      if (Number.isFinite(fxFeeRaw) && fxFeeRaw > 0 && fxFeeCurrency) {
        const convertedFxFee = convertAmount(fxFeeRaw, fxFeeCurrency, reportingCurrency, day);
        if (typeof convertedFxFee === "number" && Number.isFinite(convertedFxFee) && convertedFxFee > 0) totalFxFees += convertedFxFee;
      }

      const key = (a.ticker || a.isin || "UNKNOWN").trim();
      stockSet.add(key);
      const pos = positions.get(key) ?? { qty: 0, cost: 0 };
      const lots = lotsByStock.get(key) ?? [];
      const tradeAt = new Date(a.time.replace(" ", "T") + "Z");

      if (isMarketBuy(a.action)) {
        buys += total;
        buyCount++;
        boughtShares += shares;
        pos.qty += shares;
        pos.cost += total;
        positions.set(key, pos);
        if (Number.isFinite(tradeAt.getTime())) lots.push({ qty: shares, boughtAt: tradeAt });
        lotsByStock.set(key, lots);
        flows.push({ date: day, amount: -total });
      } else if (isMarketSell(a.action)) {
        sells += total;
        sellCount++;
        soldShares += shares;
        if (pos.qty > 0 && pos.cost > 0) {
          const avgCost = pos.cost / pos.qty;
          const closeQty = Math.min(shares, pos.qty);
          const costClosed = avgCost * closeQty;
          realizedPnl += total - costClosed;
          pos.qty -= closeQty;
          pos.cost -= costClosed;
          if (pos.qty <= 1e-12 || pos.cost <= 1e-12) {
            pos.qty = 0;
            pos.cost = 0;
          }
          positions.set(key, pos);
        } else {
          realizedPnl += total;
        }

        if (Number.isFinite(tradeAt.getTime()) && lots.length) {
          let remaining = shares;
          let idx = 0;
          while (remaining > 1e-12 && idx < lots.length) {
            const lot = lots[idx];
            const useQty = Math.min(remaining, lot.qty);
            const holdMs = tradeAt.getTime() - lot.boughtAt.getTime();
            if (holdMs >= 0) {
              soldHoldMs += holdMs * useQty;
              soldHoldShares += useQty;
            }
            lot.qty -= useQty;
            remaining -= useQty;
            if (lot.qty <= 1e-12) idx++;
          }
          lotsByStock.set(key, idx > 0 ? lots.slice(idx).filter((lot) => lot.qty > 1e-12) : lots.filter((lot) => lot.qty > 1e-12));
        }
        flows.push({ date: day, amount: total });
      }
    }

    let openCostBasis = 0;
    let openPositions = 0;
    for (const p of positions.values()) {
      if (p.qty > 1e-12 && p.cost > 1e-12) {
        openPositions++;
        openCostBasis += p.cost;
      }
    }

    const asOfDay = inferAsOfDay(activities);
    const { minDay, maxDay } = inferDateRange(activities);
    const netDeposits = buys - sells;
    const currentValue = (() => {
      if (typeof currentValueGbp !== "number" || !Number.isFinite(currentValueGbp) || currentValueGbp <= 0) return undefined;
      const valuationDay = asOfDay || maxDay || "";
      if (!valuationDay) return undefined;
      return convertAmount(currentValueGbp, "GBP", reportingCurrency, valuationDay);
    })();
    const fxFeePctOfBuys = buys > 0 ? (totalFxFees / buys) * 100 : undefined;
    const fxFeePctOfSells = sells > 0 ? (totalFxFees / sells) * 100 : undefined;
    const unrealisedPnl = typeof currentValue === "number" ? currentValue - openCostBasis : undefined;
    const totalPnl = typeof unrealisedPnl === "number" ? realizedPnl + unrealisedPnl : undefined;
    const avgHoldDaysForSold = soldHoldShares > 0 ? soldHoldMs / soldHoldShares / (1000 * 60 * 60 * 24) : undefined;
    const soldPct = boughtShares > 0 ? (soldShares / boughtShares) * 100 : undefined;

    const mwrr = (() => {
      if (typeof currentValue !== "number" || currentValue <= 0 || !asOfDay) return undefined;
      const calcFlows = [...flows, { date: asOfDay, amount: currentValue }].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return computeXirr(calcFlows);
    })();

    return {
      asOfDay,
      minDay,
      maxDay,
      buys,
      sells,
      netDeposits,
      fxFeePctOfBuys,
      fxFeePctOfSells,
      buyCount,
      sellCount,
      uniqueStocks: stockSet.size,
      avgHoldDaysForSold,
      soldPct,
      openPositions,
      openCostBasis,
      realizedPnl,
      totalFxFees,
      unrealisedPnl,
      totalPnl,
      mwrr
    };
  }, [activities, currentValueGbp, reportingCurrency]);

  React.useEffect(() => {
    if (!activities.length) setImportOpen(true);
  }, [activities.length]);

  const soldPct = clampPct(profiler.soldPct);
  const openPositionPct = profiler.uniqueStocks > 0 ? clampPct((profiler.openPositions / profiler.uniqueStocks) * 100) : 0;
  const valuationDay = profiler.asOfDay || profiler.maxDay || new Date().toISOString().slice(0, 10);
  const currentValueDisplay = React.useMemo(() => {
    if (typeof currentValueGbp !== "number" || !Number.isFinite(currentValueGbp) || currentValueGbp <= 0) return "";
    const converted = convertAmount(currentValueGbp, "GBP", reportingCurrency, valuationDay);
    return typeof converted === "number" && Number.isFinite(converted) ? converted.toFixed(2) : "";
  }, [currentValueGbp, reportingCurrency, valuationDay]);
  const purchaseTimeline = React.useMemo(() => buildPurchaseTimeline(activities, reportingCurrency), [activities, reportingCurrency]);
  const purchasePeak = React.useMemo(
    () => purchaseTimeline.reduce((max, point) => (point.amount > max ? point.amount : max), 0),
    [purchaseTimeline]
  );
  const timelinePoints = React.useMemo(() => {
    if (!purchaseTimeline.length || purchasePeak <= 0) return [];
    return purchaseTimeline.map((point, index) => {
      const x = purchaseTimeline.length === 1 ? 50 : 2 + (index / (purchaseTimeline.length - 1)) * 96;
      const y = 32 - (point.amount / purchasePeak) * 26;
      return { ...point, x, y };
    });
  }, [purchaseTimeline, purchasePeak]);
  const timelineLine = React.useMemo(
    () => timelinePoints.map((point) => `${point.x},${point.y}`).join(" "),
    [timelinePoints]
  );
  const timelineArea = React.useMemo(() => {
    if (!timelinePoints.length) return "";
    const first = timelinePoints[0];
    const last = timelinePoints[timelinePoints.length - 1];
    return `M ${first.x} 32 L ${timelinePoints.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${last.x} 32 Z`;
  }, [timelinePoints]);
  const [hoveredTimelineIndex, setHoveredTimelineIndex] = React.useState<number | null>(null);
  const hoveredTimelinePoint =
    hoveredTimelineIndex !== null && hoveredTimelineIndex >= 0 && hoveredTimelineIndex < timelinePoints.length
      ? timelinePoints[hoveredTimelineIndex]
      : undefined;

  const handleTimelineHover = React.useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!timelinePoints.length) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const relativeX = (event.clientX - bounds.left) / bounds.width;
      const clamped = Math.max(0, Math.min(1, relativeX));
      const nearestIndex = Math.round(clamped * (timelinePoints.length - 1));
      setHoveredTimelineIndex(nearestIndex);
    },
    [timelinePoints]
  );

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1.5 overflow-hidden">
      <section className="rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
        <div className="grid content-start gap-1.5">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[0.7rem] border border-[#d1d5db] bg-[#f3f4f6] px-2.5 py-2 text-[#374151]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-[11px] font-semibold tracking-[0.08em] text-[#111827]">Portfolio</div>
                <div className="flex items-center gap-1 rounded-[0.55rem] border border-[#d1d5db] bg-[#ffffff] px-1 py-1">
                  <span className="px-1 text-[10px] font-semibold text-[#6b7280]">Account</span>
                  <select
                    className="app-input h-6 rounded-[0.45rem] border border-[#d1d5db] bg-[#ffffff] px-2 text-[10px] font-semibold text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                    value={account}
                    onChange={(e) => actions.setTrading212Account(e.target.value as any)}
                  >
                    <option value="isa">ISA</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div className="flex items-center gap-1 rounded-[0.55rem] border border-[#d1d5db] bg-[#ffffff] px-1 py-1">
                  <span className="px-1 text-[10px] font-semibold text-[#6b7280]">Currency</span>
                  <select
                    className="app-input h-6 rounded-[0.45rem] border border-[#d1d5db] bg-[#ffffff] px-2 text-[10px] font-semibold text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                    value={reportingCurrency}
                    onChange={(e) => setReportingCurrency(e.target.value as ReportingCurrency)}
                    title="Reporting currency"
                  >
                    <option value="GBP">GBP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="flex items-center gap-1 rounded-[0.55rem] border border-[#d1d5db] bg-[#ffffff] px-1 py-1">
                  <span className="px-1 text-[10px] font-semibold text-[#6b7280]">Value</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="app-input h-6 w-24 rounded-[0.45rem] border border-[#d1d5db] bg-[#ffffff] px-2 text-[10px] font-semibold text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                    value={currentValueDisplay}
                    placeholder="0.00"
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (!Number.isFinite(raw) || raw <= 0) {
                        actions.setTrading212CurrentValueGbp(account, undefined);
                        return;
                      }
                      const gbpValue = convertAmount(raw, reportingCurrency, "GBP", valuationDay);
                      if (typeof gbpValue === "number" && Number.isFinite(gbpValue) && gbpValue > 0) {
                        actions.setTrading212CurrentValueGbp(account, gbpValue);
                      }
                    }}
                    title={`Current portfolio value in ${reportingCurrency}`}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="rounded-full border border-[#d1d5db] bg-[#ffffff] px-2 py-0.5 text-[10px] font-semibold text-[#374151]">
                  {account === "isa" ? "ISA" : "GENERAL"}
                </div>
                {!importOpen ? (
                  <button
                    type="button"
                    className="rounded-[0.55rem] border border-[#d1d5db] bg-[#ffffff] px-2 py-1 text-[10px] font-semibold text-[#374151] transition hover:border-[#2563eb] hover:bg-[#eff6ff]"
                    onClick={() => setImportOpen(true)}
                  >
                    Import CSV...
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {lastImportSummary ? (
            <div className="rounded-[0.5rem] border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-900">
              Imported {lastImportSummary.loaded}/{lastImportSummary.attempted} rows ({lastImportSummary.deduped} deduped)
            </div>
          ) : null}

          <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
            <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-2 py-1">
              <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Purchase Timeline</div>
              <div className="relative mt-1 h-[7.25rem] w-full rounded-[0.45rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1">
                {timelinePoints.length ? (
                  <>
                    <svg
                      viewBox="0 0 100 36"
                      className="h-full w-full"
                      onMouseMove={handleTimelineHover}
                      onMouseLeave={() => setHoveredTimelineIndex(null)}
                    >
                      <path d={timelineArea} fill="rgba(14, 165, 233, 0.14)" />
                      <polyline fill="none" stroke="#0284c7" strokeWidth="1.3" points={timelineLine} />
                      {hoveredTimelinePoint ? (
                        <line
                          x1={hoveredTimelinePoint.x}
                          y1="4"
                          x2={hoveredTimelinePoint.x}
                          y2="32"
                          stroke="rgba(2, 132, 199, 0.35)"
                          strokeWidth="0.8"
                          strokeDasharray="1.5 1.5"
                        />
                      ) : null}
                      {timelinePoints.map((point, index) => (
                        <circle
                          key={point.period}
                          cx={point.x}
                          cy={point.y}
                          r={hoveredTimelineIndex === index ? "2.1" : "1.3"}
                          fill={hoveredTimelineIndex === index ? "#0284c7" : "#0ea5e9"}
                        />
                      ))}
                    </svg>
                    {hoveredTimelinePoint ? (
                      <div className="pointer-events-none absolute left-2 top-2 rounded-[0.4rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-1.5 py-0.5 text-[10px] leading-4 text-[color:var(--app-text)] shadow-sm">
                        {formatMonth(hoveredTimelinePoint.period)}: {fmtMoney(hoveredTimelinePoint.amount, reportingCurrency)}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] app-muted">No purchases</div>
                )}
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[10px] app-muted">
                <span>{purchaseTimeline.length ? formatMonth(purchaseTimeline[0]!.period) : "-"}</span>
                <span>Peak {purchasePeak > 0 ? fmtMoney(purchasePeak, reportingCurrency) : "-"}</span>
                <span>
                  {purchaseTimeline.length ? formatMonth(purchaseTimeline[purchaseTimeline.length - 1]!.period) : "-"}
                </span>
              </div>
            </div>

            <div className="grid gap-1 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5">
              <MetricCard tooltip={METRIC_TOOLTIPS.totalPnl} className={pnlToneClasses(profiler.unrealisedPnl)}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Unrealized Value</div>
                <div className="text-sm font-semibold tabular-nums">
                  {typeof profiler.unrealisedPnl === "number"
                    ? fmtMoney(profiler.unrealisedPnl, reportingCurrency)
                    : typeof profiler.mwrr === "number"
                      ? fmtPct(profiler.mwrr * 100)
                      : "-"}
                </div>
              </MetricCard>

              <MetricCard tooltip={METRIC_TOOLTIPS.realizedPnl} className={pnlToneClasses(profiler.realizedPnl)}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Realized P/L</div>
                <div className="text-sm font-semibold tabular-nums">{fmtMoney(profiler.realizedPnl, reportingCurrency)}</div>
              </MetricCard>

              <MetricCard tooltip={METRIC_TOOLTIPS.mwrr}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">MWRR</div>
                <div className="text-sm font-semibold tabular-nums">{typeof profiler.mwrr === "number" ? fmtPct(profiler.mwrr * 100) : "Set value"}</div>
              </MetricCard>

              <MetricCard tooltip={METRIC_TOOLTIPS.netDeposits}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Net Deposits</div>
                <div className="text-sm font-semibold tabular-nums">{fmtMoney(profiler.netDeposits, reportingCurrency)}</div>
              </MetricCard>

              <MetricCard tooltip={METRIC_TOOLTIPS.amountInvested}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Amount Invested</div>
                <div className="text-sm font-semibold tabular-nums">{fmtMoney(profiler.buys, reportingCurrency)}</div>
              </MetricCard>

              <MetricCard tooltip={METRIC_TOOLTIPS.openBasis}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Open Basis</div>
                <div className="text-sm font-semibold tabular-nums">{fmtMoney(profiler.openCostBasis, reportingCurrency)}</div>
              </MetricCard>

              <MetricCard tooltip={METRIC_TOOLTIPS.soldPct}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Sold</div>
                <div className="text-sm font-semibold tabular-nums">{typeof profiler.soldPct === "number" ? fmtPct(profiler.soldPct) : "-"}</div>
                <div className="mt-1 h-1.5 rounded-full bg-[color:var(--app-border)]">
                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${soldPct}%` }} />
                </div>
              </MetricCard>

              <MetricCard tooltip={METRIC_TOOLTIPS.holdSold}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Hold (sold)</div>
                <div className="text-sm font-semibold tabular-nums">{typeof profiler.avgHoldDaysForSold === "number" ? `${profiler.avgHoldDaysForSold.toFixed(1)}d` : "-"}</div>
              </MetricCard>

              <MetricCard tooltip={METRIC_TOOLTIPS.openPos}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Open pos</div>
                <div className="text-sm font-semibold tabular-nums">{profiler.openPositions}</div>
                <div className="mt-1 h-1.5 rounded-full bg-[color:var(--app-border)]">
                  <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${openPositionPct}%` }} />
                </div>
              </MetricCard>

              <MetricCard tooltip={METRIC_TOOLTIPS.totalFxFees}>
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Total FX Fees</div>
                <div className="text-sm font-semibold tabular-nums">{fmtMoney(profiler.totalFxFees, reportingCurrency)}</div>
                <div className="mt-0.5 text-[10px] app-muted">
                  Buys {typeof profiler.fxFeePctOfBuys === "number" ? fmtPct(profiler.fxFeePctOfBuys) : "-"} | Sells {typeof profiler.fxFeePctOfSells === "number" ? fmtPct(profiler.fxFeePctOfSells) : "-"}
                </div>
              </MetricCard>
            </div>
          </div>

          {importOpen ? (
            <div className="max-h-[28vh] overflow-y-auto rounded-[0.65rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
              <InvestingLoadView
                onSuccess={(summary) => {
                  setLastImportSummary(summary);
                  setImportOpen(false);
                }}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] app-muted">Deep Dive</div>
        <div className="min-h-0">
          <InvestingActivityView activities={activities} selectedId={selectedId} onSelect={onSelect} reportingCurrency={reportingCurrency} />
        </div>
      </section>
    </div>
  );
}
