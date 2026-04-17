import React from "react";
import type { InvestingActivity } from "../types";
import Card from "../ui/Card";
import { cn } from "../ui/cn";

function money(amount: number, ccy: string): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return ccy ? `${sign}${abs} ${ccy}` : `${sign}${abs}`;
}

function toneClass(n: number): string {
  if (n > 0) return "text-emerald-700";
  if (n < 0) return "text-rose-700";
  return "app-muted";
}

function timeValue(time: string): number {
  const ts = new Date(time.replace(" ", "T") + "Z").getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function dateOnly(time: string): string {
  const day = (time || "").slice(0, 10);
  return day || time || "—";
}

function isMarketBuy(action: string): boolean {
  return action.trim().toLowerCase() === "market buy";
}

function isMarketSell(action: string): boolean {
  return action.trim().toLowerCase() === "market sell";
}

type InstrumentMetric = {
  instrument: string;
  realizedPnl: number;
  buys: number;
  sells: number;
  openQty: number;
  buyTrades: number;
  sellTrades: number;
};

function instrumentKey(activity: InvestingActivity): string {
  const isin = (activity.isin || "").trim();
  if (isin) return `isin:${isin}`;
  const ticker = (activity.ticker || "").trim().toUpperCase();
  if (ticker) return `ticker:${ticker}`;
  const name = (activity.name || "").trim().toLowerCase();
  if (name) return `name:${name}`;
  return "unknown";
}

function instrumentLabel(activity: InvestingActivity): string {
  return (activity.ticker || activity.name || activity.isin || "UNKNOWN").trim();
}

function Row({ a, active, onSelect }: { a: InvestingActivity; active: boolean; onSelect: () => void }) {
  const title = a.ticker || a.name || a.isin || a.action;
  const actionLower = a.action.trim().toLowerCase();
  const isBuy = actionLower === "market buy";
  const isSell = actionLower === "market sell";
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-[0.6rem] border px-2.5 py-2 text-left transition",
        active ? "app-nav-active" : "border-[color:var(--app-border)] bg-[color:var(--app-card)] hover:bg-[color:var(--app-nav-hover)]",
        !active && isBuy ? "border-emerald-200/70 bg-emerald-50/35 hover:bg-emerald-50/55" : "",
        !active && isSell ? "border-rose-200/70 bg-rose-50/35 hover:bg-rose-50/55" : ""
      )}
      onClick={onSelect}
      title={a.name}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold">{title}</div>
          <div className="mt-0.5 truncate text-[10px] app-muted">
            <span
              className={cn(
                "rounded-[0.35rem] px-1 py-[1px] font-semibold",
                isBuy ? "bg-emerald-100 text-emerald-700" : "",
                isSell ? "bg-rose-100 text-rose-700" : ""
              )}
            >
              {a.action}
            </span>{" "}
            • {dateOnly(a.time)}
            {a.notes ? ` • ${a.notes}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-semibold tabular-nums">{a.total ? money(a.total, a.totalCurrency) : "—"}</div>
        </div>
      </div>
    </button>
  );
}

export default function InvestingActivityView({
  activities,
  selectedId,
  onSelect,
  reportingCurrency
}: {
  activities: InvestingActivity[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  reportingCurrency: "GBP" | "USD";
}) {
  const [sortNewestFirst, setSortNewestFirst] = React.useState(true);
  const [autoSelectToken, setAutoSelectToken] = React.useState(0);
  const [activityQuery, setActivityQuery] = React.useState("");
  const [instrumentDateFrom, setInstrumentDateFrom] = React.useState("");
  const [instrumentDateTo, setInstrumentDateTo] = React.useState("");
  const [instrumentPnlFilter, setInstrumentPnlFilter] = React.useState<"all" | "pos" | "neg">("all");
  const [instrumentQuery, setInstrumentQuery] = React.useState("");
  const sortedActivities = React.useMemo(
    () =>
      [...activities].sort((a, b) => {
        const diff = timeValue(b.time) - timeValue(a.time);
        return sortNewestFirst ? diff : -diff;
      }),
    [activities, sortNewestFirst]
  );
  const filteredActivities = React.useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    if (!q) return sortedActivities;
    return sortedActivities.filter((activity) => {
      const label = `${activity.ticker || ""} ${activity.name || ""} ${activity.isin || ""} ${activity.action || ""} ${dateOnly(activity.time)}`.toLowerCase();
      return label.includes(q);
    });
  }, [activityQuery, sortedActivities]);
  const selected = React.useMemo(
    () => filteredActivities.find((a) => a.id === selectedId) ?? filteredActivities[0],
    [filteredActivities, selectedId]
  );
  const stockMetrics = React.useMemo<InstrumentMetric[]>(() => {
    const ordered = [...activities].sort((a, b) => timeValue(a.time) - timeValue(b.time));
    const map = new Map<
      string,
      { label: string; qty: number; cost: number; buys: number; sells: number; realizedPnl: number; buyTrades: number; sellTrades: number }
    >();
    for (const activity of ordered) {
      const day = dateOnly(activity.time);
      if (instrumentDateFrom && day < instrumentDateFrom) continue;
      if (instrumentDateTo && day > instrumentDateTo) continue;
      if (activity.totalCurrency !== reportingCurrency) continue;
      const total = Number(activity.total || 0);
      const shares = Number(activity.shares || 0);
      if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(shares) || shares <= 0) continue;
      const key = instrumentKey(activity);
      const current = map.get(key) ?? {
        label: instrumentLabel(activity),
        qty: 0,
        cost: 0,
        buys: 0,
        sells: 0,
        realizedPnl: 0,
        buyTrades: 0,
        sellTrades: 0
      };
      if (current.label === "UNKNOWN" && instrumentLabel(activity) !== "UNKNOWN") current.label = instrumentLabel(activity);
      if (isMarketBuy(activity.action)) {
        current.qty += shares;
        current.cost += total;
        current.buys += total;
        current.buyTrades += 1;
      } else if (isMarketSell(activity.action)) {
        current.sells += total;
        current.sellTrades += 1;
        if (current.qty > 1e-12 && current.cost > 1e-12) {
          const closeQty = Math.min(current.qty, shares);
          const avgCost = current.cost / current.qty;
          const closedCost = avgCost * closeQty;
          current.realizedPnl += total - closedCost;
          current.qty -= closeQty;
          current.cost -= closedCost;
          if (current.qty <= 1e-12 || current.cost <= 1e-12) {
            current.qty = 0;
            current.cost = 0;
          }
        } else {
          current.realizedPnl += total;
        }
      }
      map.set(key, current);
    }
    const byLabel = new Map<string, InstrumentMetric>();
    for (const metric of map.values()) {
      const instrument = metric.label || "UNKNOWN";
      const labelKey = instrument.toUpperCase();
      const current = byLabel.get(labelKey) ?? { instrument, realizedPnl: 0, buys: 0, sells: 0, openQty: 0, buyTrades: 0, sellTrades: 0 };
      current.realizedPnl += metric.realizedPnl;
      current.buys += metric.buys;
      current.sells += metric.sells;
      current.openQty += metric.qty;
      current.buyTrades += metric.buyTrades;
      current.sellTrades += metric.sellTrades;
      byLabel.set(labelKey, current);
    }

    const q = instrumentQuery.trim().toLowerCase();
    return [...byLabel.values()]
      .filter((m) => (q ? m.instrument.toLowerCase().includes(q) : true))
      .filter((m) => (instrumentPnlFilter === "pos" ? m.realizedPnl > 0 : instrumentPnlFilter === "neg" ? m.realizedPnl < 0 : true))
      .sort((a, b) => b.realizedPnl - a.realizedPnl);
  }, [activities, instrumentDateFrom, instrumentDateTo, instrumentPnlFilter, instrumentQuery, reportingCurrency]);

  React.useEffect(() => {
    if (!selectedId && selected?.id) onSelect(selected.id);
  }, [onSelect, selected?.id, selectedId]);

  const lastHandledAutoSelectTokenRef = React.useRef(0);
  React.useEffect(() => {
    if (autoSelectToken === 0) return;
    if (autoSelectToken === lastHandledAutoSelectTokenRef.current) return;
    lastHandledAutoSelectTokenRef.current = autoSelectToken;
    const first = filteredActivities[0];
    if (!first?.id) return;
    onSelect(first.id);
  }, [autoSelectToken, filteredActivities, onSelect]);

  if (!activities.length) {
    return (
      <Card className="app-card-soft rounded-[0.95rem] p-6">
        <div className="app-kicker">Activity</div>
        <div className="font-display mt-2 text-lg font-semibold">Import a Trading 212 CSV to start.</div>
        <div className="mt-2 text-sm leading-6 app-muted">This portal stores investing activity separately from day-trading trades.</div>
      </Card>
    );
  }

  return (
    <div className="grid h-full min-h-0 gap-2 overflow-hidden lg:grid-cols-3">
      <div className="min-h-0">
        <Card className="app-panel flex h-full min-h-0 flex-col rounded-[0.7rem] p-1.5">
          <div className="flex items-center justify-between gap-3 px-1.5 pb-2">
            <div className="app-kicker">Activity</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="app-ghost-outline rounded-[0.5rem] px-2 py-0.5 text-[10px] font-semibold"
                onClick={() => {
                  setSortNewestFirst((prev) => !prev);
                  setAutoSelectToken((prev) => prev + 1);
                }}
              >
                Time: {sortNewestFirst ? "Newest" : "Oldest"}
              </button>
            </div>
          </div>
          <div className="px-1.5 pb-1.5">
            <input
              type="text"
              className="app-input h-7 w-full rounded-[0.5rem] px-2 text-[10px] focus:outline-none"
              value={activityQuery}
              onChange={(e) => {
                setActivityQuery(e.target.value);
                setAutoSelectToken((prev) => prev + 1);
              }}
              placeholder="Search activities..."
            />
          </div>
          <div className="grid min-h-0 flex-1 gap-1.5 overflow-y-auto pr-1">
            {filteredActivities.length ? (
              filteredActivities.map((a) => <Row key={a.id} a={a} active={a.id === selected?.id} onSelect={() => onSelect(a.id)} />)
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] app-muted">No activities found</div>
            )}
          </div>
        </Card>
      </div>

      <div className="h-full min-h-0">
        <Card className="app-card-soft h-full min-h-0 overflow-hidden rounded-[0.7rem] p-2">
          {selected ? (
            <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="app-kicker">Transaction</div>
                <div className="font-display mt-0.5 text-[15px] font-semibold">{selected.ticker || selected.name || selected.isin || "—"}</div>
                <div className="mt-0.5 text-[11px] app-muted">
                  {selected.action} • {dateOnly(selected.time)}
                </div>
                {selected.notes ? <div className="mt-0.5 text-[11px] app-muted">{selected.notes}</div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selected.result ? (
                  <span className={cn("app-pill rounded-[999px] px-2 py-0.5 text-[11px] font-semibold", toneClass(selected.result))}>
                    {money(selected.result, selected.resultCurrency)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-1.5 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Shares</div>
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{selected.shares || 0}</div>
              </div>
              <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Price / share</div>
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{selected.pricePerShare ? money(selected.pricePerShare, selected.priceCurrency) : "—"}</div>
              </div>
              <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Total</div>
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{selected.total ? money(selected.total, selected.totalCurrency) : "—"}</div>
              </div>
              <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">FX rate</div>
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{selected.exchangeRate || 0}</div>
              </div>
            </div>
            {selected.withholdingTax || selected.stampDutyReserveTax || selected.currencyConversionFee || selected.frenchTransactionTax ? (
              <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {selected.withholdingTax ? (
                  <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] app-muted">Withholding tax</div>
                    <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{money(selected.withholdingTax, selected.withholdingTaxCurrency)}</div>
                  </div>
                ) : null}
                {selected.stampDutyReserveTax ? (
                  <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] app-muted">Stamp duty</div>
                    <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{money(selected.stampDutyReserveTax, selected.stampDutyReserveTaxCurrency)}</div>
                  </div>
                ) : null}
                {selected.currencyConversionFee ? (
                  <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] app-muted">FX fee</div>
                    <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{money(selected.currencyConversionFee, selected.currencyConversionFeeCurrency)}</div>
                  </div>
                ) : null}
                {selected.frenchTransactionTax ? (
                  <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] app-muted">French transaction tax</div>
                    <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{money(selected.frenchTransactionTax, selected.frenchTransactionTaxCurrency)}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] app-muted">Select an activity</div>
          )}
        </Card>
      </div>

      <div className="min-h-0">
        <Card className="app-card-soft flex h-full min-h-0 flex-col rounded-[0.7rem] p-2">
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="app-kicker">Instrument Metrics</div>
            <div className="text-right">
              <div className="text-[10px] font-semibold tabular-nums">Unique {stockMetrics.length}</div>
              <div className="text-[10px] app-muted">Realized P/L ({reportingCurrency})</div>
            </div>
          </div>
          <div className="grid gap-1 pb-1 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-0.5 sm:col-span-2 lg:col-span-1">
              <span className="text-[10px] app-muted">Instrument</span>
              <input
                type="text"
                className="app-input h-6 rounded-[0.45rem] px-1.5 text-[10px] focus:outline-none"
                value={instrumentQuery}
                onChange={(e) => setInstrumentQuery(e.target.value)}
                placeholder="Search symbol…"
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-[10px] app-muted">From</span>
              <input
                type="date"
                className="app-input h-6 rounded-[0.45rem] px-1.5 text-[10px] focus:outline-none"
                value={instrumentDateFrom}
                onChange={(e) => setInstrumentDateFrom(e.target.value)}
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-[10px] app-muted">To</span>
              <input
                type="date"
                className="app-input h-6 rounded-[0.45rem] px-1.5 text-[10px] focus:outline-none"
                value={instrumentDateTo}
                onChange={(e) => setInstrumentDateTo(e.target.value)}
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-[10px] app-muted">P/L</span>
              <select
                className="app-input h-6 rounded-[0.45rem] px-1.5 text-[10px] focus:outline-none"
                value={instrumentPnlFilter}
                onChange={(e) => setInstrumentPnlFilter(e.target.value as "all" | "pos" | "neg")}
              >
                <option value="all">All</option>
                <option value="pos">Winners</option>
                <option value="neg">Losers</option>
              </select>
            </label>
          </div>
          <div className="grid min-h-0 flex-1 gap-1 overflow-y-auto pr-1">
            {stockMetrics.length ? (
              stockMetrics.map((metric) => (
                <div key={metric.instrument} className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[11px] font-semibold">{metric.instrument}</div>
                    <div className={cn("text-[11px] font-semibold tabular-nums", toneClass(metric.realizedPnl))}>{money(metric.realizedPnl, reportingCurrency)}</div>
                  </div>
                  <div className="mt-0.5 grid gap-0.5 text-[10px] app-muted tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span>Trades {metric.buyTrades + metric.sellTrades}</span>
                      <span>Buys {metric.buyTrades}</span>
                      <span>Sells {metric.sellTrades}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Buy {money(metric.buys, reportingCurrency)}</span>
                      <span>Avg buy {metric.buyTrades > 0 ? money(metric.buys / metric.buyTrades, reportingCurrency) : "—"}</span>
                      <span>Owned {metric.openQty.toFixed(3)} sh</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] app-muted">No instruments for filters</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
