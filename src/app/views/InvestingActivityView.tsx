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

function Row({ a, active, onSelect }: { a: InvestingActivity; active: boolean; onSelect: () => void }) {
  const title = a.ticker || a.name || a.isin || a.action;
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-[0.6rem] border px-2.5 py-2 text-left transition",
        active ? "app-nav-active" : "border-[color:var(--app-border)] bg-[color:var(--app-card)] hover:bg-[color:var(--app-nav-hover)]"
      )}
      onClick={onSelect}
      title={a.name}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold">{title}</div>
          <div className="mt-0.5 truncate text-[10px] app-muted">
            {a.action} • {a.time}
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
  onSelect
}: {
  activities: InvestingActivity[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const [sortNewestFirst, setSortNewestFirst] = React.useState(true);
  const sortedActivities = React.useMemo(
    () =>
      [...activities].sort((a, b) => {
        const diff = timeValue(b.time) - timeValue(a.time);
        return sortNewestFirst ? diff : -diff;
      }),
    [activities, sortNewestFirst]
  );
  const selected = React.useMemo(
    () => sortedActivities.find((a) => a.id === selectedId) ?? sortedActivities[0],
    [selectedId, sortedActivities]
  );

  React.useEffect(() => {
    if (!selectedId && selected?.id) onSelect(selected.id);
  }, [onSelect, selected?.id, selectedId]);

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
    <div className="grid h-full min-h-0 gap-2 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="min-h-0">
        <Card className="app-panel flex h-full min-h-0 flex-col rounded-[0.7rem] p-1.5">
          <div className="flex items-center justify-between gap-3 px-1.5 pb-2">
            <div className="app-kicker">Activity</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="app-ghost-outline rounded-[0.5rem] px-2 py-0.5 text-[10px] font-semibold"
                onClick={() => setSortNewestFirst((prev) => !prev)}
              >
                Time: {sortNewestFirst ? "Newest" : "Oldest"}
              </button>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 gap-1.5 overflow-y-auto pr-1">
            {sortedActivities.map((a) => (
              <Row key={a.id} a={a} active={a.id === selected?.id} onSelect={() => onSelect(a.id)} />
            ))}
          </div>
        </Card>
      </div>

      {selected ? (
        <div className="h-full min-h-0">
          <Card className="app-card-soft h-full min-h-0 overflow-hidden rounded-[0.7rem] p-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="app-kicker">Transaction</div>
                <div className="font-display mt-0.5 text-[15px] font-semibold">{selected.ticker || selected.name || selected.isin || "—"}</div>
                <div className="mt-0.5 text-[11px] app-muted">
                  {selected.action} • {selected.time}
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
          </Card>
        </div>
      ) : null}
    </div>
  );
}
