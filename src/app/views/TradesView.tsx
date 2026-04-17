import React from "react";
import type { Trade, TradeReflection } from "../types";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { fmtDurationMs, fmtMoney, fmtPct, parseDatetimeLocal } from "../format";
import { cn } from "../ui/cn";

function pnlTone(pnl: number): string {
  if (pnl > 0) return "text-emerald-700";
  if (pnl < 0) return "text-rose-700";
  return "text-[color:var(--app-muted)]";
}

function pnlPillClass(pnl: number): string {
  if (pnl > 0) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (pnl < 0) return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-[color:var(--app-border)] bg-[color:var(--app-elevated)] text-[color:var(--app-muted)]";
}

function dateOnly(datetime: string): string {
  const day = (datetime || "").slice(0, 10);
  return day || datetime || "—";
}

function datetimeValue(datetime: string): number {
  const ts = new Date(datetime.replace(" ", "T") + "Z").getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function TradeRow({ trade, active, onSelect }: { trade: Trade; active: boolean; onSelect: () => void }) {
  const open = parseDatetimeLocal(trade.openDatetime);
  const close = parseDatetimeLocal(trade.closeDatetime);
  const hold = open && close ? close.getTime() - open.getTime() : 0;

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-[0.6rem] border px-2.5 py-2 text-left transition",
        active ? "app-nav-active" : "border-[color:var(--app-border)] bg-[color:var(--app-card)] hover:bg-[color:var(--app-nav-hover)]"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold">{trade.symbol}</div>
          <div className="mt-0.5 truncate text-[10px] app-muted">
            {String(trade.side).toUpperCase()} • {dateOnly(trade.openDatetime)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={cn("text-[11px] font-semibold tabular-nums", pnlTone(trade.grossPnl))}>{fmtMoney(trade.grossPnl)}</div>
          <div className="mt-0.5 text-[10px] app-muted tabular-nums">{trade.volume} sh</div>
        </div>
      </div>
      <div className="mt-1 text-[10px] app-muted">
        {dateOnly(trade.openDatetime)} → {dateOnly(trade.closeDatetime)} {hold > 0 ? `• ${fmtDurationMs(hold)}` : ""}
      </div>
    </button>
  );
}

function ReflectionPanel({
  tradeId,
  reflection,
  onChange,
  onToggleMistake
}: {
  tradeId: string;
  reflection: TradeReflection | undefined;
  onChange: (update: Partial<Omit<TradeReflection, "id" | "updatedAt">>) => void;
  onToggleMistake: (mistake: string) => void;
}) {
  void tradeId;
  const mistakes = reflection?.mistakes ?? [];
  const mistakeOptions = [
    "Chased entry",
    "No clear invalidation",
    "Sized too big",
    "Moved stop (worse)",
    "Took profit too early",
    "Held and hoped",
    "Added to weakness",
    "Overtraded",
    "Ignored market context",
    "Sloppy execution"
  ];

  return (
    <Card className="app-card rounded-[0.95rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="app-kicker">Reflection</div>
          <div className="mt-1 text-xs app-muted">Make the next trade easier: label it, grade it, write one lesson.</div>
        </div>
        <div className="text-[11px] app-muted">Saved locally • {reflection?.updatedAt ? new Date(reflection.updatedAt).toLocaleString() : "not yet reviewed"}</div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <div className="text-sm font-semibold">Setup</div>
          <Input
            value={reflection?.setup ?? ""}
            onChange={(e) => onChange({ setup: e.target.value })}
            placeholder="e.g. gap-and-go, breakout, reclaim"
          />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Grade</div>
          <select
            className="app-select h-10 w-full rounded-[0.6rem] border border-[color:var(--app-border)] bg-[color:var(--app-input)] px-3 text-sm focus:outline-none"
            value={reflection?.grade ?? ""}
            onChange={(e) => onChange({ grade: e.target.value as any })}
          >
            <option value="">Select…</option>
            <option value="A">A (clean)</option>
            <option value="B">B (ok)</option>
            <option value="C">C (messy)</option>
            <option value="F">F (process break)</option>
          </select>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Followed plan?</div>
          <select
            className="app-select h-10 w-full rounded-[0.6rem] border border-[color:var(--app-border)] bg-[color:var(--app-input)] px-3 text-sm focus:outline-none"
            value={reflection?.followedPlan ?? ""}
            onChange={(e) => onChange({ followedPlan: e.target.value as any })}
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="partial">Partially</option>
            <option value="no">No</option>
          </select>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Emotion</div>
          <Input value={reflection?.emotion ?? ""} onChange={(e) => onChange({ emotion: e.target.value })} placeholder="calm, rushed, revenge…" />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold">Mistakes</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {mistakeOptions.map((m) => {
            const active = mistakes.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => onToggleMistake(m)}
                className={cn(
                  "rounded-[999px] border px-3 py-1 text-[12px] font-semibold transition",
                  active
                    ? "border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] text-[color:var(--outcome-ink)]"
                    : "border-[color:var(--app-border)] bg-[color:var(--app-elevated)] text-[color:var(--app-muted)] hover:bg-[color:var(--app-nav-hover)]"
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <div className="text-sm font-semibold">Lesson</div>
          <Textarea value={reflection?.lesson ?? ""} onChange={(e) => onChange({ lesson: e.target.value })} placeholder="One sentence. What’s the rule?" rows={4} />
        </div>
        <div className="grid gap-2">
          <div className="text-sm font-semibold">Next time</div>
          <Textarea value={reflection?.nextTime ?? ""} onChange={(e) => onChange({ nextTime: e.target.value })} placeholder="What will you do differently?" rows={4} />
        </div>
      </div>
    </Card>
  );
}

export default function TradesView({
  trades,
  selectedTradeId,
  onSelectTrade,
  reflection,
  onChangeReflection,
  onToggleMistake
}: {
  trades: Trade[];
  selectedTradeId: string | undefined;
  onSelectTrade: (tradeId: string) => void;
  reflection: TradeReflection | undefined;
  onChangeReflection: (update: Partial<Omit<TradeReflection, "id" | "updatedAt">>) => void;
  onToggleMistake: (mistake: string) => void;
}) {
  const [sortNewestFirst, setSortNewestFirst] = React.useState(true);
  const sortedTrades = React.useMemo(
    () =>
      [...trades].sort((a, b) => {
        const diff = datetimeValue(b.openDatetime) - datetimeValue(a.openDatetime);
        return sortNewestFirst ? diff : -diff;
      }),
    [sortNewestFirst, trades]
  );
  const selected = React.useMemo(() => sortedTrades.find((t) => t.id === selectedTradeId) ?? sortedTrades[0], [selectedTradeId, sortedTrades]);

  React.useEffect(() => {
    if (!selectedTradeId && selected?.id) onSelectTrade(selected.id);
  }, [onSelectTrade, selected?.id, selectedTradeId]);

  React.useEffect(() => {
    const first = sortedTrades[0];
    if (!first?.id) return;
    if (selectedTradeId !== first.id) onSelectTrade(first.id);
  }, [onSelectTrade, selectedTradeId, sortNewestFirst, sortedTrades]);

  if (!trades.length) {
    return (
      <Card className="app-card-soft rounded-[0.95rem] p-6">
        <div className="app-kicker">Trades</div>
        <div className="font-display mt-2 text-lg font-semibold">Import a CSV to start reviewing.</div>
        <div className="mt-2 text-sm leading-6 app-muted">Once imported, you’ll see a list here with a reflection panel per trade.</div>
      </Card>
    );
  }

  const open = selected ? parseDatetimeLocal(selected.openDatetime) : null;
  const close = selected ? parseDatetimeLocal(selected.closeDatetime) : null;
  const hold = open && close ? close.getTime() - open.getTime() : 0;

  return (
    <div className="grid h-full min-h-0 gap-2 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="min-h-0">
        <Card className="app-panel flex h-full min-h-0 flex-col rounded-[0.7rem] p-1.5">
          <div className="flex items-center justify-between gap-3 px-1.5 pb-2">
            <div className="app-kicker">Activity</div>
            <button
              type="button"
              className="app-ghost-outline rounded-[0.5rem] px-2 py-0.5 text-[10px] font-semibold"
              onClick={() => setSortNewestFirst((prev) => !prev)}
            >
              Time: {sortNewestFirst ? "Newest" : "Oldest"}
            </button>
          </div>
          <div className="grid min-h-0 flex-1 gap-1.5 overflow-y-auto pr-1">
            {sortedTrades.map((t) => (
              <TradeRow key={t.id} trade={t} active={t.id === selected?.id} onSelect={() => onSelectTrade(t.id)} />
            ))}
          </div>
        </Card>
      </div>

      {selected ? (
        <div className="min-h-0 grid gap-2 overflow-y-auto pr-1">
          <Card className="app-card-soft rounded-[0.7rem] p-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="app-kicker">Transaction</div>
                <div className="font-display mt-0.5 text-[15px] font-semibold">{selected.symbol}</div>
                <div className="mt-0.5 text-[11px] app-muted">
                  {String(selected.side).toUpperCase()} • {dateOnly(selected.openDatetime)} → {dateOnly(selected.closeDatetime)}
                  {hold > 0 ? ` • ${fmtDurationMs(hold)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("app-pill rounded-[999px] px-2 py-0.5 text-[11px] font-semibold", pnlPillClass(selected.grossPnl))}>
                  {fmtMoney(selected.grossPnl)} <span className="ml-1 text-[10px] opacity-75">({fmtPct(selected.grossPnlPct)})</span>
                </span>
                <span className="app-pill rounded-[999px] px-2 py-0.5 text-[11px] font-semibold">{selected.volume} sh</span>
              </div>
            </div>

            <div className="mt-1.5 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Entry</div>
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{selected.entryPrice.toFixed(2)}</div>
              </div>
              <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Exit</div>
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{selected.exitPrice.toFixed(2)}</div>
              </div>
              <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">MFE / MAE</div>
                <div className="mt-0.5 text-[11px] font-semibold">
                  <span className="text-emerald-700">{fmtMoney(selected.positionMfe)}</span> <span className="app-muted">/</span>{" "}
                  <span className="text-rose-700">{fmtMoney(selected.positionMae)}</span>
                </div>
              </div>
              <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Execs</div>
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums">{selected.execCount}</div>
              </div>
            </div>

            {selected.notes || selected.tags ? (
              <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {selected.tags ? (
                  <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                    <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Tags</div>
                    <div className="mt-0.5 text-[11px] font-semibold">{selected.tags}</div>
                  </div>
                ) : null}
                {selected.notes ? (
                  <div className="rounded-[0.55rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-1.5">
                    <div className="text-[10px] uppercase tracking-[0.12em] app-muted">Notes</div>
                    <div className="mt-0.5 text-[11px]">{selected.notes}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <ReflectionPanel tradeId={selected.id} reflection={reflection} onChange={onChangeReflection} onToggleMistake={onToggleMistake} />
        </div>
      ) : null}
    </div>
  );
}
