import React from "react";
import type { ImportSummary, Trade, TradeReflection } from "../types";
import LoadTradesView from "./LoadTradesView";
import TradesView from "./TradesView";

export default function TradesPageView({
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
  const [importOpen, setImportOpen] = React.useState(!trades.length);
  const [lastImportSummary, setLastImportSummary] = React.useState<ImportSummary | null>(null);

  React.useEffect(() => {
    if (!trades.length) setImportOpen(true);
  }, [trades.length]);

  return (
    <div className="grid gap-4">
      {importOpen ? (
        <div className="rounded-[1rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-4">
          <LoadTradesView
            title="Import trades"
            onSuccess={(summary) => {
              setLastImportSummary(summary);
              setImportOpen(false);
            }}
          />
        </div>
      ) : (
        <div className="grid gap-2">
          {lastImportSummary ? (
            <div className="rounded-[0.75rem] border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
              <div className="font-semibold">CSV imported successfully</div>
              <div className="mt-1 text-xs">
                Attempted: {lastImportSummary.attempted} • Loaded: {lastImportSummary.loaded} • Deduped: {lastImportSummary.deduped}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-end">
          <button
            type="button"
            className="app-ghost-outline rounded-[0.65rem] px-3 py-2 text-base font-semibold transition hover:bg-[color:var(--app-nav-hover)]"
            onClick={() => setImportOpen(true)}
          >
            Import CSV…
          </button>
          </div>
        </div>
      )}

      <TradesView
        trades={trades}
        selectedTradeId={selectedTradeId}
        onSelectTrade={onSelectTrade}
        reflection={reflection}
        onChangeReflection={onChangeReflection}
        onToggleMistake={onToggleMistake}
      />
    </div>
  );
}
