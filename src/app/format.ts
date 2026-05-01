export function fmtMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toFixed(2)}`;
}

export function fmtPct(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function fmtCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}k`;
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function parseDatetimeLocal(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("T")) {
    const isoDate = new Date(trimmed);
    if (!Number.isNaN(isoDate.getTime())) return isoDate;
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, datePart, hmPart, ssPart] = match;
  const [yy, mm, dd] = datePart.split("-").map(Number);
  const [hh, min] = hmPart.split(":").map(Number);
  const ss = Number(ssPart ?? "0");
  if (!yy || !mm || !dd) return null;
  const d = new Date(yy, mm - 1, dd, hh || 0, min || 0, ss || 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function fmtDateTime(value: string): string {
  const d = parseDatetimeLocal(value);
  if (!d) return value;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}
