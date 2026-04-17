import React from "react";
import type { AccentThemeId, PersistedStateV3 } from "../types";

function ThemeToggle({
  value,
  onChange
}: {
  value: PersistedStateV3["ui"]["themeMode"];
  onChange: (next: PersistedStateV3["ui"]["themeMode"]) => void;
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
  imports,
  onChangeThemeMode,
  onChangeAccent: _onChangeAccent,
  onClearAll
}: {
  themeMode: PersistedStateV3["ui"]["themeMode"];
  accent: AccentThemeId;
  imports: PersistedStateV3["imports"];
  onChangeThemeMode: (mode: PersistedStateV3["ui"]["themeMode"]) => void;
  onChangeAccent: (accent: AccentThemeId) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="grid gap-4">
      <h2 className="text-lg font-semibold">Settings</h2>

      <section className="grid gap-2 rounded border p-3">
        <div className="text-sm font-semibold">Theme</div>
        <ThemeToggle value={themeMode} onChange={onChangeThemeMode} />
      </section>

      <section className="grid gap-2 rounded border p-3">
        <div className="text-sm font-semibold">Imports</div>
        {imports.length ? (
          <ul className="grid gap-1 text-sm">
            {imports.map((imp) => (
              <li key={imp.id} className="border-b py-2 last:border-b-0">
                <div className="font-semibold">{imp.source}</div>
                <div className="text-xs opacity-70">
                  {new Date(imp.importedAt).toLocaleString()} • {imp.tradeCount} new trade{imp.tradeCount === 1 ? "" : "s"}
                </div>
                {typeof imp.attemptedCount === "number" && typeof imp.dedupedCount === "number" ? (
                  <div className="text-xs opacity-70">
                    Attempted: {imp.attemptedCount} • Loaded: {imp.tradeCount} • Deduped: {imp.dedupedCount}
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
        <button type="button" className="w-fit rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm" onClick={onClearAll}>
          Clear local data
        </button>
      </section>
    </div>
  );
}
