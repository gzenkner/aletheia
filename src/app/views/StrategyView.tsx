import React from "react";
import { actions, useAppState } from "../store";

export default function StrategyView() {
  const strategy = useAppState((s) => s.strategy);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Strategy</h2>
        <div className="text-xs opacity-70">Saved: {strategy.updatedAt ? new Date(strategy.updatedAt).toLocaleString() : "—"}</div>
      </div>

      <label className="grid gap-1">
        <div className="text-sm opacity-70">Name</div>
        <input
          className="app-input h-10 rounded-[0.6rem] px-3 text-sm focus:outline-none"
          value={strategy.name}
          onChange={(e) => actions.upsertStrategy({ name: e.target.value })}
        />
      </label>

      {(
        [
          ["Premise", "premise"],
          ["Universe", "universe"],
          ["Setup", "setup"],
          ["Entry", "entry"],
          ["Risk", "risk"],
          ["Management", "management"],
          ["Exits", "exits"],
          ["Don’ts", "donts"]
        ] as const
      ).map(([label, key]) => (
        <label key={key} className="grid gap-1">
          <div className="text-sm opacity-70">{label}</div>
          <textarea
            className="app-input min-h-20 rounded-[0.6rem] px-3 py-2 text-sm focus:outline-none"
            value={strategy[key]}
            onChange={(e) => actions.upsertStrategy({ [key]: e.target.value } as any)}
          />
        </label>
      ))}
    </div>
  );
}

