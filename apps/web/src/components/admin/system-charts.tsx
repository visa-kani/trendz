"use client";

import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Table2, XCircle, BarChart3 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Card, EmptyState } from "@/components/ui";
import { money } from "@/lib/format";

/**
 * Neutral chart palette: ink and greys carry the data, one accent marks the
 * hero series. Status colours are reserved for stock health.
 */
export const CHART = {
  ink: "#111111",
  inkSoft: "#5f5f5b",
  accent: "#2a78d6",
  grid: "#ecebe8",
  axis: "#8b8a85",
  cursor: "rgba(17,17,17,0.04)",
  success: "#1f7a4d",
  warning: "#b26b00",
  danger: "#b42318",
} as const;

const compactInr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const count = new Intl.NumberFormat("en-IN");

/** ₹ axis ticks: exact below ₹1 lakh, compact (₹1.2L, ₹3.4Cr) above. */
export const axisMoney = (paise: number) => (Math.abs(paise) < 10_000_000 ? money(paise) : compactInr.format(paise / 100));
export const formatCount = (n: number) => count.format(n);

const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
const longDayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const longMonthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** Dates from the chart API are IST calendar days ("YYYY-MM-DD"); format them as-is. */
const parseDay = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`);

const axisTick = { fontSize: 11, fill: CHART.axis };

// ---------------------------------------------------------------------------
// Frame: a card with a chart / table toggle so every chart has a table view
// ---------------------------------------------------------------------------

export interface ChartTable {
  headers: string[];
  /** Columns at these indexes are right-aligned (numbers). */
  numeric?: number[];
  rows: ReactNode[][];
}

export function ChartCard({ title, subtitle, actions, table, children, className }: { title: string; subtitle?: string; actions?: ReactNode; table?: ChartTable; children: ReactNode; className?: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card
      className={className}
      title={
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink/50">{subtitle}</p>}
        </div>
      }
      actions={
        <>
          {actions}
          {table && table.rows.length > 0 && (
            <button
              type="button"
              onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-ink/50 hover:bg-black/5 hover:text-ink"
              aria-pressed={view === "table"}
              aria-label={view === "chart" ? `Show ${title} as a table` : `Show ${title} as a chart`}
            >
              {view === "chart" ? <Table2 size={13} /> : <BarChart3 size={13} />}
              {view === "chart" ? "Table" : "Chart"}
            </button>
          )}
        </>
      }
    >
      {view === "table" && table ? <MiniTable table={table} /> : children}
    </Card>
  );
}

function MiniTable({ table }: { table: ChartTable }) {
  const num = new Set(table.numeric ?? []);
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-ink/45">
            {table.headers.map((h, i) => (
              <th key={h} className={clsx("px-2 py-2 font-semibold", num.has(i) && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={ri} className="border-b border-black/[0.04] last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className={clsx("px-2 py-2", num.has(ci) && "text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TooltipBox({ title, lines }: { title: ReactNode; lines: { label: string; value: ReactNode; swatch?: string }[] }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-neu-lg ring-1 ring-black/5">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {lines.map((l) => (
        <p key={l.label} className="flex items-center justify-between gap-4 text-ink/60">
          <span className="flex items-center gap-1.5">
            {l.swatch && <span className="h-2 w-2 rounded-full" style={{ background: l.swatch }} />}
            {l.label}
          </span>
          <span className="font-semibold tabular-nums text-ink">{l.value}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sales trend (one measure at a time — never a dual axis)
// ---------------------------------------------------------------------------

export interface SalesPoint {
  date: string;
  revenue: number;
  orders: number;
}

export function SalesTrendChart({ data, monthly, metric }: { data: SalesPoint[]; monthly: boolean; metric: "revenue" | "orders" }) {
  const empty = data.every((d) => d.revenue === 0 && d.orders === 0);
  if (!data.length || empty) return <EmptyState title="No paid orders in this period" body="Sales will appear here once orders are paid." />;
  const tickFmt = (d: string) => (monthly ? monthFmt : dayFmt).format(parseDay(d));
  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]!.payload as SalesPoint;
    return (
      <TooltipBox
        title={(monthly ? longMonthFmt : longDayFmt).format(parseDay(p.date))}
        lines={[
          { label: "Revenue", value: money(p.revenue), swatch: metric === "revenue" ? CHART.accent : undefined },
          { label: "Paid orders", value: formatCount(p.orders), swatch: metric === "orders" ? CHART.accent : undefined },
        ]}
      />
    );
  };
  return (
    <div className="h-72 w-full" role="figure" aria-label={`${metric === "revenue" ? "Revenue" : "Paid orders"} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="salesWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.16} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="date" tickFormatter={tickFmt} tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={24} />
          <YAxis
            tickFormatter={(v: number) => (metric === "revenue" ? axisMoney(v) : formatCount(v))}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={metric === "revenue" ? 76 : 40}
            allowDecimals={false}
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: "rgba(17,17,17,0.18)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey={metric}
            name={metric === "revenue" ? "Revenue" : "Paid orders"}
            stroke={CHART.accent}
            strokeWidth={2}
            fill="url(#salesWash)"
            dot={false}
            activeDot={{ r: 4, fill: CHART.accent, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranked horizontal bars (top products, categories)
// ---------------------------------------------------------------------------

export interface RankedRow {
  name: string;
  revenue: number;
  quantity?: number;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function RankedBarChart({ data, color = CHART.ink, emptyTitle, label }: { data: RankedRow[]; color?: string; emptyTitle: string; label: string }) {
  if (!data.length) return <EmptyState title={emptyTitle} />;
  const height = Math.max(160, data.length * 34 + 32);
  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const r = payload[0]!.payload as RankedRow;
    return (
      <TooltipBox
        title={r.name}
        lines={[{ label: "Revenue", value: money(r.revenue), swatch: color }, ...(r.quantity != null ? [{ label: "Units sold", value: formatCount(r.quantity) }] : [])]}
      />
    );
  };
  return (
    <div className="w-full" style={{ height }} role="figure" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" tickFormatter={axisMoney} tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} />
          <YAxis type="category" dataKey="name" width={132} tick={{ ...axisTick, fill: CHART.inkSoft }} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncate(v, 20)} interval={0} />
          <Tooltip content={renderTooltip} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="revenue" name="Revenue" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share list: label · value · thin proportional bar (payment methods etc.)
// ---------------------------------------------------------------------------

export function ShareList({ rows, emptyTitle }: { rows: { key: string; label: string; value: number; display: ReactNode; detail?: ReactNode }[]; emptyTitle: string }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!rows.length || total === 0) return <EmptyState title={emptyTitle} />;
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => {
        const share = r.value / total;
        return (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{r.label}</span>
              <span className="shrink-0 tabular-nums">
                {r.display} <span className="text-xs text-ink/45">· {(share * 100).toFixed(share < 0.1 ? 1 : 0)}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]" aria-hidden>
              <div className="h-full rounded-full bg-ink/80" style={{ width: `${Math.max(2, share * 100)}%` }} />
            </div>
            {r.detail && <p className="mt-1 text-xs text-ink/45">{r.detail}</p>}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Stock health meter (status colours, always with icon + label)
// ---------------------------------------------------------------------------

export function StockHealthMeter({ healthy, low, out }: { healthy: number; low: number; out: number }) {
  const total = healthy + low + out;
  if (total === 0) return <EmptyState title="No active variants" />;
  const parts = [
    { key: "healthy", label: "In stock", value: healthy, color: CHART.success, Icon: CheckCircle2 },
    { key: "low", label: "Low stock", value: low, color: CHART.warning, Icon: AlertTriangle },
    { key: "out", label: "Out of stock", value: out, color: CHART.danger, Icon: XCircle },
  ];
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{
                width: `${(p.value / total) * 100}%`,
                minWidth: 4,
                // Amber sits close to both green and red for colour-blind readers: hatch it.
                background: p.key === "low" ? `repeating-linear-gradient(135deg, ${p.color} 0 5px, rgba(255,255,255,0.55) 5px 7px), ${p.color}` : p.color,
              }} title={`${p.label}: ${formatCount(p.value)}`} />
          ))}
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-2">
        {parts.map(({ key, label, value, color, Icon }) => (
          <li key={key} className="rounded-xl bg-offwhite px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-ink/55">
              <Icon size={13} style={{ color }} aria-hidden /> {label}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{formatCount(value)}</p>
            <p className="text-[11px] text-ink/45">{((value / total) * 100).toFixed(1)}% of variants</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
