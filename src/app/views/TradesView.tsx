import React from "react";
import type { Trade, TradeReflection } from "../types";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { fmtDateTime, fmtDurationMs, fmtMoney, fmtPct, parseDatetimeLocal } from "../format";
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

function TradeRow({ trade, active, onSelect }: { trade: Trade; active: boolean; onSelect: () => void }) {
  const open = parseDatetimeLocal(trade.openDatetime);
  const close = parseDatetimeLocal(trade.closeDatetime);
  const hold = open && close ? close.getTime() - open.getTime() : 0;

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-[0.65rem] border px-3 py-3 text-left transition",
        active ? "app-nav-active" : "border-[color:var(--app-border)] bg-[color:var(--app-card)] hover:bg-[color:var(--app-nav-hover)]"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-3.5 w-3.5 shrink-0 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-elevated)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-[13px] font-semibold">
              {trade.symbol} <span className="text-[11px] app-muted">{String(trade.side).toUpperCase()}</span>
            </div>
            <span className={cn("shrink-0 rounded-[999px] border px-2 py-1 text-[11px] font-semibold", pnlPillClass(trade.grossPnl))}>
              {fmtMoney(trade.grossPnl)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-[11px] app-muted">
            <div className="truncate">{trade.openDatetime.slice(11, 16)} → {trade.closeDatetime.slice(11, 16)}</div>
            <div className="shrink-0">{hold > 0 ? fmtDurationMs(hold) : "—"}</div>
          </div>
        </div>
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
  const selected = React.useMemo(() => trades.find((t) => t.id === selectedTradeId) ?? trades[0], [trades, selectedTradeId]);

  React.useEffect(() => {
    if (!selectedTradeId && selected?.id) onSelectTrade(selected.id);
  }, [onSelectTrade, selected?.id, selectedTradeId]);

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
    <div className="grid min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="min-h-0">
        <Card className="app-panel rounded-[0.95rem] p-3">
          <div className="flex items-center justify-between gap-3 px-2 pb-2">
            <div className="app-kicker">Trades</div>
            <div className="text-xs app-muted">{trades.length}</div>
          </div>
          <div className="grid gap-2">
            {trades.map((t) => (
              <TradeRow key={t.id} trade={t} active={t.id === selected?.id} onSelect={() => onSelectTrade(t.id)} />
            ))}
          </div>
        </Card>
      </div>

      {selected ? (
        <div className="min-h-0 grid gap-4">
          <Card className="app-card-soft sticky top-0 z-10 rounded-[0.95rem] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="app-kicker">Trade</div>
                <div className="font-display mt-2 text-2xl font-semibold">
                  {selected.symbol} <span className="text-base app-muted">{String(selected.side).toUpperCase()}</span>
                </div>
                <div className="mt-2 text-sm app-muted">
                  {fmtDateTime(selected.openDatetime)} → {fmtDateTime(selected.closeDatetime)} {hold > 0 ? `• ${fmtDurationMs(hold)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-[999px] border px-3 py-1 text-sm font-semibold", pnlPillClass(selected.grossPnl))}>
                  {fmtMoney(selected.grossPnl)} <span className="ml-1 text-xs opacity-75">({fmtPct(selected.grossPnlPct)})</span>
                </span>
                <span className="app-pill rounded-[999px] px-3 py-1 text-sm font-semibold">
                  {selected.volume} sh
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-3">
                <div className="text-[11px] uppercase tracking-[0.14em] app-muted">Entry</div>
                <div className="mt-1 text-sm font-semibold">{selected.entryPrice.toFixed(2)}</div>
              </div>
              <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-3">
                <div className="text-[11px] uppercase tracking-[0.14em] app-muted">Exit</div>
                <div className="mt-1 text-sm font-semibold">{selected.exitPrice.toFixed(2)}</div>
              </div>
              <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-3">
                <div className="text-[11px] uppercase tracking-[0.14em] app-muted">MFE / MAE</div>
                <div className="mt-1 text-sm font-semibold">
                  <span className="text-emerald-700">{fmtMoney(selected.positionMfe)}</span>{" "}
                  <span className="app-muted">/</span>{" "}
                  <span className="text-rose-700">{fmtMoney(selected.positionMae)}</span>
                </div>
              </div>
              <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-3">
                <div className="text-[11px] uppercase tracking-[0.14em] app-muted">Execs</div>
                <div className="mt-1 text-sm font-semibold">{selected.execCount}</div>
              </div>
            </div>

            {selected.notes || selected.tags ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {selected.tags ? (
                  <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] app-muted">Tags</div>
                    <div className="mt-1 text-sm font-semibold">{selected.tags}</div>
                  </div>
                ) : null}
                {selected.notes ? (
                  <div className="rounded-[0.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] app-muted">Notes</div>
                    <div className="mt-1 text-sm">{selected.notes}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <ReflectionPanel
            tradeId={selected.id}
            reflection={reflection}
            onChange={onChangeReflection}
            onToggleMistake={onToggleMistake}
          />
        </div>
      ) : null}
    </div>
  );
}
