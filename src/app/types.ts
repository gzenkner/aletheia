export type ThemeMode = "white" | "black";

export type AccentThemeId = "apricot" | "sage" | "sky" | "lavender" | "butter" | "rose";

export type AppTab = "home" | "trades" | "reports" | "strategy" | "journal" | "settings";

export type TradingMode = "day" | "investing";

export type ProfileId = TradingMode;

export type Trading212Account = "isa" | "general";

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

export type InvestingActivity = {
  id: string; // unique per account (prefixed)
  account: Trading212Account;
  action: string;
  time: string; // "YYYY-MM-DD HH:MM:SS"
  isin: string;
  ticker: string;
  name: string;
  notes: string;
  shares: number;
  pricePerShare: number;
  priceCurrency: string;
  exchangeRate: number;
  result: number;
  resultCurrency: string;
  total: number;
  totalCurrency: string;
  withholdingTax: number;
  withholdingTaxCurrency: string;
  stampDutyReserveTax: number;
  stampDutyReserveTaxCurrency: string;
  currencyConversionFee: number;
  currencyConversionFeeCurrency: string;
  frenchTransactionTax: number;
  frenchTransactionTaxCurrency: string;
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

export type DayProfile = {
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

export type InvestingProfile = {
  ui: {
    themeMode: ThemeMode;
    accent: AccentThemeId;
    activeTab: AppTab;
    selectedInvestingActivityId?: string;
    trading212Account: Trading212Account;
    trading212CurrentValueGbpByAccount: Partial<Record<Trading212Account, number>>;
    trading212OverviewScope: "account" | "all";
    trading212IncludeCashByAccount: Partial<Record<Trading212Account, boolean>>;
    trading212ShowAmountInvestedByAccount: Partial<Record<Trading212Account, boolean>>;
    trading212ShowNetDepositsByAccount: Partial<Record<Trading212Account, boolean>>;
  };
  investingActivities: InvestingActivity[];
  strategy: StrategyDoc;
  journals: Record<string, DayJournalEntry | undefined>;
  investingImports: Array<{ id: string; importedAt: string; source: string; rowCount: number; attemptedCount?: number; dedupedCount?: number }>;
};

export type PersistedStateV4 = {
  version: 4;
  activeProfile: ProfileId;
  day: DayProfile;
  investing: InvestingProfile;
};

export type PersistedState = PersistedStateV4;
