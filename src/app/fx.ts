import fxRatesUsdBase from "./data/fxRatesUsdBase.json";

export type ReportingCurrency = "GBP" | "USD" | "EUR";

type DailyFx = {
  USD: number;
  GBP: number;
  EUR: number;
};

const ratesByDate = fxRatesUsdBase as Record<string, DailyFx>;
const sortedDates = Object.keys(ratesByDate).sort();

function clampIsoDay(isoDay: string): string {
  return (isoDay || "").slice(0, 10);
}

function findRateDate(isoDay: string): string | undefined {
  if (!sortedDates.length) return undefined;
  const day = clampIsoDay(isoDay);
  if (!day) return sortedDates[sortedDates.length - 1];

  let lo = 0;
  let hi = sortedDates.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = sortedDates[mid]!;
    if (d <= day) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best >= 0) return sortedDates[best];
  return sortedDates[0];
}

function rateFor(currency: ReportingCurrency, isoDay: string): number | undefined {
  const date = findRateDate(isoDay);
  if (!date) return undefined;
  const daily = ratesByDate[date];
  if (!daily) return undefined;
  const value = daily[currency];
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function convertAmount(
  amount: number,
  from: ReportingCurrency,
  to: ReportingCurrency,
  isoDay: string
): number | undefined {
  if (!Number.isFinite(amount)) return undefined;
  if (from === to) return amount;
  const fromRate = rateFor(from, isoDay);
  const toRate = rateFor(to, isoDay);
  if (!fromRate || !toRate) return undefined;
  const inUsd = amount / fromRate;
  const converted = inUsd * toRate;
  return Number.isFinite(converted) ? converted : undefined;
}

