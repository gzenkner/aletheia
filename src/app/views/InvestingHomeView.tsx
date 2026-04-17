import { actions, useAppState } from "../store";
import type { InvestingActivity } from "../types";

export default function InvestingHomeView({
  activitiesAll,
  activitiesForAccount,
  onOpenActivity
}: {
  activitiesAll: InvestingActivity[];
  activitiesForAccount: InvestingActivity[];
  onOpenActivity: () => void;
}) {
  void activitiesAll;
  void activitiesForAccount;
  void onOpenActivity;

  const account = useAppState((s) => s.investing.ui.trading212Account);

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-card)] p-4">
        <label className="grid gap-1">
          <div className="text-[11px] uppercase tracking-[0.14em] app-muted">Portfolio</div>
          <select
            className="app-input h-10 rounded-[0.6rem] px-3 text-sm focus:outline-none"
            value={account}
            onChange={(e) => actions.setTrading212Account(e.target.value as "isa" | "general")}
          >
            <option value="isa">Trading 212 ISA</option>
            <option value="general">Trading 212</option>
          </select>
        </label>
      </div>
    </div>
  );
}
