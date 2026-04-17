import React from "react";
import type {
  DayJournalEntry,
  ImportSummary,
  PersistedState,
  PersistedStateV3,
  StrategyDoc,
  Trade,
  TradeReflection,
  InvestingActivity,
  ProfileId,
  Trading212Account
} from "./types";
import { parseTradesCsv, type CsvSchemaId } from "./csv";
import { parseTrading212ActivityCsv } from "./investingCsv";

const STORAGE_KEY = "tradelogger_state_v4";
const LEGACY_STORAGE_KEY_V3 = "tradelogger_state_v3";
const LEGACY_STORAGE_KEY_V2 = "tradelogger_state_v2";
const LEGACY_STORAGE_KEY_V1 = "tradelogger_state_v1";

type Listener = () => void;

type Store = {
  get: () => PersistedState;
  set: (updater: (prev: PersistedState) => PersistedState) => void;
  subscribe: (listener: Listener) => () => void;
};

function isMarketTradeLikeActivity(a: any): boolean {
  const action = typeof a?.action === "string" ? a.action.trim().toLowerCase() : "";
  const isMarketTrade = action === "market buy" || action === "market sell";
  const isin = typeof a?.isin === "string" ? a.isin.trim() : "";
  const ticker = typeof a?.ticker === "string" ? a.ticker.trim() : "";
  const shares = typeof a?.shares === "number" ? a.shares : Number(a?.shares ?? 0);
  return isMarketTrade && Boolean(isin || ticker) && Number.isFinite(shares) && shares > 0;
}

function safeUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function defaultStrategy(nowIso: string): StrategyDoc {
  return {
    updatedAt: nowIso,
    name: "My strategy",
    premise: "",
    universe: "",
    setup: "",
    entry: "",
    risk: "",
    management: "",
    exits: "",
    donts: ""
  };
}

function defaultJournal(day: string, nowIso: string): DayJournalEntry {
  return { day, updatedAt: nowIso, plan: "", execution: "", review: "", tomorrow: "" };
}

function defaultDayProfile(nowIso: string): PersistedState["day"] {
  return {
    ui: {
      themeMode: "white",
      accent: "lavender",
      activeTab: "home",
      selectedTradeId: undefined,
      sideFilter: "all",
      dateFrom: undefined,
      dateTo: undefined
    },
    trades: [],
    reflections: {},
    strategy: defaultStrategy(nowIso),
    journals: {},
    imports: []
  };
}

function defaultInvestingProfile(nowIso: string): PersistedState["investing"] {
  return {
    ui: {
      themeMode: "white",
      accent: "lavender",
      activeTab: "home",
      selectedInvestingActivityId: undefined,
      trading212Account: "isa",
      trading212CurrentValueGbpByAccount: {},
      trading212OverviewScope: "account",
      trading212IncludeCashByAccount: {},
      trading212ShowAmountInvestedByAccount: {},
      trading212ShowNetDepositsByAccount: {}
    },
    investingActivities: [],
    strategy: defaultStrategy(nowIso),
    journals: {},
    investingImports: []
  };
}

function defaultState(): PersistedState {
  const nowIso = new Date().toISOString();
  return {
    version: 4,
    activeProfile: "day",
    day: defaultDayProfile(nowIso),
    investing: defaultInvestingProfile(nowIso)
  };
}

function normalizeStateV4(raw: any): PersistedState {
  if (!raw || raw.version !== 4) return defaultState();
  const base = defaultState();

  const activeProfile: ProfileId = raw.activeProfile === "day" || raw.activeProfile === "investing" ? raw.activeProfile : base.activeProfile;

  const normalizeTab = (tab: any): PersistedState["day"]["ui"]["activeTab"] => {
    return tab === "home" || tab === "trades" || tab === "reports" || tab === "strategy" || tab === "journal" || tab === "settings" ? tab : "home";
  };

  const dayRaw = raw.day ?? {};
  const investingRaw = raw.investing ?? {};
  const dayUi = dayRaw.ui ?? {};
  const investingUi = investingRaw.ui ?? {};

  return {
    ...base,
    ...raw,
    activeProfile,
    day: {
      ...base.day,
      ...dayRaw,
      ui: {
        ...base.day.ui,
        ...dayUi,
        activeTab: normalizeTab(dayUi.activeTab),
        sideFilter: dayUi.sideFilter === "all" || dayUi.sideFilter === "L" || dayUi.sideFilter === "S" ? dayUi.sideFilter : base.day.ui.sideFilter
      },
      trades: Array.isArray(dayRaw.trades) ? dayRaw.trades : [],
      reflections: dayRaw.reflections && typeof dayRaw.reflections === "object" ? dayRaw.reflections : {},
      strategy: dayRaw.strategy && typeof dayRaw.strategy === "object" ? { ...base.day.strategy, ...dayRaw.strategy } : base.day.strategy,
      journals: dayRaw.journals && typeof dayRaw.journals === "object" ? dayRaw.journals : {},
      imports: Array.isArray(dayRaw.imports) ? dayRaw.imports : []
    },
    investing: {
      ...base.investing,
      ...investingRaw,
      ui: {
        ...base.investing.ui,
        ...investingUi,
        activeTab: normalizeTab(investingUi.activeTab),
        trading212Account:
          investingUi.trading212Account === "general" || investingUi.trading212Account === "isa" ? investingUi.trading212Account : base.investing.ui.trading212Account,
        trading212CurrentValueGbpByAccount:
          investingUi.trading212CurrentValueGbpByAccount && typeof investingUi.trading212CurrentValueGbpByAccount === "object"
            ? investingUi.trading212CurrentValueGbpByAccount
            : base.investing.ui.trading212CurrentValueGbpByAccount,
        trading212OverviewScope:
          investingUi.trading212OverviewScope === "all" || investingUi.trading212OverviewScope === "account"
            ? investingUi.trading212OverviewScope
            : base.investing.ui.trading212OverviewScope,
        trading212IncludeCashByAccount:
          investingUi.trading212IncludeCashByAccount && typeof investingUi.trading212IncludeCashByAccount === "object"
            ? investingUi.trading212IncludeCashByAccount
            : base.investing.ui.trading212IncludeCashByAccount,
        trading212ShowAmountInvestedByAccount:
          investingUi.trading212ShowAmountInvestedByAccount && typeof investingUi.trading212ShowAmountInvestedByAccount === "object"
            ? investingUi.trading212ShowAmountInvestedByAccount
            : base.investing.ui.trading212ShowAmountInvestedByAccount,
        trading212ShowNetDepositsByAccount:
          investingUi.trading212ShowNetDepositsByAccount && typeof investingUi.trading212ShowNetDepositsByAccount === "object"
            ? investingUi.trading212ShowNetDepositsByAccount
            : base.investing.ui.trading212ShowNetDepositsByAccount
      },
      investingActivities: Array.isArray(investingRaw.investingActivities)
        ? (investingRaw.investingActivities as any[])
            .map((a) => ({
              ...a,
              account: a?.account === "general" || a?.account === "isa" ? a.account : base.investing.ui.trading212Account,
              id: typeof a?.id === "string" && (a.id.startsWith("isa:") || a.id.startsWith("general:")) ? a.id : `${base.investing.ui.trading212Account}:${a?.id ?? ""}`
            }))
            .filter((a) => isMarketTradeLikeActivity(a))
        : [],
      strategy:
        investingRaw.strategy && typeof investingRaw.strategy === "object"
          ? { ...base.investing.strategy, ...investingRaw.strategy }
          : base.investing.strategy,
      journals: investingRaw.journals && typeof investingRaw.journals === "object" ? investingRaw.journals : {},
      investingImports: Array.isArray(investingRaw.investingImports) ? investingRaw.investingImports : []
    }
  };
}

function migrateFromV3(raw: any): PersistedState {
  const v3: PersistedStateV3 | null = raw && raw.version === 3 ? (raw as PersistedStateV3) : null;
  if (!v3) return defaultState();

  const next = defaultState();
  const themeMode = v3.ui?.themeMode === "black" ? "black" : "white";
  const accent = v3.ui?.accent ?? next.day.ui.accent;

  next.day.ui.themeMode = themeMode;
  next.day.ui.accent = accent;
  next.investing.ui.themeMode = themeMode;
  next.investing.ui.accent = accent;

  next.day.trades = Array.isArray(v3.trades) ? v3.trades : [];
  next.day.reflections = v3.reflections && typeof v3.reflections === "object" ? v3.reflections : {};
  next.day.imports = Array.isArray(v3.imports) ? v3.imports : [];
  next.day.ui.selectedTradeId = typeof v3.ui?.selectedTradeId === "string" ? v3.ui.selectedTradeId : undefined;
  next.day.ui.sideFilter = v3.ui?.sideFilter === "L" || v3.ui?.sideFilter === "S" || v3.ui?.sideFilter === "all" ? v3.ui.sideFilter : "all";
  next.day.ui.dateFrom = typeof v3.ui?.dateFrom === "string" ? v3.ui.dateFrom : undefined;
  next.day.ui.dateTo = typeof v3.ui?.dateTo === "string" ? v3.ui.dateTo : undefined;
  next.day.strategy = v3.strategy && typeof v3.strategy === "object" ? { ...next.day.strategy, ...v3.strategy } : next.day.strategy;
  next.day.journals = v3.journals && typeof v3.journals === "object" ? v3.journals : {};

  // investing portal starts empty on v3 migration
  next.day.ui.activeTab = "home";
  next.investing.ui.activeTab = "home";
  next.activeProfile = "day";
  return next;
}

function loadState(): PersistedState {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeStateV4(JSON.parse(raw));
  } catch {
    // ignore parse errors
  }

  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_V3);
    if (legacy) return normalizeStateV4(migrateFromV3(JSON.parse(legacy)));
  } catch {
    // ignore
  }

  // Try legacy v2 once.
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_V2);
    if (legacy) return defaultState();
  } catch {
    // ignore
  }

  // Try legacy v1 once.
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    if (!legacy) return defaultState();
    return defaultState();
  } catch {
    return defaultState();
  }
}

function persistState(state: PersistedState) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota/write errors
  }
}

const store: Store = (() => {
  let state = loadState();
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (updater) => {
      state = updater(state);
      persistState(state);
      for (const l of listeners) l();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
})();

export function useAppState<T>(selector: (state: PersistedState) => T): T {
  return React.useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(defaultState()));
}

export const actions = {
  setActiveProfile(activeProfile: ProfileId) {
    store.set((prev) => ({ ...prev, activeProfile }));
  },
  setThemeMode(mode: PersistedState["day"]["ui"]["themeMode"]) {
    store.set((prev) => {
      const key = prev.activeProfile;
      if (key === "day") return { ...prev, day: { ...prev.day, ui: { ...prev.day.ui, themeMode: mode } } };
      return { ...prev, investing: { ...prev.investing, ui: { ...prev.investing.ui, themeMode: mode } } };
    });
  },
  setAccent(accent: PersistedState["day"]["ui"]["accent"]) {
    store.set((prev) => {
      const key = prev.activeProfile;
      if (key === "day") return { ...prev, day: { ...prev.day, ui: { ...prev.day.ui, accent } } };
      return { ...prev, investing: { ...prev.investing, ui: { ...prev.investing.ui, accent } } };
    });
  },
  setActiveTab(activeTab: PersistedState["day"]["ui"]["activeTab"]) {
    store.set((prev) => {
      const key = prev.activeProfile;
      if (key === "day") return { ...prev, day: { ...prev.day, ui: { ...prev.day.ui, activeTab } } };
      return { ...prev, investing: { ...prev.investing, ui: { ...prev.investing.ui, activeTab } } };
    });
  },
  setSelectedTradeId(selectedTradeId: string | undefined) {
    store.set((prev) => ({ ...prev, day: { ...prev.day, ui: { ...prev.day.ui, selectedTradeId } } }));
  },
  setSelectedInvestingActivityId(selectedInvestingActivityId: string | undefined) {
    store.set((prev) => ({ ...prev, investing: { ...prev.investing, ui: { ...prev.investing.ui, selectedInvestingActivityId } } }));
  },
  setTrading212Account(account: Trading212Account) {
    store.set((prev) => ({
      ...prev,
      investing: {
        ...prev.investing,
        ui: { ...prev.investing.ui, trading212Account: account, selectedInvestingActivityId: undefined }
      }
    }));
  },
  setTrading212OverviewScope(scope: "account" | "all") {
    store.set((prev) => ({
      ...prev,
      investing: {
        ...prev.investing,
        ui: { ...prev.investing.ui, trading212OverviewScope: scope }
      }
    }));
  },
  setTrading212CurrentValueGbp(account: Trading212Account, value: number | undefined) {
    store.set((prev) => ({
      ...prev,
      investing: {
        ...prev.investing,
        ui: {
          ...prev.investing.ui,
          trading212CurrentValueGbpByAccount: {
            ...prev.investing.ui.trading212CurrentValueGbpByAccount,
            [account]: typeof value === "number" && Number.isFinite(value) ? value : undefined
          }
        }
      }
    }));
  },
  setTrading212IncludeCash(account: Trading212Account, includeCash: boolean) {
    store.set((prev) => ({
      ...prev,
      investing: {
        ...prev.investing,
        ui: {
          ...prev.investing.ui,
          trading212IncludeCashByAccount: {
            ...prev.investing.ui.trading212IncludeCashByAccount,
            [account]: includeCash
          }
        }
      }
    }));
  },
  setTrading212ShowAmountInvested(account: Trading212Account, enabled: boolean) {
    store.set((prev) => ({
      ...prev,
      investing: {
        ...prev.investing,
        ui: {
          ...prev.investing.ui,
          trading212ShowAmountInvestedByAccount: {
            ...prev.investing.ui.trading212ShowAmountInvestedByAccount,
            [account]: enabled
          }
        }
      }
    }));
  },
  setTrading212ShowNetDeposits(account: Trading212Account, enabled: boolean) {
    store.set((prev) => ({
      ...prev,
      investing: {
        ...prev.investing,
        ui: {
          ...prev.investing.ui,
          trading212ShowNetDepositsByAccount: {
            ...prev.investing.ui.trading212ShowNetDepositsByAccount,
            [account]: enabled
          }
        }
      }
    }));
  },
  setSideFilter(sideFilter: PersistedStateV3["ui"]["sideFilter"]) {
    store.set((prev) => ({ ...prev, day: { ...prev.day, ui: { ...prev.day.ui, sideFilter } } }));
  },
  setDateFrom(dateFrom: string | undefined) {
    store.set((prev) => ({ ...prev, day: { ...prev.day, ui: { ...prev.day.ui, dateFrom } } }));
  },
  setDateTo(dateTo: string | undefined) {
    store.set((prev) => ({ ...prev, day: { ...prev.day, ui: { ...prev.day.ui, dateTo } } }));
  },
  importTradesFromCsvText(text: string, source: string, schema: CsvSchemaId = "trades"): { warnings: string[]; summary: ImportSummary } {
    const { trades, warnings } = parseTradesCsv(text, { strict: true, schema });
    let added = 0;
    store.set((prev) => {
      const importId = safeUUID();
      const importedAt = new Date().toISOString();

      const combinedById = new Map<string, Trade>();
      for (const t of prev.day.trades) combinedById.set(t.id, t);

      for (const t of trades) {
        if (!combinedById.has(t.id)) {
          combinedById.set(t.id, t);
          added++;
        }
      }

      const merged: Trade[] = [...combinedById.values()].sort((a, b) =>
        a.openDatetime < b.openDatetime ? -1 : a.openDatetime > b.openDatetime ? 1 : 0
      );
      const selectedTradeId = prev.day.ui.selectedTradeId ?? merged[0]?.id;
      return {
        ...prev,
        day: {
          ...prev.day,
          trades: merged,
          ui: { ...prev.day.ui, activeTab: "trades", selectedTradeId },
          imports: [
            {
              id: importId,
              importedAt,
              source,
              tradeCount: added,
              attemptedCount: trades.length,
              dedupedCount: Math.max(0, trades.length - added)
            },
            ...prev.day.imports
          ].slice(0, 25)
        }
      };
    });
    return {
      warnings,
      summary: {
        attempted: trades.length,
        loaded: added,
        deduped: Math.max(0, trades.length - added),
        source,
        schema
      }
    };
  },
  importInvestingActivityFromTrading212CsvText(
    text: string,
    source: string,
    account: Trading212Account
  ): { warnings: string[]; summary: ImportSummary } {
    const { activities, warnings } = parseTrading212ActivityCsv(text, { strict: true, account });
    let added = 0;
    store.set((prev) => {
      const importId = safeUUID();
      const importedAt = new Date().toISOString();

      const combinedById = new Map<string, InvestingActivity>();
      for (const a of prev.investing.investingActivities) combinedById.set(a.id, a);
      for (const a of activities) {
        if (!combinedById.has(a.id)) {
          combinedById.set(a.id, a);
          added++;
        }
      }

      const merged = [...combinedById.values()].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
      const selectedInvestingActivityId = prev.investing.ui.selectedInvestingActivityId ?? merged.find((x) => x.account === account)?.id;

      return {
        ...prev,
        investing: {
          ...prev.investing,
          investingActivities: merged,
          ui: { ...prev.investing.ui, activeTab: "trades", selectedInvestingActivityId },
          investingImports: [
            {
              id: importId,
              importedAt,
              source,
              rowCount: added,
              attemptedCount: activities.length,
              dedupedCount: Math.max(0, activities.length - added)
            },
            ...prev.investing.investingImports
          ].slice(0, 25)
        }
      };
    });
    return {
      warnings,
      summary: {
        attempted: activities.length,
        loaded: added,
        deduped: Math.max(0, activities.length - added),
        source,
        schema: "trading212_activity"
      }
    };
  },
  upsertReflection(tradeId: string, update: Partial<Omit<TradeReflection, "id" | "updatedAt">>) {
    store.set((prev) => {
      const prevRef = prev.day.reflections[tradeId];
      const next: TradeReflection = {
        id: tradeId,
        updatedAt: new Date().toISOString(),
        setup: prevRef?.setup ?? "",
        grade: prevRef?.grade ?? "",
        followedPlan: prevRef?.followedPlan ?? "",
        emotion: prevRef?.emotion ?? "",
        mistakes: prevRef?.mistakes ?? [],
        lesson: prevRef?.lesson ?? "",
        nextTime: prevRef?.nextTime ?? "",
        ...update
      };
      return { ...prev, day: { ...prev.day, reflections: { ...prev.day.reflections, [tradeId]: next } } };
    });
  },
  toggleReflectionMistake(tradeId: string, mistake: string) {
    store.set((prev) => {
      const prevRef = prev.day.reflections[tradeId];
      const current = prevRef?.mistakes ?? [];
      const nextMistakes = current.includes(mistake) ? current.filter((m) => m !== mistake) : [...current, mistake];
      const next: TradeReflection = {
        id: tradeId,
        updatedAt: new Date().toISOString(),
        setup: prevRef?.setup ?? "",
        grade: prevRef?.grade ?? "",
        followedPlan: prevRef?.followedPlan ?? "",
        emotion: prevRef?.emotion ?? "",
        mistakes: nextMistakes,
        lesson: prevRef?.lesson ?? "",
        nextTime: prevRef?.nextTime ?? ""
      };
      return { ...prev, day: { ...prev.day, reflections: { ...prev.day.reflections, [tradeId]: next } } };
    });
  },
  upsertStrategy(update: Partial<Omit<StrategyDoc, "updatedAt">>) {
    store.set((prev) => {
      const nowIso = new Date().toISOString();
      if (prev.activeProfile === "day") {
        return {
          ...prev,
          day: {
            ...prev.day,
            strategy: { ...prev.day.strategy, updatedAt: nowIso, ...update }
          }
        };
      }
      return {
        ...prev,
        investing: {
          ...prev.investing,
          strategy: { ...prev.investing.strategy, updatedAt: nowIso, ...update }
        }
      };
    });
  },
  upsertDayJournal(day: string, update: Partial<Omit<DayJournalEntry, "day" | "updatedAt">>) {
    store.set((prev) => {
      const key = prev.activeProfile;
      const prevEntry = key === "day" ? prev.day.journals[day] : prev.investing.journals[day];
      const nowIso = new Date().toISOString();
      const next: DayJournalEntry = {
        ...(prevEntry ?? defaultJournal(day, nowIso)),
        day,
        updatedAt: nowIso,
        ...update
      };
      if (key === "day") return { ...prev, day: { ...prev.day, journals: { ...prev.day.journals, [day]: next } } };
      return { ...prev, investing: { ...prev.investing, journals: { ...prev.investing.journals, [day]: next } } };
    });
  },
  clearAll() {
    store.set(() => defaultState());
  },
  clearInvestingForAccount(account: Trading212Account) {
    store.set((prev) => {
      const remaining = prev.investing.investingActivities.filter((a) => a.account !== account);
      // Keep imports list for now; it tracks raw import actions regardless of account.
      return {
        ...prev,
        investing: {
          ...prev.investing,
          investingActivities: remaining,
          ui: { ...prev.investing.ui, selectedInvestingActivityId: undefined }
        }
      };
    });
  }
};
