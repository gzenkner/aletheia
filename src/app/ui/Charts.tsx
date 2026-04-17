import React from "react";
import { cn } from "./cn";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 100) return n.toFixed(1);
  return n.toFixed(2);
}

type TooltipState = {
  open: boolean;
  x: number;
  y: number;
  title: string;
  lines: string[];
  pinned: boolean;
};

function Tooltip({ state }: { state: TooltipState }) {
  if (!state.open) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 w-[min(360px,80vw)] rounded-[0.85rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-3 py-2 text-sm shadow-[0_18px_60px_var(--app-shadow)]"
      style={{ left: state.x, top: state.y, transform: "translate(14px, 14px)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{state.title}</div>
        {state.pinned ? (
          <span className="rounded-[999px] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-2 py-0.5 text-[10px] font-semibold app-muted">
            Pinned
          </span>
        ) : null}
      </div>
      <div className="mt-1 space-y-0.5 text-[12px] app-muted">
        {state.lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
      {!state.pinned ? <div className="mt-1 text-[10px] app-muted">Click to pin • Scroll to zoom • Drag to pan (where supported)</div> : null}
    </div>
  );
}

function useResizeObserver<T extends Element>() {
  const ref = React.useRef<T | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const cr = entry.contentRect;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

type FrameEvent = {
  x: number;
  y: number;
  bounds: DOMRect;
  width: number;
  height: number;
};

type FrameApi = {
  pinned: boolean;
  showTooltip: (e: React.PointerEvent, content: Omit<TooltipState, "open" | "x" | "y" | "pinned">) => void;
  hideTooltip: () => void;
};

function useInteractiveFrame({
  height,
  ariaLabel,
  render,
  onPointer,
  onLeave,
  onWheel,
  onDoubleClick,
  onPointerDown,
  onPointerUp
}: {
  height: number;
  ariaLabel: string;
  render: (w: number, h: number) => React.ReactNode;
  onPointer: (e: React.PointerEvent, evt: FrameEvent, api: FrameApi) => void;
  onLeave?: () => void;
  onWheel?: (e: React.WheelEvent, evt: FrameEvent, api: FrameApi) => void;
  onDoubleClick?: (e: React.MouseEvent, evt: FrameEvent, api: FrameApi) => void;
  onPointerDown?: (e: React.PointerEvent, evt: FrameEvent, api: FrameApi) => void;
  onPointerUp?: (e: React.PointerEvent, evt: FrameEvent, api: FrameApi) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const { ref: innerRef, size } = useResizeObserver<HTMLDivElement>();
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const clickRef = React.useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [tooltip, setTooltip] = React.useState<TooltipState>({
    open: false,
    x: 0,
    y: 0,
    title: "",
    lines: [],
    pinned: false
  });
  const [pinned, setPinned] = React.useState(false);

  React.useEffect(() => {
    setTooltip((prev) => (prev.open ? { ...prev, pinned } : prev));
  }, [pinned]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPinned(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const api: FrameApi = React.useMemo(
    () => ({
      pinned,
      showTooltip: (e, content) => {
        if (pinned) return;
        const host = wrapRef.current;
        if (!host) return;
        const r = host.getBoundingClientRect();
        const x = clamp(e.clientX - r.left, 0, r.width);
        const y = clamp(e.clientY - r.top, 0, r.height);
        setTooltip({ open: true, x, y, pinned, ...content });
      },
      hideTooltip: () => {
        if (pinned) return;
        setTooltip((prev) => (prev.open ? { ...prev, open: false } : prev));
      }
    }),
    [pinned]
  );

  const getFrameEvent = React.useCallback(
    (e: { clientX: number; clientY: number }): FrameEvent | null => {
      const host = svgRef.current;
      if (!host) return null;
      const bounds = host.getBoundingClientRect();
      const x = clamp(e.clientX - bounds.left, 0, bounds.width);
      const y = clamp(e.clientY - bounds.top, 0, bounds.height);
      return { x, y, bounds, width: bounds.width, height: bounds.height };
    },
    [svgRef]
  );

  function clearHover() {
    api.hideTooltip();
    if (!pinned) onLeave?.();
  }

  const w = Math.max(1, Math.floor(size.width));

  return {
    w,
    h: height,
    pinned,
    setPinned,
    tooltip,
    frame: (
      <div
        ref={wrapRef}
        className="relative cursor-crosshair overflow-hidden"
        style={{ height, touchAction: "none" }}
        onPointerLeave={clearHover}
        onPointerMove={(e) => {
          const evt = getFrameEvent(e);
          if (!evt) return;
          onPointer(e, evt, api);
        }}
        onWheel={(e) => {
          if (!onWheel) return;
          const evt = getFrameEvent(e);
          if (!evt) return;
          onWheel(e, evt, api);
        }}
        onDoubleClick={(e) => {
          if (!onDoubleClick) return;
          const evt = getFrameEvent(e);
          if (!evt) return;
          onDoubleClick(e, evt, api);
        }}
        onPointerDown={(e) => {
          clickRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
          if (!onPointerDown) return;
          const evt = getFrameEvent(e);
          if (!evt) return;
          onPointerDown(e, evt, api);
        }}
        onPointerUp={(e) => {
          const start = clickRef.current;
          if (start && start.pointerId === e.pointerId) {
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 6) setPinned((v) => !v);
            clickRef.current = null;
          }
          if (!onPointerUp) return;
          const evt = getFrameEvent(e);
          if (!evt) return;
          onPointerUp(e, evt, api);
        }}
      >
        <div ref={innerRef} className="h-full w-full">
          <svg
            ref={svgRef}
            aria-label={ariaLabel}
            role="img"
            className="block h-full w-full select-none"
            width="100%"
            height="100%"
            viewBox={`0 0 ${w} ${height}`}
            preserveAspectRatio="none"
          >
            {render(w, height)}
          </svg>
        </div>
        <Tooltip state={tooltip} />
      </div>
    )
  };
}

function niceStep(span: number, targetTicks: number) {
  const raw = span / Math.max(1, targetTicks);
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const scaled = raw / pow;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * pow;
}

function ticks(min: number, max: number, target = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const span = max - min;
  const step = niceStep(Math.abs(span), target);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step * 0.5; v += step) out.push(v);
  return out;
}

function linePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return `M ${points[0]!.x} ${points[0]!.y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}

function areaPath(points: Array<{ x: number; y: number }>, yBase: number) {
  if (!points.length) return "";
  const top = linePath(points);
  const last = points[points.length - 1]!;
  const first = points[0]!;
  return `${top} L ${last.x} ${yBase} L ${first.x} ${yBase} Z`;
}

function formatDateLabel(isoDay: string) {
  // ISO yyyy-mm-dd => mm-dd for dense axis labels
  if (isoDay.length >= 10) return isoDay.slice(5);
  return isoDay;
}

export function SimpleBarChart({
  values,
  height = 180,
  ariaLabel = "Bar chart",
  valueLabel = "Value",
  formatValue = fmt
}: {
  values: Array<{ label: string; value: number; title?: string }>;
  height?: number;
  ariaLabel?: string;
  valueLabel?: string;
  formatValue?: (value: number) => string;
}) {
  const pad = { l: 6, r: 6, t: 8, b: 22 };
  const svgW = Math.max(240, values.length * 64);
  const innerW = Math.max(1, svgW - pad.l - pad.r);
  const innerH = Math.max(1, height - pad.t - pad.b);
  const ys = values.map((v) => v.value);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const spanY = Math.max(1e-9, maxY - minY);
  const yFor = (v: number) => pad.t + innerH - ((v - minY) / spanY) * innerH;
  const zeroY = yFor(0);

  const slot = innerW / Math.max(1, values.length);
  const barW = clamp(slot * 0.78, 10, 42);

  return (
    <svg
      aria-label={ariaLabel}
      role="img"
      className="block w-full"
      width="100%"
      height={height}
      viewBox={`0 0 ${svgW} ${height}`}
      preserveAspectRatio="none"
    >
      <title>{ariaLabel}</title>
      <line x1={pad.l} x2={svgW - pad.r} y1={zeroY} y2={zeroY} stroke="var(--app-border)" strokeWidth={2} opacity={0.7} />

      {values.map((v, i) => {
        const x = pad.l + i * slot + (slot - barW) / 2;
        const y = yFor(v.value);
        const top = Math.min(y, zeroY);
        const bottom = Math.max(y, zeroY);
        const label = v.title ?? v.label;
        const valueText = `${valueLabel}: ${formatValue(v.value)}`;
        return (
          <g key={`${v.label}-${i}`}>
            <title>
              {label}
              {"\n"}
              {valueText}
            </title>
            <rect
              x={x}
              y={top}
              width={barW}
              height={Math.max(2, bottom - top)}
              rx={8}
              fill={v.value >= 0 ? "var(--app-signal-green-fill)" : "var(--app-signal-red-fill)"}
              opacity={0.85}
            />
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--app-muted)" opacity={0.9}>
              {formatDateLabel(v.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ChartCard({
  title,
  subtitle,
  right,
  dense = false,
  children
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  dense?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[0.95rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)]", dense ? "p-4" : "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="app-kicker">{title}</div>
          {subtitle ? <div className="mt-1 text-xs app-muted">{subtitle}</div> : null}
        </div>
        {right ? <div className="text-xs app-muted">{right}</div> : null}
      </div>
      <div className={dense ? "mt-3" : "mt-4"}>{children}</div>
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: "green" | "red" | "accent" | "muted" }> }) {
  const dotClass = (color: string) => {
    if (color === "green") return "bg-[color:var(--app-signal-green-fill)]";
    if (color === "red") return "bg-[color:var(--app-signal-red-fill)]";
    if (color === "accent") return "bg-[color:var(--outcome-accent-strong)]";
    return "bg-[color:var(--app-border)]";
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] app-muted">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className={cn("inline-block h-2 w-2 rounded-full", dotClass(it.color))} /> {it.label}
        </div>
      ))}
    </div>
  );
}

export function EquityCurveChart({
  values,
  height = 520
}: {
  values: Array<{ label: string; value: number; title?: string }>;
  height?: number;
}) {
  const n = values.length;
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const [view, setView] = React.useState<{ start: number; end: number }>(() => ({ start: 0, end: Math.max(0, n - 1) }));
  const dragRef = React.useRef<{ startX: number; viewStart: number; viewEnd: number; pointerId: number } | null>(null);

  React.useEffect(() => {
    setView({ start: 0, end: Math.max(0, n - 1) });
  }, [n]);

  const frame = useInteractiveFrame({
    height,
    ariaLabel: "Equity curve",
    onLeave: () => setActiveIdx(null),
    onPointer: (e, evt, api) => {
      if (!n) return;
      if (api.pinned && !dragRef.current) return;
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, evt.width - pad.l - pad.r);
      const start = clamp(view.start, 0, Math.max(0, n - 1));
      const end = clamp(view.end, start, Math.max(0, n - 1));
      const span = Math.max(1, end - start);
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dragSpan = Math.max(1, dragRef.current.viewEnd - dragRef.current.viewStart);
        const pxPerPoint = innerW / dragSpan;
        const shift = Math.round(-dx / Math.max(1, pxPerPoint));
        const nextStart = clamp(dragRef.current.viewStart + shift, 0, Math.max(0, n - 1 - dragSpan));
        setView({ start: nextStart, end: nextStart + dragSpan });
        return;
      }

      const x = clamp(evt.x - pad.l, 0, innerW);
      const t = clamp(x / innerW, 0, 1);
      const idx = clamp(Math.round(start + t * span), start, end);
      setActiveIdx(idx);
      const p = values[idx]!;
      api.showTooltip(e, { title: p.title ?? p.label, lines: [`Equity: ${fmt(p.value)}`, "Scroll = zoom • Drag = pan"] });
    },
    onWheel: (e, evt) => {
      if (!n) return;
      e.preventDefault();
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, evt.width - pad.l - pad.r);
      const x = clamp(evt.x - pad.l, 0, innerW);
      const t = clamp(x / innerW, 0, 1);
      const start = clamp(view.start, 0, Math.max(0, n - 1));
      const end = clamp(view.end, start, Math.max(0, n - 1));
      const span = Math.max(1, end - start);
      const center = start + t * span;
      const factor = e.deltaY > 0 ? 1.22 : 1 / 1.22;
      const nextSpan = clamp(Math.round(span * factor), 6, Math.max(6, n - 1));
      const nextStart = clamp(Math.round(center - t * nextSpan), 0, Math.max(0, n - 1 - nextSpan));
      setView({ start: nextStart, end: nextStart + nextSpan });
    },
    onDoubleClick: (_e) => {
      setView({ start: 0, end: Math.max(0, n - 1) });
    },
    onPointerDown: (e) => {
      if (!n) return;
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, viewStart: view.start, viewEnd: view.end, pointerId: e.pointerId };
    },
    onPointerUp: (e) => {
      if (!dragRef.current) return;
      if (dragRef.current.pointerId === e.pointerId) dragRef.current = null;
    },
    render: (w, h) => {
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, w - pad.l - pad.r);
      const innerH = Math.max(1, h - pad.t - pad.b);
      const start = clamp(view.start, 0, Math.max(0, n - 1));
      const end = clamp(view.end, start, Math.max(0, n - 1));
      const slice = values.slice(start, end + 1);
      const ys = slice.map((p) => p.value);
      const minY = Math.min(0, ...ys);
      const maxY = Math.max(0, ...ys);
      const spanY = Math.max(1e-9, maxY - minY);
      const xFor = (i: number) => pad.l + (i / Math.max(1, slice.length - 1)) * innerW;
      const yFor = (v: number) => pad.t + innerH - ((v - minY) / spanY) * innerH;
      const pts = slice.map((p, i) => ({ x: xFor(i), y: yFor(p.value) }));
      const y0 = pad.t + innerH;
      const zeroY = yFor(0);
      const yTicks = ticks(minY, maxY, 6);

      const xTicks = (() => {
        const wanted = 6;
        const step = Math.max(1, Math.floor(slice.length / wanted));
        const out: Array<{ x: number; label: string }> = [];
        for (let i = 0; i < slice.length; i += step) out.push({ x: xFor(i), label: formatDateLabel(slice[i]!.label) });
        if (slice.length > 1) out.push({ x: xFor(slice.length - 1), label: formatDateLabel(slice[slice.length - 1]!.label) });
        const dedup = new Map<string, { x: number; label: string }>();
        for (const t of out) dedup.set(`${t.x}|${t.label}`, t);
        return [...dedup.values()];
      })();

      const active = activeIdx !== null ? clamp(activeIdx, start, end) : null;
      const activeLocal = active === null ? null : active - start;
      const activePt = activeLocal === null ? null : pts[activeLocal] ?? null;

      return (
        <g>
          <rect x={pad.l} y={pad.t} width={innerW} height={innerH} fill="transparent" />

          {yTicks.map((t) => {
            const y = yFor(t);
            const isZero = Math.abs(t) < 1e-9;
            return (
              <g key={t}>
                <line
                  x1={pad.l}
                  x2={w - pad.r}
                  y1={y}
                  y2={y}
                  stroke="var(--app-border)"
                  strokeWidth={isZero ? 2 : 1}
                  opacity={isZero ? 0.6 : 0.35}
                />
                <text x={pad.l - 10} y={y + 4} textAnchor="end" fontSize="10" fill="var(--app-muted)" opacity={0.9}>
                  {fmt(t)}
                </text>
              </g>
            );
          })}

          {xTicks.map((t) => (
            <text
              key={`${t.x}-${t.label}`}
              x={t.x}
              y={h - 10}
              textAnchor="middle"
              fontSize="10"
              fill="var(--app-muted)"
              opacity={0.9}
            >
              {t.label}
            </text>
          ))}

          {slice.length ? (
            <path d={areaPath(pts, y0)} fill="var(--outcome-soft)" opacity={0.72} />
          ) : null}
          {slice.length ? (
            <path
              d={linePath(pts)}
              fill="none"
              stroke="var(--outcome-accent-strong)"
              strokeWidth={3.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {zeroY >= pad.t && zeroY <= y0 ? (
            <line x1={pad.l} x2={w - pad.r} y1={zeroY} y2={zeroY} stroke="var(--app-border)" strokeWidth={2} opacity={0.55} />
          ) : null}

          {activePt ? (
            <g>
              <line x1={activePt.x} x2={activePt.x} y1={pad.t} y2={pad.t + innerH} stroke="var(--app-border)" strokeWidth={2} opacity={0.4} />
              <circle cx={activePt.x} cy={activePt.y} r={7.5} fill="var(--outcome-accent-strong)" />
              <circle cx={activePt.x} cy={activePt.y} r={14} fill="none" stroke="var(--outcome-accent-strong)" strokeWidth={3} opacity={0.22} />
            </g>
          ) : null}

          <text x={pad.l} y={14} fontSize="10" fill="var(--app-muted)" opacity={0.85}>
            Zoom: {Math.max(1, end - start + 1)} pts
          </text>
        </g>
      );
    }
  });

  return frame.frame;
}

export function ZeroBarChart({
  values,
  height = 420,
  ariaLabel = "Bar chart",
  valueLabel = "P&L",
  formatValue = fmt
}: {
  values: Array<{ label: string; value: number; title?: string }>;
  height?: number;
  ariaLabel?: string;
  valueLabel?: string;
  formatValue?: (value: number) => string;
}) {
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const n = values.length;
  const [view, setView] = React.useState<{ start: number; end: number }>(() => ({ start: 0, end: Math.max(0, n - 1) }));
  const dragRef = React.useRef<{ startX: number; viewStart: number; viewEnd: number; pointerId: number } | null>(null);
  React.useEffect(() => setView({ start: 0, end: Math.max(0, n - 1) }), [n]);

  const frame = useInteractiveFrame({
    height,
    ariaLabel,
    onLeave: () => setActiveIdx(null),
    onPointer: (e, evt, api) => {
      if (!n) return;
      if (api.pinned && !dragRef.current) return;
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, evt.width - pad.l - pad.r);
      const start = clamp(view.start, 0, Math.max(0, n - 1));
      const end = clamp(view.end, start, Math.max(0, n - 1));
      const span = Math.max(1, end - start + 1);
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dragSpan = Math.max(1, dragRef.current.viewEnd - dragRef.current.viewStart);
        const pxPerPoint = innerW / dragSpan;
        const shift = Math.round(-dx / Math.max(1, pxPerPoint));
        const nextStart = clamp(dragRef.current.viewStart + shift, 0, Math.max(0, n - 1 - dragSpan));
        setView({ start: nextStart, end: nextStart + dragSpan });
        return;
      }
      const x = clamp(evt.x - pad.l, 0, innerW);
      const t = clamp(x / innerW, 0, 1);
      const idx = clamp(start + Math.floor(t * span), start, end);
      setActiveIdx(idx);
      const v = values[idx]!;
      api.showTooltip(e, { title: v.title ?? v.label, lines: [`${valueLabel}: ${formatValue(v.value)}`, "Scroll = zoom • Drag = pan"] });
    },
    onWheel: (e, evt) => {
      if (!n) return;
      e.preventDefault();
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, evt.width - pad.l - pad.r);
      const x = clamp(evt.x - pad.l, 0, innerW);
      const t = clamp(x / innerW, 0, 1);
      const start = clamp(view.start, 0, Math.max(0, n - 1));
      const end = clamp(view.end, start, Math.max(0, n - 1));
      const span = Math.max(1, end - start);
      const center = start + t * span;
      const factor = e.deltaY > 0 ? 1.22 : 1 / 1.22;
      const nextSpan = clamp(Math.round(span * factor), 8, Math.max(8, n - 1));
      const nextStart = clamp(Math.round(center - t * nextSpan), 0, Math.max(0, n - 1 - nextSpan));
      setView({ start: nextStart, end: nextStart + nextSpan });
    },
    onDoubleClick: () => setView({ start: 0, end: Math.max(0, n - 1) }),
    onPointerDown: (e) => {
      if (!n) return;
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, viewStart: view.start, viewEnd: view.end, pointerId: e.pointerId };
    },
    onPointerUp: (e) => {
      if (!dragRef.current) return;
      if (dragRef.current.pointerId === e.pointerId) dragRef.current = null;
    },
    render: (w, h) => {
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, w - pad.l - pad.r);
      const innerH = Math.max(1, h - pad.t - pad.b);
      const start = clamp(view.start, 0, Math.max(0, n - 1));
      const end = clamp(view.end, start, Math.max(0, n - 1));
      const slice = values.slice(start, end + 1);
      const ys = slice.map((p) => p.value);
      const minY = Math.min(0, ...ys);
      const maxY = Math.max(0, ...ys);
      const spanY = Math.max(1e-9, maxY - minY);
      const yFor = (v: number) => pad.t + innerH - ((v - minY) / spanY) * innerH;
      const zeroY = yFor(0);
      const yTicks = ticks(minY, maxY, 6);
      const slot = innerW / Math.max(1, slice.length);
      const barW = clamp(slot * 0.82, 10, 46);

      const active = activeIdx !== null ? clamp(activeIdx, start, end) : null;

      const xTicks = (() => {
        const wanted = 8;
        const step = Math.max(1, Math.floor(slice.length / wanted));
        const out: Array<{ x: number; label: string }> = [];
        for (let i = 0; i < slice.length; i += step) {
          out.push({ x: pad.l + i * slot + slot / 2, label: formatDateLabel(slice[i]!.label) });
        }
        if (slice.length > 1) out.push({ x: pad.l + (slice.length - 1) * slot + slot / 2, label: formatDateLabel(slice[slice.length - 1]!.label) });
        const dedup = new Map<string, { x: number; label: string }>();
        for (const t of out) dedup.set(`${t.x}|${t.label}`, t);
        return [...dedup.values()];
      })();

      return (
        <g>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={yFor(t)} y2={yFor(t)} stroke="var(--app-border)" strokeWidth={1} opacity={0.34} />
              <text x={pad.l - 10} y={yFor(t) + 4} textAnchor="end" fontSize="10" fill="var(--app-muted)" opacity={0.9}>
                {formatValue(t)}
              </text>
            </g>
          ))}

          <line x1={pad.l} x2={w - pad.r} y1={zeroY} y2={zeroY} stroke="var(--app-border)" strokeWidth={2} opacity={0.6} />

          {slice.map((v, i) => {
            const x = pad.l + i * slot + (slot - barW) / 2;
            const y = yFor(v.value);
            const top = Math.min(y, zeroY);
            const bottom = Math.max(y, zeroY);
            const isActive = active !== null && start + i === active;
            const rx = 10;
            return (
              <rect
                key={`${v.label}-${i}`}
                x={x}
                y={top}
                width={barW}
                height={Math.max(2, bottom - top)}
                rx={rx}
                fill={v.value >= 0 ? "var(--app-signal-green-fill)" : "var(--app-signal-red-fill)"}
                opacity={isActive ? 0.98 : 0.82}
              />
            );
          })}

          {active !== null ? (
            <line
              x1={pad.l + (active - start) * slot + slot / 2}
              x2={pad.l + (active - start) * slot + slot / 2}
              y1={pad.t}
              y2={pad.t + innerH}
              stroke="var(--app-border)"
              strokeWidth={2}
              opacity={0.35}
            />
          ) : null}

          {xTicks.map((t) => (
            <text key={`${t.x}-${t.label}`} x={t.x} y={h - 10} textAnchor="middle" fontSize="10" fill="var(--app-muted)" opacity={0.9}>
              {t.label}
            </text>
          ))}
        </g>
      );
    }
  });

  return frame.frame;
}

export function HistogramChart({
  values,
  bins = 18,
  height = 380,
  label
}: {
  values: number[];
  bins?: number;
  height?: number;
  label: string;
}) {
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const computed = React.useMemo(() => {
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1e-9, max - min);
    const step = span / bins;
    const counts = new Array(bins).fill(0) as number[];
    for (const v of values) {
      const idx = clamp(Math.floor((v - min) / step), 0, bins - 1);
      counts[idx] += 1;
    }
    const maxCount = Math.max(1, ...counts);
    return { min, step, counts, maxCount };
  }, [bins, values]);

  const frame = useInteractiveFrame({
    height,
    ariaLabel: label,
    onLeave: () => setActiveIdx(null),
    onPointer: (e, evt, api) => {
      if (!computed) return;
      if (api.pinned) return;
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, evt.width - pad.l - pad.r);
      const x = clamp(evt.x - pad.l, 0, innerW);
      const slot = innerW / bins;
      const idx = clamp(Math.floor(x / Math.max(1, slot)), 0, bins - 1);
      setActiveIdx(idx);
      const count = computed.counts[idx] ?? 0;
      const binMin = computed.min + idx * computed.step;
      const binMax = binMin + computed.step;
      api.showTooltip(e, { title: `Bucket ${idx + 1}/${bins}`, lines: [`${count} trade(s)`, `[${fmt(binMin)} … ${fmt(binMax)}]`] });
    },
    render: (w, h) => {
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, w - pad.l - pad.r);
      const innerH = Math.max(1, h - pad.t - pad.b);
      const y0 = pad.t + innerH;
      if (!computed) {
        return (
          <text x={w / 2} y={h / 2} textAnchor="middle" fontSize="12" fill="var(--app-muted)" opacity={0.9}>
            No data
          </text>
        );
      }
      const slot = innerW / bins;
      const barW = clamp(slot * 0.88, 10, 48);
      const active = activeIdx !== null ? clamp(activeIdx, 0, bins - 1) : null;

      const yTicks = ticks(0, computed.maxCount, 5);
      return (
        <g>
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={y0 - (t / Math.max(1, computed.maxCount)) * innerH}
                y2={y0 - (t / Math.max(1, computed.maxCount)) * innerH}
                stroke="var(--app-border)"
                strokeWidth={1}
                opacity={0.32}
              />
              <text x={pad.l - 10} y={y0 - (t / Math.max(1, computed.maxCount)) * innerH + 4} textAnchor="end" fontSize="10" fill="var(--app-muted)" opacity={0.9}>
                {String(Math.round(t))}
              </text>
            </g>
          ))}

          {computed.counts.map((c, idx) => {
            const x = pad.l + idx * slot + (slot - barW) / 2;
            const barH = (c / computed.maxCount) * innerH;
            const top = y0 - barH;
            const binMin = computed.min + idx * computed.step;
            const binMax = binMin + computed.step;
            const mid = (binMin + binMax) / 2;
            const isActive = active === idx;
            return (
              <rect
                key={idx}
                x={x}
                y={top}
                width={barW}
                height={Math.max(2, barH)}
                rx={12}
                fill={mid >= 0 ? "var(--app-signal-green-fill)" : "var(--app-signal-red-fill)"}
                opacity={isActive ? 0.98 : 0.78}
              />
            );
          })}

          {active !== null ? (
            <line
              x1={pad.l + active * slot + slot / 2}
              x2={pad.l + active * slot + slot / 2}
              y1={pad.t}
              y2={y0}
              stroke="var(--app-border)"
              strokeWidth={2}
              opacity={0.32}
            />
          ) : null}

          <text x={pad.l} y={14} fontSize="10" fill="var(--app-muted)" opacity={0.85}>
            Negative left • Positive right
          </text>
        </g>
      );
    }
  });

  return frame.frame;
}

export function StackedWinLossBars({
  items,
  height = 380
}: {
  items: Array<{ label: string; wins: number; losses: number; flat?: number; title?: string }>;
  height?: number;
}) {
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const computed = React.useMemo(() => {
    const totals = items.map((i) => i.wins + i.losses + (i.flat ?? 0));
    return { maxTotal: Math.max(1, ...totals) };
  }, [items]);
  const frame = useInteractiveFrame({
    height,
    ariaLabel: "Wins and losses",
    onLeave: () => setActiveIdx(null),
    onPointer: (e, evt, api) => {
      if (!items.length) return;
      if (api.pinned) return;
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, evt.width - pad.l - pad.r);
      const x = clamp(evt.x - pad.l, 0, innerW);
      const slot = innerW / Math.max(1, items.length);
      const idx = clamp(Math.floor(x / Math.max(1, slot)), 0, items.length - 1);
      const it = items[idx]!;
      setActiveIdx(idx);
      api.showTooltip(e, { title: it.title ?? it.label, lines: [`${it.wins} wins`, `${it.losses} losses`, `${it.flat ?? 0} flat`] });
    },
    render: (w, h) => {
      const pad = { l: 64, r: 18, t: 18, b: 38 };
      const innerW = Math.max(1, w - pad.l - pad.r);
      const innerH = Math.max(1, h - pad.t - pad.b);
      const y0 = pad.t + innerH;
      const slot = innerW / Math.max(1, items.length);
      const barW = clamp(slot * 0.78, 22, 74);
      const yFor = (count: number) => y0 - (count / computed.maxTotal) * innerH;
      const active = activeIdx !== null ? clamp(activeIdx, 0, Math.max(0, items.length - 1)) : null;
      const yTicks = ticks(0, computed.maxTotal, 5);

      return (
        <g>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={yFor(t)} y2={yFor(t)} stroke="var(--app-border)" strokeWidth={1} opacity={0.32} />
              <text x={pad.l - 10} y={yFor(t) + 4} textAnchor="end" fontSize="10" fill="var(--app-muted)" opacity={0.9}>
                {String(Math.round(t))}
              </text>
            </g>
          ))}

          {items.map((it, idx) => {
            const total = it.wins + it.losses + (it.flat ?? 0);
            const x = pad.l + idx * slot + (slot - barW) / 2;
            const yTop = yFor(total);
            const yWinsTop = yFor(it.wins + (it.flat ?? 0));
            const yFlatTop = yFor(it.flat ?? 0);
            const isActive = active === idx;

            const hTotal = Math.max(2, y0 - yTop);
            const hLoss = Math.max(0, y0 - yWinsTop);
            const hWins = Math.max(0, yWinsTop - yFlatTop);
            const hFlat = Math.max(0, yFlatTop - yTop);

            return (
              <g key={it.label}>
                <rect x={x} y={yTop} width={barW} height={hTotal} rx={14} fill="var(--app-border)" opacity={0.14} />
                {hLoss > 0 ? (
                  <rect x={x} y={yWinsTop} width={barW} height={hLoss} rx={14} fill="var(--app-signal-red-fill)" opacity={isActive ? 0.98 : 0.82} />
                ) : null}
                {hWins > 0 ? (
                  <rect x={x} y={yFlatTop} width={barW} height={hWins} rx={14} fill="var(--app-signal-green-fill)" opacity={isActive ? 0.98 : 0.82} />
                ) : null}
                {hFlat > 0 ? (
                  <rect x={x} y={yTop} width={barW} height={hFlat} rx={14} fill="var(--outcome-accent)" opacity={isActive ? 0.46 : 0.32} />
                ) : null}

                <text x={x + barW / 2} y={h - 10} textAnchor="middle" fontSize="10" fill="var(--app-muted)" opacity={0.92}>
                  {it.label}
                </text>
              </g>
            );
          })}

          {active !== null ? (
            <line
              x1={pad.l + active * slot + slot / 2}
              x2={pad.l + active * slot + slot / 2}
              y1={pad.t}
              y2={y0}
              stroke="var(--app-border)"
              strokeWidth={2}
              opacity={0.28}
            />
          ) : null}
        </g>
      );
    }
  });

  return frame.frame;
}

export function Heatmap({
  rows,
  cols,
  cells,
  height = 560,
  ariaLabel
}: {
  rows: string[];
  cols: string[];
  cells: Array<Array<{ pnl: number; wins: number; losses: number; total: number }>>;
  height?: number;
  ariaLabel: string;
}) {
  const [active, setActive] = React.useState<{ row: number; col: number } | null>(null);
  const computed = React.useMemo(() => {
    const pnls: number[] = [];
    for (const r of cells) for (const c of r) if (c.total) pnls.push(c.pnl);
    const maxAbs = Math.max(1e-9, ...pnls.map((v) => Math.abs(v)));
    return { maxAbs };
  }, [cells]);
  const frame = useInteractiveFrame({
    height,
    ariaLabel,
    onLeave: () => setActive(null),
    onPointer: (e, evt, api) => {
      if (api.pinned) return;
      const pad = { l: 86, r: 18, t: 26, b: 26 };
      const innerW = evt.width - pad.l - pad.r;
      const innerH = evt.height - pad.t - pad.b;
      const x = evt.x;
      const y = evt.y;
      if (x < pad.l || y < pad.t || x > evt.width - pad.r || y > evt.height - pad.b) return;
      const cellW = innerW / Math.max(1, cols.length);
      const cellH = innerH / Math.max(1, rows.length);
      const col = clamp(Math.floor((x - pad.l) / cellW), 0, cols.length - 1);
      const row = clamp(Math.floor((y - pad.t) / cellH), 0, rows.length - 1);
      const cell = cells[row]?.[col];
      setActive({ row, col });
      api.showTooltip(e, {
        title: `${rows[row]} • ${cols[col]}`,
        lines: cell?.total ? [`${cell.wins}W / ${cell.losses}L`, `${cell.total} trade(s)`, `P&L: ${fmt(cell.pnl)}`] : ["No trades"]
      });
    },
    render: (w, h) => {
      const pad = { l: 86, r: 18, t: 26, b: 26 };
      const innerW = Math.max(1, w - pad.l - pad.r);
      const innerH = Math.max(1, h - pad.t - pad.b);
      const cellW = innerW / Math.max(1, cols.length);
      const cellH = innerH / Math.max(1, rows.length);

      return (
        <g>
          <text x={pad.l} y={14} fontSize="10" fill="var(--app-muted)" opacity={0.85}>
            Net P&L intensity
          </text>

          {cols.map((c, idx) => (
            <text
              key={c}
              x={pad.l + idx * cellW + cellW / 2}
              y={18}
              textAnchor="middle"
              fontSize="10"
              fill="var(--app-muted)"
              opacity={0.92}
            >
              {c}
            </text>
          ))}
          {rows.map((r, idx) => (
            <text
              key={r}
              x={pad.l - 10}
              y={pad.t + idx * cellH + cellH / 2 + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--app-muted)"
              opacity={0.92}
            >
              {r}
            </text>
          ))}

          {rows.map((_, r) =>
            cols.map((_, c) => {
              const cell = cells[r]?.[c];
              const x = pad.l + c * cellW;
              const y = pad.t + r * cellH;
              const wRect = cellW - 10;
              const hRect = cellH - 10;

              let fill = "var(--app-border)";
              let opacity = 0.12;
              if (cell && cell.total) {
                const t = clamp(Math.abs(cell.pnl) / computed.maxAbs, 0, 1);
                opacity = 0.22 + t * 0.72;
                fill = cell.pnl >= 0 ? "var(--app-signal-green-fill)" : "var(--app-signal-red-fill)";
              }
              const isActive = active?.row === r && active?.col === c;
              return (
                <g key={`${r}-${c}`}>
                  <rect x={x} y={y} width={wRect} height={hRect} rx={14} fill={fill} opacity={opacity} />
                  <rect x={x} y={y} width={wRect} height={hRect} rx={14} fill="transparent" stroke="var(--app-border)" strokeWidth={1} opacity={0.75} />
                  {isActive ? (
                    <rect
                      x={x}
                      y={y}
                      width={wRect}
                      height={hRect}
                      rx={14}
                      fill="transparent"
                      stroke="var(--outcome-accent-strong)"
                      strokeWidth={3}
                      opacity={0.8}
                    />
                  ) : null}
                </g>
              );
            })
          )}
        </g>
      );
    }
  });

  return frame.frame;
}
