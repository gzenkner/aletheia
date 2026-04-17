import React from "react";
import type { DayJournalEntry, ImportSummary, PersistedStateV3, StrategyDoc, Trade, TradeReflection } from "./types";
import { parseTradesCsv, type CsvSchemaId } from "./csv";

const STORAGE_KEY = "tradelogger_state_v3";
const LEGACY_STORAGE_KEY_V2 = "tradelogger_state_v2";
const LEGACY_STORAGE_KEY_V1 = "tradelogger_state_v1";

type Listener = () => void;

type Store = {
  get: () => PersistedStateV3;
  set: (updater: (prev: PersistedStateV3) => PersistedStateV3) => void;
  subscribe: (listener: Listener) => () => void;
};

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

function defaultState(): PersistedStateV3 {
  const nowIso = new Date().toISOString();
  return {
    version: 3,
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

function normalizeStateV3(raw: any): PersistedStateV3 {
  if (!raw || raw.version !== 3) return defaultState();
  const base = defaultState();
  const ui = raw.ui ?? {};

  const activeTab =
    ui.activeTab === "home" ||
    ui.activeTab === "trades" ||
    ui.activeTab === "reports" ||
    ui.activeTab === "strategy" ||
    ui.activeTab === "journal" ||
    ui.activeTab === "settings"
      ? ui.activeTab
      : ui.activeTab === "load"
        ? "trades"
      : base.ui.activeTab;
  const sideFilter = ui.sideFilter === "all" || ui.sideFilter === "L" || ui.sideFilter === "S" ? ui.sideFilter : base.ui.sideFilter;

  return {
    ...base,
    ...raw,
    ui: {
      ...base.ui,
      ...ui,
      activeTab,
      sideFilter
    },
    trades: Array.isArray(raw.trades) ? raw.trades : [],
    reflections: raw.reflections && typeof raw.reflections === "object" ? raw.reflections : {},
    strategy: raw.strategy && typeof raw.strategy === "object" ? { ...base.strategy, ...raw.strategy } : base.strategy,
    journals: raw.journals && typeof raw.journals === "object" ? raw.journals : {},
    imports: Array.isArray(raw.imports) ? raw.imports : []
  };
}

function migrateFromV2(raw: any): PersistedStateV3 {
  const base = defaultState();
  const ui = raw?.ui ?? {};
  const trades = Array.isArray(raw?.trades) ? raw.trades : [];
  const legacyTab = ui.activeTab;
  const activeTab: PersistedStateV3["ui"]["activeTab"] =
    legacyTab === "trades" || legacyTab === "settings" ? legacyTab : trades.length ? "trades" : "home";

  return {
    ...base,
    version: 3,
    ui: {
      ...base.ui,
      themeMode: ui.themeMode === "white" || ui.themeMode === "black" ? ui.themeMode : base.ui.themeMode,
      accent: ui.accent ?? base.ui.accent,
      activeTab,
      selectedTradeId: typeof ui.selectedTradeId === "string" ? ui.selectedTradeId : undefined,
      sideFilter: ui.sideFilter === "all" || ui.sideFilter === "L" || ui.sideFilter === "S" ? ui.sideFilter : base.ui.sideFilter,
      dateFrom: typeof ui.dateFrom === "string" ? ui.dateFrom : undefined,
      dateTo: typeof ui.dateTo === "string" ? ui.dateTo : undefined
    },
    trades,
    reflections: raw?.reflections && typeof raw.reflections === "object" ? raw.reflections : {},
    strategy: base.strategy,
    journals: {},
    imports: Array.isArray(raw?.imports) ? raw.imports : []
  };
}

function migrateFromV1(raw: any): PersistedStateV3 {
  const base = defaultState();
  const ui = raw?.ui ?? {};
  const trades = Array.isArray(raw?.trades) ? raw.trades : [];
  const legacyTab = ui.activeTab;
  const activeTab: PersistedStateV3["ui"]["activeTab"] =
    legacyTab === "trades" || legacyTab === "settings" ? legacyTab : trades.length ? "trades" : "home";

  const strategy =
    raw?.strategy && typeof raw.strategy === "object"
      ? { ...base.strategy, ...raw.strategy, updatedAt: typeof raw.strategy.updatedAt === "string" ? raw.strategy.updatedAt : base.strategy.updatedAt }
      : base.strategy;

  const journals = raw?.journals && typeof raw.journals === "object" ? raw.journals : {};

  return {
    ...base,
    version: 3,
    ui: {
      ...base.ui,
      themeMode: ui.themeMode === "white" || ui.themeMode === "black" ? ui.themeMode : base.ui.themeMode,
      accent: ui.accent ?? base.ui.accent,
      activeTab,
      selectedTradeId: typeof ui.selectedTradeId === "string" ? ui.selectedTradeId : undefined,
      sideFilter: ui.sideFilter === "all" || ui.sideFilter === "L" || ui.sideFilter === "S" ? ui.sideFilter : base.ui.sideFilter,
      dateFrom: typeof ui.dateFrom === "string" ? ui.dateFrom : undefined,
      dateTo: typeof ui.dateTo === "string" ? ui.dateTo : undefined
    },
    trades,
    reflections: raw?.reflections && typeof raw.reflections === "object" ? raw.reflections : {},
    strategy,
    journals,
    imports: Array.isArray(raw?.imports) ? raw.imports : []
  };
}

function loadState(): PersistedStateV3 {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeStateV3(JSON.parse(raw));
  } catch {
    // ignore parse errors
  }

  // Try legacy v2 once.
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_V2);
    if (legacy) return normalizeStateV3(migrateFromV2(JSON.parse(legacy)));
  } catch {
    // ignore
  }

  // Try legacy v1 once.
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    if (!legacy) return defaultState();
    return normalizeStateV3(migrateFromV1(JSON.parse(legacy)));
  } catch {
    return defaultState();
  }
}

function persistState(state: PersistedStateV3) {
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

export function useAppState<T>(selector: (state: PersistedStateV3) => T): T {
  return React.useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(defaultState()));
}

export const actions = {
  setThemeMode(mode: PersistedStateV3["ui"]["themeMode"]) {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, themeMode: mode } }));
  },
  setAccent(accent: PersistedStateV3["ui"]["accent"]) {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, accent } }));
  },
  setActiveTab(activeTab: PersistedStateV3["ui"]["activeTab"]) {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, activeTab } }));
  },
  setSelectedTradeId(selectedTradeId: string | undefined) {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, selectedTradeId } }));
  },
  setSideFilter(sideFilter: PersistedStateV3["ui"]["sideFilter"]) {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, sideFilter } }));
  },
  setDateFrom(dateFrom: string | undefined) {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, dateFrom } }));
  },
  setDateTo(dateTo: string | undefined) {
    store.set((prev) => ({ ...prev, ui: { ...prev.ui, dateTo } }));
  },
  importTradesFromCsvText(text: string, source: string, schema: CsvSchemaId = "trades"): { warnings: string[]; summary: ImportSummary } {
    const { trades, warnings } = parseTradesCsv(text, { strict: true, schema });
    let added = 0;
    store.set((prev) => {
      const importId = safeUUID();
      const importedAt = new Date().toISOString();

      const combinedById = new Map<string, Trade>();
      for (const t of prev.trades) combinedById.set(t.id, t);

      for (const t of trades) {
        if (!combinedById.has(t.id)) {
          combinedById.set(t.id, t);
          added++;
        }
      }

      const merged: Trade[] = [...combinedById.values()].sort((a, b) =>
        a.openDatetime < b.openDatetime ? -1 : a.openDatetime > b.openDatetime ? 1 : 0
      );
      const selectedTradeId = prev.ui.selectedTradeId ?? merged[0]?.id;
      return {
        ...prev,
        trades: merged,
        ui: { ...prev.ui, activeTab: "trades", selectedTradeId },
        imports: [
          {
            id: importId,
            importedAt,
            source,
            tradeCount: added,
            attemptedCount: trades.length,
            dedupedCount: Math.max(0, trades.length - added)
          },
          ...prev.imports
        ].slice(0, 25),
        reflections: prev.reflections
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
  upsertReflection(tradeId: string, update: Partial<Omit<TradeReflection, "id" | "updatedAt">>) {
    store.set((prev) => {
      const prevRef = prev.reflections[tradeId];
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
      return { ...prev, reflections: { ...prev.reflections, [tradeId]: next } };
    });
  },
  toggleReflectionMistake(tradeId: string, mistake: string) {
    store.set((prev) => {
      const prevRef = prev.reflections[tradeId];
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
      return { ...prev, reflections: { ...prev.reflections, [tradeId]: next } };
    });
  },
  upsertStrategy(update: Partial<Omit<StrategyDoc, "updatedAt">>) {
    store.set((prev) => ({
      ...prev,
      strategy: {
        ...prev.strategy,
        updatedAt: new Date().toISOString(),
        ...update
      }
    }));
  },
  upsertDayJournal(day: string, update: Partial<Omit<DayJournalEntry, "day" | "updatedAt">>) {
    store.set((prev) => {
      const prevEntry = prev.journals[day];
      const nowIso = new Date().toISOString();
      const next: DayJournalEntry = {
        ...(prevEntry ?? defaultJournal(day, nowIso)),
        day,
        updatedAt: nowIso,
        ...update
      };
      return { ...prev, journals: { ...prev.journals, [day]: next } };
    });
  },
  clearAll() {
    store.set(() => defaultState());
  }
};
