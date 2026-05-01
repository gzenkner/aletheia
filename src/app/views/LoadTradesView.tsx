import React from "react";
import { actions } from "../store";
import { CSV_SCHEMAS, NORMALIZED_TRADE_COLUMNS, type CsvSchemaId } from "../csv";
import type { ImportSummary } from "../types";

type Props = {
  title?: string;
  onSuccess?: (result: ImportSummary) => void;
  defaultSchemaId?: CsvSchemaId;
};

function schemaHeaderExample(schemaId: CsvSchemaId): string {
  const schema = CSV_SCHEMAS.find((s) => s.id === schemaId);
  if (!schema) return "";
  if (!schema.requiredColumns.length) return "";
  return schema.requiredColumns.join(",");
}

function sampleFileForSchema(schemaId: CsvSchemaId): { label: string; path: string } | null {
  if (schemaId === "trades") {
    return { label: "Sample normalized trades CSV", path: "trades.csv" };
  }
  if (schemaId === "tradervue") {
    return { label: "Sample Tradervue trades CSV", path: "trades.csv" };
  }
  if (schemaId === "orders_webull_uk") {
    return { label: "Sample Webull UK orders CSV", path: "webull_uk_orders.csv" };
  }
  return null;
}

export default function LoadTradesView({ title = "Import trades", onSuccess, defaultSchemaId = "trades" }: Props) {
  const [schemaId, setSchemaId] = React.useState<CsvSchemaId>(defaultSchemaId);
  const [paste, setPaste] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<ImportSummary | null>(null);

  const schema = CSV_SCHEMAS.find((s) => s.id === schemaId) ?? CSV_SCHEMAS[0]!;
  const sample = sampleFileForSchema(schemaId);
  const selectedSchemaColumns = schema.requiredColumns.join(", ");
  const targetColumns = schema.targetColumns.length ? schema.targetColumns : [...NORMALIZED_TRADE_COLUMNS];

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
        const result = actions.importTradesFromCsvText(it.text, it.source, schemaId);
        attempted += result.summary.attempted;
        loaded += result.summary.loaded;
        deduped += result.summary.deduped;
        for (const w of result.warnings) allWarnings.push(`${it.source}: ${w}`);
      }
      const summary: ImportSummary = { attempted, loaded, deduped, source: items.length === 1 ? items[0]!.source : `${items.length} files`, schema: schemaId };
      setWarnings(allWarnings);
      setSuccess(summary);
      onSuccess?.(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    if (!sample) return;
    setBusy(true);
    setWarnings([]);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${sample.path}`);
      const text = await res.text();
      await importTexts([{ text, source: `sample: public/${sample.path}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <h2 className="text-2xl font-semibold">{title}</h2>

      <label className="grid gap-1">
        <div className="text-sm font-semibold">Import provider</div>
        <select
          className="app-input h-11 rounded-[0.6rem] px-3 text-base focus:outline-none"
          value={schemaId}
          onChange={(e) => setSchemaId(e.target.value as CsvSchemaId)}
          disabled={busy}
        >
          {CSV_SCHEMAS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-[0.85rem] border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] p-3">
        <div className="text-sm font-semibold">{schema.label}</div>
        <div className="mt-1 text-xs opacity-80">{schema.description}</div>
        <div className="mt-2 text-xs font-semibold">Source columns required: {schema.requiredColumns.join(", ")}</div>
        {schema.requiredColumns.length ? (
          <div className="mt-1 text-xs break-words opacity-80">Header example: {schemaHeaderExample(schemaId)}</div>
        ) : null}
      </div>

      <div className="rounded-[0.75rem] border border-[color:var(--app-border)] p-3">
        <div className="text-sm font-semibold">Target columns in Aletheia</div>
        <div className="mt-1 text-xs opacity-80">
          Every provider is normalized into the same day-trading trade shape before loading.
        </div>
        <div className="mt-2 break-words text-xs opacity-80">{targetColumns.join(", ")}</div>
      </div>

      <div className="rounded-[0.75rem] border border-[color:var(--app-border)] p-3">
        <div className="text-sm font-semibold">Source → target mapping</div>
        <div className="mt-1 text-xs opacity-80">
          These are the columns or computed values the selected provider maps into Aletheia.
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[540px] table-fixed border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="border-b border-[color:var(--app-border)] px-2 py-2 text-left font-semibold">Source field</th>
                <th className="border-b border-[color:var(--app-border)] px-2 py-2 text-left font-semibold">Target field</th>
                <th className="border-b border-[color:var(--app-border)] px-2 py-2 text-left font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {schema.mappings.map((mapping) => (
                <tr key={`${mapping.source}-${mapping.target}`}>
                  <td className="border-b border-[color:var(--app-border)] px-2 py-2 align-top font-mono">{mapping.source}</td>
                  <td className="border-b border-[color:var(--app-border)] px-2 py-2 align-top font-mono">{mapping.target}</td>
                  <td className="border-b border-[color:var(--app-border)] px-2 py-2 align-top opacity-80">{mapping.notes ?? "Direct mapping"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-[0.75rem] border border-[color:var(--app-border)] p-3">
        <summary className="cursor-pointer text-sm font-semibold">Provider overview</summary>
        <div className="mt-2 grid gap-2 text-xs">
          {CSV_SCHEMAS.map((s) => (
            <div key={s.id} className="rounded-[0.6rem] border border-[color:var(--app-border)] p-2">
              <div className="font-semibold">{s.label}</div>
              <div className="mt-1 opacity-80">{s.description}</div>
              <div className="mt-1 break-words opacity-70">Source columns: {s.requiredColumns.join(", ")}</div>
            </div>
          ))}
          <div className="opacity-70">Current provider columns: {selectedSchemaColumns}</div>
        </div>
      </details>

      <label className="grid gap-2">
        <div className="text-sm opacity-70">Upload CSV</div>
        <div className="flex flex-wrap items-center gap-2">
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
          {sample ? (
            <button
              type="button"
              className="app-ghost-outline rounded-[0.65rem] px-3 py-2 text-sm font-semibold transition hover:bg-[color:var(--app-nav-hover)]"
              onClick={loadSample}
              disabled={busy}
              title={`Load ${sample.label}`}
            >
              Load sample
            </button>
          ) : null}
        </div>
      </label>

      <label className="grid gap-2">
        <div className="text-sm opacity-70">Or paste CSV</div>
        <textarea
          className="app-input min-h-36 rounded-[0.6rem] px-3 py-2 text-base focus:outline-none"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Paste the full CSV including the header row, for example: Open Datetime, Close Datetime, Symbol, Side, Volume…"
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
    </div>
  );
}
