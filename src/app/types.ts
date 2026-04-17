export type ThemeMode = "white" | "black";

export type AccentThemeId = "apricot" | "sage" | "sky" | "lavender" | "butter" | "rose";

export type AppTab = "home" | "trades" | "reports" | "strategy" | "journal" | "settings";

export type TradeSide = "L" | "S" | string;

export type Trade = {
  id: string;
  openDatetime: string;
  closeDatetime: string;
  symbol: string;
  side: TradeSide;
  volume: number;
  execCount: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  grossPnlPct: number;
  shared: boolean;
  notes: string;
  tags: string;
  grossPnlT: number;
  positionMfe: number;
  positionMae: number;
  priceMfe: number;
  priceMae: number;
  positionMfeDatetime: string;
  positionMaeDatetime: string;
  priceMfeDatetime: string;
  priceMaeDatetime: string;
};

export type TradeReflection = {
  id: string;
  updatedAt: string;
  setup: string;
  grade: "A" | "B" | "C" | "F" | "";
  followedPlan: "yes" | "no" | "partial" | "";
  emotion: string;
  mistakes: string[];
  lesson: string;
  nextTime: string;
};

export type StrategyDoc = {
  updatedAt: string;
  name: string;
  premise: string;
  universe: string;
  setup: string;
  entry: string;
  risk: string;
  management: string;
  exits: string;
  donts: string;
};

export type DayJournalEntry = {
  day: string; // ISO date: yyyy-mm-dd
  updatedAt: string;
  plan: string;
  execution: string;
  review: string;
  tomorrow: string;
};

export type ImportSummary = {
  attempted: number;
  loaded: number;
  deduped: number;
  source: string;
  schema: string;
};

export type PersistedStateV3 = {
  version: 3;
  ui: {
    themeMode: ThemeMode;
    accent: AccentThemeId;
    activeTab: AppTab;
    selectedTradeId?: string;
    sideFilter: "all" | "L" | "S";
    dateFrom?: string;
    dateTo?: string;
  };
  trades: Trade[];
  reflections: Record<string, TradeReflection | undefined>;
  strategy: StrategyDoc;
  journals: Record<string, DayJournalEntry | undefined>;
  imports: Array<{ id: string; importedAt: string; source: string; tradeCount: number; attemptedCount?: number; dedupedCount?: number }>;
};
