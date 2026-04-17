import React from "react";
import type { AccentThemeId, PersistedState, ProfileId } from "../types";
import { actions, useAppState } from "../store";

function ThemeToggle({
  value,
  onChange
}: {
  value: PersistedState["day"]["ui"]["themeMode"];
  onChange: (next: PersistedState["day"]["ui"]["themeMode"]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={value === "white" ? "rounded border px-3 py-2 text-sm font-semibold" : "rounded border px-3 py-2 text-sm opacity-80"}
        onClick={() => onChange("white")}
      >
        White
      </button>
      <button
        type="button"
        className={value === "black" ? "rounded border px-3 py-2 text-sm font-semibold" : "rounded border px-3 py-2 text-sm opacity-80"}
        onClick={() => onChange("black")}
      >
        Black
      </button>
    </div>
  );
}

export default function SettingsView({
  themeMode,
  accent: _accent,
  tradingMode,
  imports,
  onChangeThemeMode,
  onChangeTradingMode,
  onChangeAccent: _onChangeAccent,
  onClearAll
}: {
  themeMode: PersistedState["day"]["ui"]["themeMode"];
  accent: AccentThemeId;
  tradingMode: ProfileId;
  imports: Array<PersistedState["day"]["imports"][number] | PersistedState["investing"]["investingImports"][number]>;
  onChangeThemeMode: (mode: PersistedState["day"]["ui"]["themeMode"]) => void;
  onChangeTradingMode: (mode: ProfileId) => void;
  onChangeAccent: (accent: AccentThemeId) => void;
  onClearAll: () => void;
}) {
  const t212Account = useAppState((s) => s.investing.ui.trading212Account);
  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">Settings</h2>

      <section className="grid gap-2 rounded border p-3">
        <div className="text-sm font-semibold">Theme</div>
        <ThemeToggle value={themeMode} onChange={onChangeThemeMode} />
      </section>

      <section className="grid gap-2 rounded border p-3">
        <div className="text-sm font-semibold">Profile</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={tradingMode === "day" ? "rounded border px-3 py-2 text-sm font-semibold" : "rounded border px-3 py-2 text-sm opacity-80"}
            onClick={() => onChangeTradingMode("day")}
          >
            Day trading
          </button>
          <button
            type="button"
            className={tradingMode === "investing" ? "rounded border px-3 py-2 text-sm font-semibold" : "rounded border px-3 py-2 text-sm opacity-80"}
            onClick={() => onChangeTradingMode("investing")}
          >
            Long-term investing
          </button>
        </div>
      </section>

      <section className="grid gap-2 rounded border p-3">
        <div className="text-sm font-semibold">Imports</div>
        {imports.length ? (
          <ul className="grid gap-1 text-sm">
            {imports.map((imp) => (
              <li key={imp.id} className="border-b py-2 last:border-b-0">
                <div className="font-semibold">{imp.source}</div>
                <div className="text-xs opacity-70">
                  {new Date(imp.importedAt).toLocaleString()} •{" "}
                  {"tradeCount" in imp
                    ? `${imp.tradeCount} new trade${imp.tradeCount === 1 ? "" : "s"}`
                    : `${imp.rowCount} new row${imp.rowCount === 1 ? "" : "s"}`}
                </div>
                {typeof imp.attemptedCount === "number" && typeof imp.dedupedCount === "number" ? (
                  <div className="text-xs opacity-70">
                    Attempted: {imp.attemptedCount} • Loaded: {"tradeCount" in imp ? imp.tradeCount : imp.rowCount} • Deduped: {imp.dedupedCount}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm opacity-70">No imports yet.</div>
        )}
      </section>

      <section className="grid gap-2 rounded border p-3">
        <div className="text-sm font-semibold">Reset</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="w-fit rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm"
            onClick={() => {
              if (!confirm(`Clear all Trading 212 activity for ${t212Account === "isa" ? "ISA" : "regular"} account? This cannot be undone.`)) return;
              actions.clearInvestingForAccount(t212Account);
            }}
          >
            Clear investing activity ({t212Account === "isa" ? "ISA" : "regular"})
          </button>
        </div>
        <button type="button" className="w-fit rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm" onClick={onClearAll}>
          Clear local data
        </button>
      </section>
    </div>
  );
}
