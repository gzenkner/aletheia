import React from "react";
import { cn } from "./cn";

export default function TradeLoggerLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)} aria-label="TradeLogger">
      <svg
        viewBox="0 0 34 34"
        className="h-[3.25rem] w-[3.25rem] shrink-0 text-[color:var(--outcome-ink)]"
        role="img"
        aria-hidden="true"
      >
        <circle cx="17" cy="17" r="10.5" fill="none" stroke="currentColor" strokeWidth="4.4" />
        <path d="M9.4 20.1 13.6 16 17.1 19.4 25.6 10.8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="26.2" cy="10.2" r="2" fill="currentColor" />
      </svg>

      <div className="leading-none">
        <div className="font-display text-[1.35rem] font-semibold lowercase tracking-[0.08em]" style={{ color: "var(--outcome-ink)" }}>
          tradelogger
        </div>
        <div className="mt-1 text-[11px] tracking-[0.18em] uppercase app-muted">momentum review</div>
      </div>
    </div>
  );
}

