import type { CSSProperties } from "react";
import type { AccentThemeId } from "./types";

type AccentTheme = {
  label: string;
  accent: string;
  accentStrong: string;
  soft: string;
  border: string;
  ink: string;
  glow: string;
  glowStrong: string;
};

export const ACCENT_THEME_ORDER: AccentThemeId[] = ["lavender", "sky", "sage", "apricot", "butter", "rose"];

export const ACCENT_THEMES: Record<AccentThemeId, AccentTheme> = {
  apricot: {
    label: "Apricot",
    accent: "#fdba74",
    accentStrong: "#f97316",
    soft: "#fff7ed",
    border: "#fed7aa",
    ink: "#0f172a",
    glow: "rgba(249, 115, 22, 0.18)",
    glowStrong: "rgba(249, 115, 22, 0.32)"
  },
  sage: {
    label: "Sage",
    accent: "#86efac",
    accentStrong: "#22c55e",
    soft: "#f0fdf4",
    border: "#bbf7d0",
    ink: "#0f172a",
    glow: "rgba(34, 197, 94, 0.18)",
    glowStrong: "rgba(34, 197, 94, 0.32)"
  },
  sky: {
    label: "Sky",
    accent: "#93c5fd",
    accentStrong: "#3b82f6",
    soft: "#eff6ff",
    border: "#bfdbfe",
    ink: "#0f172a",
    glow: "rgba(59, 130, 246, 0.18)",
    glowStrong: "rgba(59, 130, 246, 0.32)"
  },
  lavender: {
    label: "Lavender",
    accent: "#c4b5fd",
    accentStrong: "#7c3aed",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    ink: "#0f172a",
    glow: "rgba(124, 58, 237, 0.18)",
    glowStrong: "rgba(124, 58, 237, 0.32)"
  },
  butter: {
    label: "Butter",
    accent: "#fde68a",
    accentStrong: "#f59e0b",
    soft: "#fffbeb",
    border: "#fef3c7",
    ink: "#0f172a",
    glow: "rgba(245, 158, 11, 0.18)",
    glowStrong: "rgba(245, 158, 11, 0.32)"
  },
  rose: {
    label: "Rose",
    accent: "#fda4af",
    accentStrong: "#f43f5e",
    soft: "#fff1f2",
    border: "#fecdd3",
    ink: "#0f172a",
    glow: "rgba(244, 63, 94, 0.18)",
    glowStrong: "rgba(244, 63, 94, 0.32)"
  }
};

export function getAccentThemeStyle(themeId: AccentThemeId): CSSProperties {
  const theme = ACCENT_THEMES[themeId] ?? ACCENT_THEMES.lavender;
  return {
    ["--outcome-accent" as any]: theme.accent,
    ["--outcome-accent-strong" as any]: theme.accentStrong,
    ["--outcome-soft" as any]: theme.soft,
    ["--outcome-border" as any]: theme.border,
    ["--outcome-ink" as any]: theme.ink,
    ["--outcome-glow" as any]: theme.glow,
    ["--outcome-glow-strong" as any]: theme.glowStrong
  };
}
