import React from "react";
import { actions, useAppState } from "./store";
import type { AppTab, ProfileId } from "./types";
import { filterTrades } from "./analytics";
import { getAccentThemeStyle } from "./theme";
import { cn } from "./ui/cn";
import HomeView from "./views/HomeView";
import JournalView from "./views/JournalView";
import ReportsView from "./views/ReportsView";
import SettingsView from "./views/SettingsView";
import StrategyView from "./views/StrategyView";
import TradesPageView from "./views/TradesPageView";
import InvestingHomeView from "./views/InvestingHomeView";
import InvestingActivityPageView from "./views/InvestingActivityPageView";

function isMarketTradeRow(action: string, isin: string, ticker: string, shares: number): boolean {
  const a = action.trim().toLowerCase();
  const isMarketTrade = a === "market buy" || a === "market sell";
  const hasInstrument = Boolean(isin.trim() || ticker.trim());
  return isMarketTrade && hasInstrument && shares > 0;
}

function getTabMeta(profile: ProfileId): Record<AppTab, { label: string; hint: string }> {
  if (profile === "investing") {
    return {
      home: { label: "Home", hint: "overview" },
      trades: { label: "Activity", hint: "transactions" },
      reports: { label: "Performance", hint: "reports" },
      strategy: { label: "Policy", hint: "your rules" },
      journal: { label: "Notes", hint: "journal" },
      settings: { label: "Settings", hint: "theme and resets" }
    };
  }
  return {
    home: { label: "Home", hint: "basic stats" },
    trades: { label: "Trades", hint: "review executions" },
    reports: { label: "Reports", hint: "monthly calendar" },
    strategy: { label: "Strategy", hint: "your rules" },
    journal: { label: "Journal", hint: "daily notes" },
    settings: { label: "Settings", hint: "theme and resets" }
  };
}

function Tabs({ className }: { className?: string }) {
  const profile = useAppState((s) => s.activeProfile);
  const investingAccount = useAppState((s) => s.investing.ui.trading212Account);
  const activeTab = useAppState((s) => (profile === "investing" ? s.investing.ui.activeTab : s.day.ui.activeTab));
  const tradesCount = useAppState((s) =>
    profile === "investing"
      ? s.investing.investingActivities.filter((a) => {
          if (a.account !== investingAccount) return false;
          return isMarketTradeRow(a.action, a.isin, a.ticker, a.shares);
        }).length
      : s.day.trades.length
  );
  const TAB_META = React.useMemo(() => getTabMeta(profile), [profile]);
  const visibleTabs = React.useMemo<AppTab[]>(
    () => (profile === "investing" ? ["home", "trades", "journal", "settings"] : ["home", "trades", "reports", "strategy", "journal", "settings"]),
    [profile]
  );

  return (
    <nav className={cn("flex flex-wrap gap-2", className)}>
      {visibleTabs.map((key) => {
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
      <div className="mx-1 h-10 w-px self-center bg-[color:var(--app-border)]" />
      <button
        type="button"
        title="Day trading profile"
        className={cn(
          "app-ghost-outline rounded-[0.65rem] px-3 py-2 text-base font-semibold transition",
          profile === "day" ? "app-nav-active" : "hover:bg-[color:var(--app-nav-hover)]"
        )}
        onClick={() => actions.setActiveProfile("day")}
      >
        Day
      </button>
      <button
        type="button"
        title="Long-term investing profile"
        className={cn(
          "app-ghost-outline rounded-[0.65rem] px-3 py-2 text-base font-semibold transition",
          profile === "investing" ? "app-nav-active" : "hover:bg-[color:var(--app-nav-hover)]"
        )}
        onClick={() => actions.setActiveProfile("investing")}
      >
        LT
      </button>
    </nav>
  );
}

function TradeFilters() {
  const sideFilter = useAppState((s) => s.day.ui.sideFilter);
  const dateFrom = useAppState((s) => s.day.ui.dateFrom);
  const dateTo = useAppState((s) => s.day.ui.dateTo);

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
  const profile = useAppState((s) => s.activeProfile);
  const themeMode = useAppState((s) => (profile === "investing" ? s.investing.ui.themeMode : s.day.ui.themeMode));
  const accent = useAppState((s) => (profile === "investing" ? s.investing.ui.accent : s.day.ui.accent));
  const tab = useAppState((s) => (profile === "investing" ? s.investing.ui.activeTab : s.day.ui.activeTab));
  React.useEffect(() => {
    if (profile !== "investing") return;
    if (tab === "reports" || tab === "strategy") actions.setActiveTab("home");
  }, [profile, tab]);

  const trades = useAppState((s) => s.day.trades);
  const reflections = useAppState((s) => s.day.reflections);
  const imports = useAppState((s) => s.day.imports);
  const investingAccount = useAppState((s) => s.investing.ui.trading212Account);
  const investingActivitiesAll = useAppState((s) => s.investing.investingActivities);
  const investingActivitiesForAccount = React.useMemo(
    () =>
      investingActivitiesAll.filter((a) => {
        if (a.account !== investingAccount) return false;
        return isMarketTradeRow(a.action, a.isin, a.ticker, a.shares);
      }),
    [investingAccount, investingActivitiesAll]
  );
  const investingImports = useAppState((s) => s.investing.investingImports);

  const selectedTradeId = useAppState((s) => s.day.ui.selectedTradeId);
  const selectedInvestingActivityId = useAppState((s) => s.investing.ui.selectedInvestingActivityId);
  const sideFilter = useAppState((s) => s.day.ui.sideFilter);
  const dateFrom = useAppState((s) => s.day.ui.dateFrom);
  const dateTo = useAppState((s) => s.day.ui.dateTo);

  const filteredTrades = React.useMemo(
    () => filterTrades(trades, { sideFilter, dateFrom, dateTo }),
    [dateFrom, dateTo, sideFilter, trades]
  );

  const selected = filteredTrades.find((t) => t.id === selectedTradeId) ?? filteredTrades[0];
  const selectedReflection = selected ? reflections[selected.id] : undefined;

  return (
    <div className="app-shell h-dvh w-dvw" data-app-theme={themeMode} style={getAccentThemeStyle(accent)}>
      <div className="h-full w-full p-3 md:p-4">
        <div className="relative flex h-full min-h-0 flex-col gap-3 md:gap-4">
            <header className="flex flex-wrap items-center justify-between gap-3 md:hidden">
              <div className="flex items-center gap-2 text-base font-semibold">
                <img src="/favicon.svg" alt="Aletheia" className="h-5 w-5" />
                <span>{profile === "investing" ? "Aletheia" : "Aletheia"}</span>
              </div>
              <Tabs />
            </header>

            {profile === "day" && (tab === "trades" || tab === "reports") ? <TradeFilters /> : null}

            <main className="app-panel min-h-0 flex-1 overflow-auto rounded-[1rem] p-4 text-base leading-6 md:p-5">
              {tab === "home" ? (
                profile === "investing" ? (
                  <InvestingHomeView
                    activitiesAll={investingActivitiesAll}
                    activitiesForAccount={investingActivitiesForAccount}
                    onOpenActivity={() => actions.setActiveTab("trades")}
                  />
                ) : (
                  <HomeView trades={filteredTrades} onOpenTrades={() => actions.setActiveTab("trades")} />
                )
              ) : null}
              {tab === "trades" ? (
                profile === "investing" ? (
                  <InvestingActivityPageView
                    activities={investingActivitiesForAccount}
                    selectedId={selectedInvestingActivityId}
                    onSelect={(id) => actions.setSelectedInvestingActivityId(id)}
                  />
                ) : (
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
                )
              ) : null}
              {tab === "reports" ? (profile === "day" ? <ReportsView trades={filteredTrades} /> : <div className="text-sm app-muted">Coming soon.</div>) : null}
              {tab === "strategy" ? <StrategyView /> : null}
              {tab === "journal" ? <JournalView trades={trades} /> : null}
              {tab === "settings" ? (
                <SettingsView
                  themeMode={themeMode}
                  accent={accent}
                  tradingMode={profile}
                  imports={profile === "investing" ? investingImports : imports}
                  onChangeThemeMode={(mode) => actions.setThemeMode(mode)}
                  onChangeAccent={(next) => actions.setAccent(next)}
                  onChangeTradingMode={(mode) => actions.setActiveProfile(mode)}
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
