import React from "react";
import type { Trade } from "../types";
import { actions, useAppState } from "../store";

function getAsOfDate(trades: Trade[]): string {
  const maxIso = trades.reduce<string | null>((acc, t) => {
    const iso = t.openDatetime.slice(0, 10);
    if (!acc) return iso;
    return iso > acc ? iso : acc;
  }, null);
  return maxIso ?? new Date().toISOString().slice(0, 10);
}

export default function JournalView({ trades }: { trades: Trade[] }) {
  const activeProfile = useAppState((s) => s.activeProfile);
  const journals = useAppState((s) => (activeProfile === "investing" ? s.investing.journals : s.day.journals));
  const asOfDate = React.useMemo(() => getAsOfDate(trades), [trades]);
  const [day, setDay] = React.useState(asOfDate);

  React.useEffect(() => setDay(asOfDate), [asOfDate]);

  const entry = journals[day];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Daily journal</h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="app-input h-10 rounded-[0.6rem] px-3 text-sm focus:outline-none"
            value={day}
            onChange={(e) => setDay(e.target.value || asOfDate)}
          />
          <div className="text-xs opacity-70">{entry?.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "—"}</div>
        </div>
      </div>

      <label className="grid gap-1">
        <div className="text-sm opacity-70">Plan</div>
        <textarea
          className="app-input min-h-24 rounded-[0.6rem] px-3 py-2 text-sm focus:outline-none"
          value={entry?.plan ?? ""}
          onChange={(e) => actions.upsertDayJournal(day, { plan: e.target.value })}
        />
      </label>

      <label className="grid gap-1">
        <div className="text-sm opacity-70">Execution</div>
        <textarea
          className="app-input min-h-24 rounded-[0.6rem] px-3 py-2 text-sm focus:outline-none"
          value={entry?.execution ?? ""}
          onChange={(e) => actions.upsertDayJournal(day, { execution: e.target.value })}
        />
      </label>

      <label className="grid gap-1">
        <div className="text-sm opacity-70">Review</div>
        <textarea
          className="app-input min-h-24 rounded-[0.6rem] px-3 py-2 text-sm focus:outline-none"
          value={entry?.review ?? ""}
          onChange={(e) => actions.upsertDayJournal(day, { review: e.target.value })}
        />
      </label>

      <label className="grid gap-1">
        <div className="text-sm opacity-70">Tomorrow</div>
        <textarea
          className="app-input min-h-24 rounded-[0.6rem] px-3 py-2 text-sm focus:outline-none"
          value={entry?.tomorrow ?? ""}
          onChange={(e) => actions.upsertDayJournal(day, { tomorrow: e.target.value })}
        />
      </label>
    </div>
  );
}
