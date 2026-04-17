import React from "react";
import { actions } from "../store";
import { CSV_SCHEMAS, type CsvSchemaId } from "../csv";
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
    return { label: "Sample TradeLogger trades CSV", path: "trades.csv" };
  }
  if (schemaId === "orders_webull_uk") {
    return { label: "Sample Webull UK orders CSV", path: "webull_uk_orders.csv" };
  }
  return null;
}

export default function LoadTradesView({ title = "Import trades", onSuccess, defaultSchemaId = "orders_webull_uk" }: Props) {
  const [schemaId, setSchemaId] = React.useState<CsvSchemaId>(defaultSchemaId);
  const [paste, setPaste] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<ImportSummary | null>(null);

  const schema = CSV_SCHEMAS.find((s) => s.id === schemaId) ?? CSV_SCHEMAS[0]!;
  const sample = sampleFileForSchema(schemaId);
  const selectedSchemaColumns = schema.requiredColumns.join(", ");

  async function importText(text: string, source: string) {
    setBusy(true);
    setWarnings([]);
    setError(null);
    setSuccess(null);
    try {
      const result = actions.importTradesFromCsvText(text, source, schemaId);
      setWarnings(result.warnings);
      setSuccess(result.summary);
      onSuccess?.(result.summary);
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
      await importText(text, `sample: public/${sample.path}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <h2 className="text-2xl font-semibold">{title}</h2>

      <label className="grid gap-1">
        <div className="text-sm font-semibold">Schema</div>
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
        <div className="mt-2 text-xs font-semibold">Required: {schema.requiredColumns.join(", ")}</div>
        {schema.requiredColumns.length ? (
          <div className="mt-1 text-xs break-words opacity-80">Header example: {schemaHeaderExample(schemaId)}</div>
        ) : null}
      </div>
      <details className="rounded-[0.75rem] border border-[color:var(--app-border)] p-3">
        <summary className="cursor-pointer text-sm font-semibold">Schema overview</summary>
        <div className="mt-2 grid gap-2 text-xs">
          {CSV_SCHEMAS.map((s) => (
            <div key={s.id} className="rounded-[0.6rem] border border-[color:var(--app-border)] p-2">
              <div className="font-semibold">{s.label}</div>
              <div className="mt-1 opacity-80">{s.description}</div>
              <div className="mt-1 break-words opacity-70">Columns: {s.requiredColumns.join(", ")}</div>
            </div>
          ))}
          <div className="opacity-70">Current schema columns: {selectedSchemaColumns}</div>
        </div>
      </details>

      <label className="grid gap-2">
        <div className="text-sm opacity-70">Upload CSV</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              file.text().then((text) => importText(text, file.name));
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
            onClick={() => importText(paste, "pasted")}
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
