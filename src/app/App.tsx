import React from "react";
import { actions, useAppState } from "./store";
import type { AppTab } from "./types";
import { filterTrades } from "./analytics";
import { getAccentThemeStyle } from "./theme";
import { cn } from "./ui/cn";
import HomeView from "./views/HomeView";
import JournalView from "./views/JournalView";
import ReportsView from "./views/ReportsView";
import SettingsView from "./views/SettingsView";
import StrategyView from "./views/StrategyView";
import TradesPageView from "./views/TradesPageView";

const TAB_META: Record<AppTab, { label: string; hint: string }> = {
  home: { label: "Home", hint: "basic stats" },
  trades: { label: "Trades", hint: "review executions" },
  reports: { label: "Reports", hint: "monthly calendar" },
  strategy: { label: "Strategy", hint: "your rules" },
  journal: { label: "Journal", hint: "daily notes" },
  settings: { label: "Settings", hint: "theme and resets" }
};

function Tabs({ className }: { className?: string }) {
  const activeTab = useAppState((s) => s.ui.activeTab);
  const tradesCount = useAppState((s) => s.trades.length);

  return (
    <nav className={cn("flex flex-wrap gap-2", className)}>
      {(Object.keys(TAB_META) as AppTab[]).map((key) => {
        const active = key === activeTab;
        const label = key === "trades" ? `${TAB_META[key].label} (${tradesCount})` : TAB_META[key].label;
        return (
            <button
              key={key}
              type="button"
              title={TAB_META[key].hint}
              className={cn(
              "app-ghost-outline rounded-[0.65rem] px-3 py-2 text-base font-semibold transition",
              active ? "app-nav-active" : "hover:bg-[color:var(--app-nav-hover)]"
            )}
              onClick={() => actions.setActiveTab(key)}
            >
              {label}
          </button>
        );
      })}
    </nav>
  );
}

function TradeFilters() {
  const sideFilter = useAppState((s) => s.ui.sideFilter);
  const dateFrom = useAppState((s) => s.ui.dateFrom);
  const dateTo = useAppState((s) => s.ui.dateTo);

  return (
    <div className="app-panel flex flex-wrap items-end gap-3 rounded-[1rem] p-3 md:p-4">
      <label className="grid gap-1">
        <div className="text-sm opacity-70">Side</div>
        <select
          className="app-input h-11 rounded-[0.6rem] px-3 text-base focus:outline-none"
          value={sideFilter}
          onChange={(e) => actions.setSideFilter(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="L">Long</option>
          <option value="S">Short</option>
        </select>
      </label>

      <label className="grid gap-1">
        <div className="text-sm opacity-70">From</div>
        <input
          type="date"
          className="app-input h-11 rounded-[0.6rem] px-3 text-base focus:outline-none"
          value={dateFrom ?? ""}
          onChange={(e) => actions.setDateFrom(e.target.value || undefined)}
        />
      </label>

      <label className="grid gap-1">
        <div className="text-sm opacity-70">To</div>
        <input
          type="date"
          className="app-input h-11 rounded-[0.6rem] px-3 text-base focus:outline-none"
          value={dateTo ?? ""}
          onChange={(e) => actions.setDateTo(e.target.value || undefined)}
        />
      </label>
    </div>
  );
}

export default function App() {
  const themeMode = useAppState((s) => s.ui.themeMode);
  const accent = useAppState((s) => s.ui.accent);
  const tab = useAppState((s) => s.ui.activeTab);

  const trades = useAppState((s) => s.trades);
  const reflections = useAppState((s) => s.reflections);
  const imports = useAppState((s) => s.imports);

  const selectedTradeId = useAppState((s) => s.ui.selectedTradeId);
  const sideFilter = useAppState((s) => s.ui.sideFilter);
  const dateFrom = useAppState((s) => s.ui.dateFrom);
  const dateTo = useAppState((s) => s.ui.dateTo);

  const filteredTrades = React.useMemo(
    () => filterTrades(trades, { sideFilter, dateFrom, dateTo }),
    [dateFrom, dateTo, sideFilter, trades]
  );

  const selected = filteredTrades.find((t) => t.id === selectedTradeId) ?? filteredTrades[0];
  const selectedReflection = selected ? reflections[selected.id] : undefined;

  return (
    <div className="app-shell h-dvh w-dvw" data-app-theme={themeMode} style={getAccentThemeStyle(accent)}>
      <div className="h-full w-full p-3 md:p-4">
        <div className="flex h-full min-h-0 flex-col gap-3 md:gap-4">
            <header className="flex flex-wrap items-center justify-between gap-3 md:hidden">
              <div className="text-base font-semibold">TradeLogger</div>
              <Tabs />
            </header>

            {tab === "trades" || tab === "reports" ? <TradeFilters /> : null}

            <main className="app-panel min-h-0 flex-1 overflow-auto rounded-[1rem] p-4 text-base leading-6 md:p-5">
              {tab === "home" ? <HomeView trades={filteredTrades} onOpenTrades={() => actions.setActiveTab("trades")} /> : null}
              {tab === "trades" ? (
                <TradesPageView
                  trades={filteredTrades}
                  selectedTradeId={selected?.id}
                  onSelectTrade={(id) => actions.setSelectedTradeId(id)}
                  reflection={selected ? selectedReflection : undefined}
                  onChangeReflection={(update) => {
                    if (!selected) return;
                    actions.upsertReflection(selected.id, update);
                  }}
                  onToggleMistake={(mistake) => {
                    if (!selected) return;
                    actions.toggleReflectionMistake(selected.id, mistake);
                  }}
                />
              ) : null}
              {tab === "reports" ? <ReportsView trades={filteredTrades} /> : null}
              {tab === "strategy" ? <StrategyView /> : null}
              {tab === "journal" ? <JournalView trades={trades} /> : null}
              {tab === "settings" ? (
                <SettingsView
                  themeMode={themeMode}
                  accent={accent}
                  imports={imports}
                  onChangeThemeMode={(mode) => actions.setThemeMode(mode)}
                  onChangeAccent={(next) => actions.setAccent(next)}
                  onClearAll={() => actions.clearAll()}
                />
              ) : null}
            </main>

            <Tabs className="hidden md:flex" />
        </div>
      </div>
    </div>
  );
}
