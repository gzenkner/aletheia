import React from "react";
import type { ImportSummary } from "../types";
import { actions, useAppState } from "../store";

type Props = {
  title?: string;
  onSuccess?: (result: ImportSummary) => void;
};

const REQUIRED_COLUMNS_MIN = ["Action", "Time", "ID", "Total", "Currency (Total)"];

const COMMON_EXTRA_COLUMNS = [
  "ISIN",
  "Ticker",
  "Name",
  "Notes",
  "No. of shares",
  "Price / share",
  "Currency (Price / share)",
  "Exchange rate",
  "Withholding tax",
  "Currency (Withholding tax)",
  "Currency conversion fee",
  "Currency (Currency conversion fee)",
  "French transaction tax",
  "Currency (French transaction tax)"
];

const ISA_EXTRA_COLUMNS = ["Result", "Currency (Result)", "Stamp duty reserve tax", "Currency (Stamp duty reserve tax)"];

const REGULAR_EXTRA_COLUMNS = ["Merchant name", "Merchant category"];

export default function InvestingLoadView({ title = "Import Trading 212 activity", onSuccess }: Props) {
  const account = useAppState((s) => s.investing.ui.trading212Account);
  const [paste, setPaste] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<ImportSummary | null>(null);

  const expectedColumns = React.useMemo(() => {
    const extras = account === "isa" ? ISA_EXTRA_COLUMNS : REGULAR_EXTRA_COLUMNS;
    return [...REQUIRED_COLUMNS_MIN, ...COMMON_EXTRA_COLUMNS, ...extras];
  }, [account]);

  async function importTexts(items: Array<{ text: string; source: string }>) {
    setBusy(true);
    setWarnings([]);
    setError(null);
    setSuccess(null);
    try {
      let attempted = 0;
      let loaded = 0;
      let deduped = 0;
      const allWarnings: string[] = [];
      for (const it of items) {
        const result = actions.importInvestingActivityFromTrading212CsvText(it.text, it.source, account);
        attempted += result.summary.attempted;
        loaded += result.summary.loaded;
        deduped += result.summary.deduped;
        for (const w of result.warnings) allWarnings.push(`${it.source}: ${w}`);
      }
      const summary: ImportSummary = {
        attempted,
        loaded,
        deduped,
        source: items.length === 1 ? items[0]!.source : `${items.length} files`,
        schema: "trading212_activity"
      };
      setWarnings(allWarnings);
      setSuccess(summary);
      onSuccess?.(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <h2 className="text-2xl font-semibold">{title}</h2>

      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-[0.85rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-3">
          <div className="text-sm font-semibold">Portfolios</div>
          <div className="mt-1 text-xs app-muted">Choose where this import goes.</div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              className={
                account === "isa"
                  ? "rounded-[0.75rem] border px-3 py-2 text-left text-sm font-semibold"
                  : "rounded-[0.75rem] border px-3 py-2 text-left text-sm opacity-80"
              }
              onClick={() => actions.setTrading212Account("isa")}
              disabled={busy}
            >
              Trading 212 ISA
              <div className="mt-1 text-xs opacity-70">Tax-advantaged account.</div>
            </button>
            <button
              type="button"
              className={
                account === "general"
                  ? "rounded-[0.75rem] border px-3 py-2 text-left text-sm font-semibold"
                  : "rounded-[0.75rem] border px-3 py-2 text-left text-sm opacity-80"
              }
              onClick={() => actions.setTrading212Account("general")}
              disabled={busy}
            >
              Trading 212 (regular)
              <div className="mt-1 text-xs opacity-70">Standard investment account.</div>
            </button>
          </div>
        </aside>

        <section className="grid gap-3">
          <div className="rounded-[0.85rem] border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] p-3">
            <div className="text-sm font-semibold">Trading 212 CSV export</div>
            <div className="mt-1 text-xs opacity-80">Export your account activity and import it here.</div>
            <div className="mt-2 text-xs app-muted">
              Target: <span className="font-semibold">{account === "isa" ? "ISA" : "Regular"}</span>
            </div>
            <div className="mt-2 text-xs font-semibold">Required header columns</div>
            <div className="mt-1 text-xs break-words opacity-80">{REQUIRED_COLUMNS_MIN.join(", ")}</div>
            <div className="mt-2 text-xs font-semibold">Other supported columns</div>
            <div className="mt-1 text-xs break-words opacity-80">{expectedColumns.filter((c) => !REQUIRED_COLUMNS_MIN.includes(c)).join(", ")}</div>
          </div>

      <label className="grid gap-2">
        <div className="text-sm opacity-70">Upload CSV</div>
        <input
          type="file"
          multiple
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            if (!files.length) return;
            Promise.all(files.map(async (f) => ({ source: f.name, text: await f.text() }))).then((items) => importTexts(items));
          }}
        />
      </label>

      <label className="grid gap-2">
        <div className="text-sm opacity-70">Or paste CSV</div>
        <textarea
          className="app-input min-h-36 rounded-[0.6rem] px-3 py-2 text-base focus:outline-none"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Paste the full CSV including the header row…"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="app-ghost-outline rounded-[0.65rem] px-3 py-2 text-sm font-semibold transition hover:bg-[color:var(--app-nav-hover)]"
            onClick={() => setPaste("")}
            disabled={busy}
          >
            Clear
          </button>
          <button
            type="button"
            className="app-ghost-outline rounded-[0.65rem] px-3 py-2 text-sm font-semibold transition hover:bg-[color:var(--app-nav-hover)]"
            onClick={() => importTexts([{ text: paste, source: "pasted" }])}
            disabled={busy || !paste.trim()}
          >
            Import
          </button>
        </div>
      </label>

      {error ? (
        <div className="rounded-[0.75rem] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <div className="font-semibold">Import failed</div>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-[0.75rem] border p-3 text-sm">
          <div className="font-semibold">Warnings</div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm opacity-80">
            {warnings.map((w, idx) => (
              <li key={`${idx}:${w}`}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {success ? (
        <div className="rounded-[0.75rem] border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="font-semibold">CSV imported successfully</div>
          <div className="mt-1 text-xs">
            Attempted: {success.attempted} • Loaded: {success.loaded} • Deduped: {success.deduped}
          </div>
        </div>
      ) : null}
        </section>
      </div>
    </div>
  );
}
