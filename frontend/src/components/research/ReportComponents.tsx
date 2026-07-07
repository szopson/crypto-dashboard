/**
 * Visual components for equity research reports rendered from MDX.
 *
 * These component names match the JSX tags emitted by the Python MDX renderer
 * (engine/report/equity/mdx_renderer.py) and must remain in sync.
 */
import { type ReactNode } from "react";
import { YouTubeEmbed } from "./YouTubeEmbed";
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Calendar,
  Database,
  Activity,
  CircleDollarSign,
  Building2,
} from "lucide-react";

/* ──────────── Helpers ──────────── */

/**
 * Parse a prop that may be either a parsed object (preferred, when MDX
 * inline evaluation works) or a JSON string (fallback, what the Python
 * renderer emits for portability across MDX parsers). Returns a typed
 * fallback if parsing fails.
 */
function parseProp<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v !== "string") return v as T;
  if (v.length === 0) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** Parse a numeric prop that may arrive as a string (from plain HTML attribute) or as a number. */
function parseNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    if (v.length === 0) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmtMoney(n: number | null | undefined, currency = "USD"): string {
  if (n == null) return "n/a";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
  void currency;
}

function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return "n/a";
  const v = Math.abs(n) <= 1 ? n * 100 : n;
  return `${v.toFixed(decimals)}%`;
}

const ratingColor: Record<string, string> = {
  BUY: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  ACCUMULATE:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  HOLD: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  REDUCE: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  SELL: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

const verdictColor: Record<string, string> = {
  Strong: "text-emerald-600 dark:text-emerald-400",
  Mixed: "text-amber-600 dark:text-amber-400",
  Weak: "text-rose-600 dark:text-rose-400",
  Low: "text-emerald-600 dark:text-emerald-400",
  Moderate: "text-amber-600 dark:text-amber-400",
  High: "text-rose-600 dark:text-rose-400",
  Cheap: "text-emerald-600 dark:text-emerald-400",
  Fair: "text-amber-600 dark:text-amber-400",
  Expensive: "text-rose-600 dark:text-rose-400",
  Accretive: "text-emerald-600 dark:text-emerald-400",
  Neutral: "text-zinc-600 dark:text-zinc-400",
  Dilutive: "text-rose-600 dark:text-rose-400",
};

function verdictClass(v: string | undefined): string {
  if (!v) return "text-zinc-700 dark:text-zinc-300";
  for (const key of Object.keys(verdictColor)) {
    if (v.toLowerCase().startsWith(key.toLowerCase())) return verdictColor[key];
  }
  return "text-zinc-700 dark:text-zinc-300";
}

/* ──────────── ReportHeader ──────────── */

export function ReportHeader({
  ticker,
  company,
  sector,
  industry,
  rating,
  targetPrice,
  upsidePct,
  horizon,
}: {
  ticker: string;
  company: string;
  sector?: string;
  industry?: string;
  rating: string;
  targetPrice: number | string | null;
  upsidePct: number | string | null;
  horizon?: string;
}) {
  const tp = parseNum(targetPrice);
  const up = parseNum(upsidePct);
  const upsideUp = (up ?? 0) >= 0;
  return (
    <div className="not-prose mb-8 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <Building2 className="h-4 w-4" />
        <span>{sector}</span>
        {industry && <span className="text-zinc-400">·</span>}
        {industry && <span>{industry}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{ticker}</h1>
        <span className="text-xl text-zinc-600 dark:text-zinc-400">{company}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          label="Rating"
          value={
            <span
              className={`inline-flex rounded-md border px-2 py-1 text-sm font-medium ${
                ratingColor[rating] ?? "border-zinc-300 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {rating}
            </span>
          }
        />
        <Stat label="Target Price" value={fmtMoney(tp)} />
        <Stat
          label="Upside"
          value={
            <span className={upsideUp ? "text-emerald-600" : "text-rose-600"}>
              {up != null ? `${up >= 0 ? "+" : ""}${up.toFixed(1)}%` : "n/a"}
            </span>
          }
        />
        <Stat label="Horizon" value={horizon ?? "n/a"} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-medium">{value}</div>
    </div>
  );
}

/* ──────────── Scoreboard ──────────── */

interface ScoreboardData {
  last_close: number | null;
  previous_close: number | null;
  target_price: number | null;
  market_cap: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  currency?: string;
}

export function Scoreboard({ data }: { data: ScoreboardData | string }) {
  const d = parseProp<ScoreboardData>(data, {} as ScoreboardData);
  const delta =
    d.last_close && d.previous_close
      ? ((d.last_close - d.previous_close) / d.previous_close) * 100
      : null;
  return (
    <div className="not-prose grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card title="Last Close" value={fmtMoney(d.last_close)} sub={delta != null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% d/d` : null} subTone={delta != null ? (delta >= 0 ? "pos" : "neg") : "mute"} />
      <Card title="Target" value={fmtMoney(d.target_price)} />
      <Card title="Market Cap" value={fmtMoney(d.market_cap)} />
      <Card
        title="52-Week Range"
        value={`${fmtMoney(d.fifty_two_week_low)} – ${fmtMoney(d.fifty_two_week_high)}`}
        small
      />
    </div>
  );
}

function Card({
  title,
  value,
  sub,
  subTone,
  small,
}: {
  title: string;
  value: ReactNode;
  sub?: string | null;
  subTone?: "pos" | "neg" | "mute";
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </div>
      <div className={`mt-1 font-semibold ${small ? "text-base" : "text-xl"}`}>{value}</div>
      {sub && (
        <div
          className={`mt-0.5 text-xs ${
            subTone === "pos"
              ? "text-emerald-600"
              : subTone === "neg"
                ? "text-rose-600"
                : "text-zinc-500"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/* ──────────── QoQGrid ──────────── */

interface QoQItem {
  label: string;
  text: string;
}

export function QoQGrid({ items }: { items: QoQItem[] | string }) {
  const list = parseProp<QoQItem[]>(items, []);
  return (
    <div className="not-prose grid grid-cols-1 gap-3 md:grid-cols-2">
      {list.map((it, i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {it.label}
          </div>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {it.text}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ──────────── OwnershipGrid ──────────── */

interface OwnershipData {
  institutional_pct: number | null;
  insider_pct: number | null;
  short_pct: number | null;
  dark_pool: number | string | null;
}

export function OwnershipGrid({ data }: { data: OwnershipData | string }) {
  const d = parseProp<OwnershipData>(data, {} as OwnershipData);
  return (
    <div className="not-prose grid grid-cols-2 gap-3 md:grid-cols-4">
      <Donut label="Institutional" pct={d.institutional_pct} tone="info" />
      <Donut label="Insider" pct={d.insider_pct} tone="info" />
      <Donut label="Short Interest" pct={d.short_pct} tone={
        (d.short_pct ?? 0) > 10 ? "warn" : "info"
      } />
      <Donut
        label="Dark Pool"
        pct={typeof d.dark_pool === "number" ? d.dark_pool : null}
        textOverride={
          typeof d.dark_pool === "string" ? d.dark_pool : null
        }
        tone={typeof d.dark_pool === "number" && d.dark_pool > 40 ? "warn" : "info"}
      />
    </div>
  );
}

function Donut({
  label,
  pct,
  textOverride,
  tone = "info",
}: {
  label: string;
  pct: number | null;
  textOverride?: string | null;
  tone?: "info" | "warn";
}) {
  const value = pct != null ? `${pct.toFixed(1)}%` : textOverride ?? "n/a";
  const ring =
    tone === "warn"
      ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
      : "border-sky-500/40 text-sky-700 dark:text-sky-300";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className={`mt-2 inline-flex items-center rounded-full border-2 px-3 py-1 text-xl font-semibold ${ring}`}>
        {value}
      </div>
    </div>
  );
}

/* ──────────── InsiderTransactions ──────────── */

interface InsiderRow {
  insider: string | null;
  position: string | null;
  transaction: string | null;
  shares: number | null;
  value: number | null;
  date: string | null;
}

export function InsiderTransactions({ rows }: { rows: InsiderRow[] | string }) {
  const list = parseProp<InsiderRow[]>(rows, []);
  if (!list || list.length === 0)
    return <p className="text-sm text-zinc-500">No recent insider transactions on file.</p>;
  return (
    <div className="not-prose overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Insider</th>
            <th className="px-3 py-2">Position</th>
            <th className="px-3 py-2 text-right">Shares</th>
            <th className="px-3 py-2 text-right">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {list.map((r, i) => (
            <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
              <td className="px-3 py-2 text-zinc-500">{r.date?.slice(0, 10)}</td>
              <td className="px-3 py-2 font-medium">{r.insider}</td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.position}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.shares != null ? r.shares.toLocaleString() : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────── SevenMetrics ──────────── */

interface SevenMetricsData {
  [key: string]: { verdict: string; notes: string };
}

const SEVEN_METRICS_LABELS: Record<string, { label: string; icon: ReactNode }> = {
  profitability: { label: "Profitability", icon: <TrendingUp className="h-4 w-4" /> },
  growth: { label: "Growth", icon: <Activity className="h-4 w-4" /> },
  cash_flow: { label: "Cash Flow", icon: <CircleDollarSign className="h-4 w-4" /> },
  leverage: { label: "Leverage", icon: <Briefcase className="h-4 w-4" /> },
  risk: { label: "Risk", icon: <AlertTriangle className="h-4 w-4" /> },
  valuation: { label: "Valuation", icon: <Database className="h-4 w-4" /> },
  shareholder: { label: "Shareholder", icon: <Building2 className="h-4 w-4" /> },
  income: { label: "Income", icon: <CircleDollarSign className="h-4 w-4" /> },
};

export function SevenMetrics({ data }: { data: SevenMetricsData | string }) {
  const d = parseProp<SevenMetricsData>(data, {} as SevenMetricsData);
  const keys = Object.keys(SEVEN_METRICS_LABELS).filter((k) => d[k]);
  return (
    <div className="not-prose grid grid-cols-2 gap-3 md:grid-cols-4">
      {keys.map((k) => {
        const v = d[k];
        const meta = SEVEN_METRICS_LABELS[k];
        return (
          <div
            key={k}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {meta.icon}
              {meta.label}
            </div>
            <div className={`mt-1 text-base font-semibold ${verdictClass(v.verdict)}`}>
              {v.verdict}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {v.notes}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────── PeerTable ──────────── */

interface PeerRow {
  ticker: string;
  name: string;
  ebitda_margin?: string;
  revenue_cagr_3y?: string;
  fcf_margin?: string;
  leverage?: string;
  fwd_pe?: string;
}

export function PeerTable({ rows }: { rows: PeerRow[] | string }) {
  const list = parseProp<PeerRow[]>(rows, []);
  return (
    <div className="not-prose overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">EBITDA Margin</th>
            <th className="px-3 py-2">3Y Rev CAGR</th>
            <th className="px-3 py-2">FCF Margin</th>
            <th className="px-3 py-2">Leverage</th>
            <th className="px-3 py-2">Fwd P/E</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {list.map((r) => (
            <tr key={r.ticker} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
              <td className="px-3 py-2">
                <div className="font-medium">{r.ticker}</div>
                <div className="text-xs text-zinc-500">{r.name}</div>
              </td>
              <td className="px-3 py-2 tabular-nums">{r.ebitda_margin}</td>
              <td className="px-3 py-2 tabular-nums">{r.revenue_cagr_3y}</td>
              <td className="px-3 py-2 tabular-nums">{r.fcf_margin}</td>
              <td className="px-3 py-2">{r.leverage}</td>
              <td className="px-3 py-2 tabular-nums">{r.fwd_pe}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────── BusinessFlash ──────────── */

interface BusinessFlashData {
  revenue_mix?: string;
  customers?: string;
  revenue_streams?: string;
  cost_drivers?: string;
  moat_commentary?: string;
}

export function BusinessFlash({ data }: { data: BusinessFlashData | string }) {
  const d = parseProp<BusinessFlashData>(data, {} as BusinessFlashData);
  const items = [
    { label: "Revenue Mix", text: d.revenue_mix },
    { label: "Customers", text: d.customers },
    { label: "Revenue Streams", text: d.revenue_streams },
    { label: "Cost Drivers", text: d.cost_drivers },
  ];
  return (
    <div className="not-prose grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((it) =>
        it.text ? (
          <div
            key={it.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {it.label}
            </div>
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {it.text}
            </p>
          </div>
        ) : null,
      )}
    </div>
  );
}

/* ──────────── RateScenario ──────────── */

interface RateScenarioData {
  scenario?: string;
  uplift_pct?: string;
  drivers?: string[];
  commentary?: string;
}

export function RateScenario({ data }: { data: RateScenarioData | string }) {
  const d = parseProp<RateScenarioData>(data, {} as RateScenarioData);
  return (
    <div className="not-prose rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Scenario</div>
          <div className="mt-1 text-2xl font-semibold">{d.scenario ?? "n/a"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Estimated intrinsic-value uplift
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {d.uplift_pct ?? "n/a"}
          </div>
        </div>
        <div className="md:col-span-1">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Drivers</div>
          <ul className="mt-2 space-y-1 text-sm">
            {(d.drivers ?? []).map((drv, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-500" />
                <span>{drv}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ──────────── SWOTGrid ──────────── */

interface SWOTData {
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  threats?: string[];
}

export function SWOTGrid({ data }: { data: SWOTData | string }) {
  const d = parseProp<SWOTData>(data, {} as SWOTData);
  const boxes: Array<{ title: string; items?: string[]; tone: string }> = [
    { title: "Strengths", items: d.strengths, tone: "emerald" },
    { title: "Weaknesses", items: d.weaknesses, tone: "rose" },
    { title: "Opportunities", items: d.opportunities, tone: "sky" },
    { title: "Threats", items: d.threats, tone: "amber" },
  ];
  const toneClass: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    sky: "border-sky-500/30 bg-sky-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
  };
  return (
    <div className="not-prose grid grid-cols-1 gap-3 md:grid-cols-2">
      {boxes.map((b) => (
        <div key={b.title} className={`rounded-xl border p-4 ${toneClass[b.tone]}`}>
          <div className="mb-2 text-sm font-semibold">{b.title}</div>
          <ul className="space-y-1.5 text-sm leading-relaxed">
            {(b.items ?? []).map((it, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-40" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ──────────── CatalystsTimeline ──────────── */

interface CatalystItem {
  // Equity report shape
  date?: string;
  title?: string;
  description?: string;
  // Sector brief shape
  event?: string;
  timing?: string;
  implication?: string;
}

export function CatalystsTimeline({ items }: { items: CatalystItem[] | string }) {
  const list = parseProp<CatalystItem[]>(items, []);
  return (
    <ol className="not-prose space-y-3">
      {list.map((c, i) => {
        const when = c.date ?? c.timing ?? "—";
        const title = c.title ?? c.event ?? "";
        const desc = c.description ?? c.implication ?? "";
        return (
          <li key={i} className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              {when}
            </div>
            <div>
              <div className="font-semibold">{title}</div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ──────────── PriceChart ──────────── */

interface PricePoint {
  date: string;
  close: number;
}

interface PriceChartMarkers {
  trend?: string;
  support?: number | null;
  resistance?: number | null;
}

export function PriceChart({
  series,
  markers,
}: {
  series: PricePoint[] | string;
  markers?: PriceChartMarkers | string;
}) {
  const data = parseProp<PricePoint[]>(series, []);
  const m = parseProp<PriceChartMarkers>(markers, {} as PriceChartMarkers);
  if (!data || data.length === 0) return null;
  const min = Math.min(...data.map((p) => p.close));
  const max = Math.max(...data.map((p) => p.close));
  return (
    <div className="not-prose rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">52-Week Price Action</div>
          {m?.trend && (
            <div className="mt-0.5 text-sm font-medium">{m.trend}</div>
          )}
        </div>
        <div className="flex gap-4 text-xs text-zinc-500">
          {m?.support != null && (
            <span>
              Support: <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmtMoney(m.support)}</span>
            </span>
          )}
          {m?.resistance != null && (
            <span>
              Resistance: <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmtMoney(m.resistance)}</span>
            </span>
          )}
        </div>
      </div>
      <Sparkline series={data} min={min} max={max} markers={m} />
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>{data[0]?.date}</span>
        <span>Low {fmtMoney(min)}</span>
        <span>High {fmtMoney(max)}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function Sparkline({
  series,
  min,
  max,
  markers,
}: {
  series: PricePoint[];
  min: number;
  max: number;
  markers?: PriceChartMarkers;
}) {
  const w = 800;
  const h = 160;
  const range = max - min || 1;
  const points = series.map((p, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((p.close - min) / range) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const polyline = points.join(" ");
  const supportY =
    markers?.support != null
      ? h - ((markers.support - min) / range) * h
      : null;
  const resistanceY =
    markers?.resistance != null
      ? h - ((markers.resistance - min) / range) * h
      : null;
  const lastY = series.length
    ? h - ((series[series.length - 1].close - min) / range) * h
    : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {resistanceY != null && (
        <line x1={0} x2={w} y1={resistanceY} y2={resistanceY} stroke="rgb(244 63 94 / 0.5)" strokeDasharray="4 4" />
      )}
      {supportY != null && (
        <line x1={0} x2={w} y1={supportY} y2={supportY} stroke="rgb(16 185 129 / 0.5)" strokeDasharray="4 4" />
      )}
      <polygon points={`0,${h} ${polyline} ${w},${h}`} fill="url(#sparkFill)" />
      <polyline fill="none" stroke="rgb(16 185 129)" strokeWidth="2" points={polyline} />
      {lastY != null && <circle cx={w} cy={lastY} r="4" fill="rgb(16 185 129)" />}
    </svg>
  );
}

/* ──────────── DataNote ──────────── */

export function DataNote({ source, fetched }: { source: string; fetched?: string }) {
  return (
    <p className="not-prose text-xs text-zinc-500">
      <Database className="mr-1 inline h-3 w-3" />
      Data source: {source}
      {fetched && <> · fetched {new Date(fetched).toLocaleString()}</>}
    </p>
  );
  void Minus;
  void TrendingDown;
}

/* ──────────── Earnings history (Finnhub) ──────────── */

interface EarningsRow {
  period?: string;
  quarter?: number;
  year?: number;
  actual_eps?: number | null;
  estimate_eps?: number | null;
  surprise?: number | null;
  surprise_pct?: number | null;
}

interface EarningsSummary {
  beat_rate?: number | null;
  avg_surprise_pct?: number | null;
  beat_count?: number | null;
  miss_count?: number | null;
}

export function EarningsHistory({
  rows,
  summary,
}: {
  rows: EarningsRow[] | string;
  summary?: EarningsSummary | string;
}) {
  const list = parseProp<EarningsRow[]>(rows, []);
  const s = parseProp<EarningsSummary>(summary, {} as EarningsSummary);
  if (!list || list.length === 0) return null;
  const ordered = [...list].sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""));

  return (
    <div className="not-prose space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Beat Rate" value={s.beat_rate != null ? `${(s.beat_rate * 100).toFixed(0)}%` : "—"} />
        <Card title="Avg Surprise" value={s.avg_surprise_pct != null ? `${s.avg_surprise_pct >= 0 ? "+" : ""}${s.avg_surprise_pct.toFixed(2)}%` : "—"} />
        <Card title="Beats" value={s.beat_count != null ? String(s.beat_count) : "—"} />
        <Card title="Misses" value={s.miss_count != null ? String(s.miss_count) : "—"} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60">
            <tr>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2 text-right">Actual EPS</th>
              <th className="px-3 py-2 text-right">Estimate</th>
              <th className="px-3 py-2 text-right">Surprise</th>
              <th className="px-3 py-2 text-right">Surprise %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {ordered.map((r, i) => {
              const surprise = r.surprise ?? 0;
              const beat = surprise > 0;
              return (
                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                  <td className="px-3 py-2 font-medium">{r.period} <span className="text-xs text-zinc-500">Q{r.quarter}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.actual_eps != null ? `$${r.actual_eps.toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{r.estimate_eps != null ? `$${r.estimate_eps.toFixed(2)}` : "—"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${beat ? "text-emerald-600" : surprise < 0 ? "text-rose-600" : ""}`}>
                    {r.surprise != null ? `${beat ? "+" : ""}$${r.surprise.toFixed(2)}` : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${beat ? "text-emerald-600" : surprise < 0 ? "text-rose-600" : ""}`}>
                    {r.surprise_pct != null ? `${beat ? "+" : ""}${r.surprise_pct.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────── Analyst ratings (Finnhub) ──────────── */

interface AnalystRow {
  period?: string;
  strong_buy?: number | null;
  buy?: number | null;
  hold?: number | null;
  sell?: number | null;
  strong_sell?: number | null;
}

export function AnalystRatings({ rows }: { rows: AnalystRow[] | string }) {
  const list = parseProp<AnalystRow[]>(rows, []);
  if (!list || list.length === 0) return null;
  const ordered = [...list].sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""));
  return (
    <div className="not-prose overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60">
          <tr>
            <th className="px-3 py-2">Month</th>
            <th className="px-3 py-2">Distribution</th>
            <th className="px-3 py-2 text-right">Strong Buy</th>
            <th className="px-3 py-2 text-right">Buy</th>
            <th className="px-3 py-2 text-right">Hold</th>
            <th className="px-3 py-2 text-right">Sell</th>
            <th className="px-3 py-2 text-right">Strong Sell</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {ordered.map((r, i) => {
            const sb = r.strong_buy ?? 0;
            const b = r.buy ?? 0;
            const h = r.hold ?? 0;
            const s = r.sell ?? 0;
            const ss = r.strong_sell ?? 0;
            const total = sb + b + h + s + ss || 1;
            return (
              <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                <td className="px-3 py-2 font-medium">{r.period?.slice(0, 7)}</td>
                <td className="px-3 py-2">
                  <div className="flex h-4 min-w-[180px] overflow-hidden rounded">
                    <div className="bg-emerald-600" style={{ width: `${(sb / total) * 100}%` }} title={`Strong Buy ${sb}`} />
                    <div className="bg-emerald-400" style={{ width: `${(b / total) * 100}%` }} title={`Buy ${b}`} />
                    <div className="bg-amber-400" style={{ width: `${(h / total) * 100}%` }} title={`Hold ${h}`} />
                    <div className="bg-rose-400" style={{ width: `${(s / total) * 100}%` }} title={`Sell ${s}`} />
                    <div className="bg-rose-600" style={{ width: `${(ss / total) * 100}%` }} title={`Strong Sell ${ss}`} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{sb}</td>
                <td className="px-3 py-2 text-right tabular-nums">{b}</td>
                <td className="px-3 py-2 text-right tabular-nums">{h}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s}</td>
                <td className="px-3 py-2 text-right tabular-nums">{ss}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────── Sector brief components ──────────── */

const stanceColor: Record<string, string> = {
  BULLISH: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  NEUTRAL: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  BEARISH: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  MIXED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

export function SectorBriefHeader({
  sectorName,
  headline,
  stance,
  memberCount,
}: {
  sectorName: string;
  headline: string;
  stance: string;
  memberCount: number | string;
}) {
  const mc = parseNum(memberCount) ?? 0;
  return (
    <div className="not-prose mb-8 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 p-6 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
        <span className="uppercase tracking-wide">Sector Brief</span>
        <span>·</span>
        <span>{mc} report{mc !== 1 ? "s" : ""} in coverage</span>
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{sectorName}</h2>
      <p className="mt-3 max-w-3xl text-lg text-zinc-700 dark:text-zinc-300">{headline}</p>
      <div className="mt-4">
        <span
          className={`inline-flex rounded-md border px-3 py-1 text-sm font-medium ${
            stanceColor[stance] ?? "border-zinc-300 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          Stance · {stance}
        </span>
      </div>
    </div>
  );
}

export function MacroSplit({
  tailwinds,
  headwinds,
}: {
  tailwinds: string[] | string;
  headwinds: string[] | string;
}) {
  const tws = parseProp<string[]>(tailwinds, []);
  const hws = parseProp<string[]>(headwinds, []);
  return (
    <div className="not-prose grid grid-cols-1 gap-3 md:grid-cols-2">
      <MacroBox title="Tailwinds" items={tws} tone="emerald" />
      <MacroBox title="Headwinds" items={hws} tone="rose" />
    </div>
  );
}

function MacroBox({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "rose" }) {
  const cls = tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5";
  return (
    <div className={`rounded-xl border p-5 ${cls}`}>
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <ul className="space-y-1.5 text-sm leading-relaxed">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-40" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SectorMember {
  ticker: string;
  company: string;
  rating?: string;
  target_price?: number | null;
  upside_pct?: number | null;
  one_liner?: string;
}

export function SectorRankings({ members }: { members: SectorMember[] | string }) {
  const list = parseProp<SectorMember[]>(members, []);
  if (!list || list.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No individual reports in this sector yet. Briefs run from general sector knowledge until coverage is populated.
      </p>
    );
  }
  // Sort by descending upside, with BUY/ACCUMULATE > HOLD > REDUCE/SELL
  const ratingOrder: Record<string, number> = { BUY: 0, ACCUMULATE: 1, HOLD: 2, REDUCE: 3, SELL: 4 };
  const sorted = [...list].sort((a, b) => {
    const ra = ratingOrder[a.rating ?? "HOLD"] ?? 2;
    const rb = ratingOrder[b.rating ?? "HOLD"] ?? 2;
    if (ra !== rb) return ra - rb;
    return (b.upside_pct ?? 0) - (a.upside_pct ?? 0);
  });
  return (
    <div className="not-prose overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60">
          <tr>
            <th className="px-3 py-2">Ticker</th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Rating</th>
            <th className="px-3 py-2 text-right">Target</th>
            <th className="px-3 py-2 text-right">Upside</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {sorted.map((r) => (
            <tr key={r.ticker} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
              <td className="px-3 py-2 font-mono font-medium">{r.ticker}</td>
              <td className="px-3 py-2">
                <div className="truncate">{r.company}</div>
                {r.one_liner && <div className="mt-0.5 text-xs text-zinc-500">{r.one_liner}</div>}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                    ratingColor[r.rating ?? ""] ?? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800"
                  }`}
                >
                  {r.rating ?? "—"}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.target_price)}</td>
              <td
                className={`px-3 py-2 text-right font-medium tabular-nums ${
                  (r.upside_pct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {r.upside_pct != null ? `${r.upside_pct >= 0 ? "+" : ""}${r.upside_pct.toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RiskList({ items }: { items: string[] | string }) {
  const list = parseProp<string[]>(items, []);
  return (
    <ul className="not-prose space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      {list.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/* ──────────── Export bundle for MDX runtime ──────────── */

/* ──────────── CryptoMarketContext ──────────── */

interface CryptoMarketData {
  price?: number | null;
  price_change_24h_pct?: number | null;
  oi_usd?: number | null;
  oi_change_24h_pct?: number | null;
  funding_pct_8h?: number | null;
  etf_flow_24h_usd?: number | null;
  etf_flow_7d_usd?: number | null;
  etf_flow_30d_usd?: number | null;
  regime?: string | null;
  signals?: string[];
}

/** Signed delta as "+1.2%" / "-3.4%", raw percent value (not ×100). */
function fmtDelta(n: number | null | undefined): string {
  if (n == null) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function CryptoMarketContext({ data }: { data: CryptoMarketData | string }) {
  const d = parseProp<CryptoMarketData>(data, {} as CryptoMarketData);
  const oiDelta = parseNum(d.oi_change_24h_pct);
  const pxDelta = parseNum(d.price_change_24h_pct);
  const funding = parseNum(d.funding_pct_8h);
  const etf7 = parseNum(d.etf_flow_7d_usd);
  const signals = Array.isArray(d.signals) ? d.signals : [];

  return (
    <div className="not-prose space-y-3">
      {d.regime && (
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-700 dark:text-orange-300">
          <CircleDollarSign className="h-3.5 w-3.5" />
          {d.regime}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card
          title="BTC Price"
          value={fmtMoney(parseNum(d.price))}
          sub={pxDelta != null ? `${fmtDelta(pxDelta)} 24h` : null}
          subTone={pxDelta != null ? (pxDelta >= 0 ? "pos" : "neg") : "mute"}
        />
        <Card
          title="BTC Open Interest"
          value={fmtMoney(parseNum(d.oi_usd))}
          sub={oiDelta != null ? `${fmtDelta(oiDelta)} 24h` : null}
          subTone={oiDelta != null ? (oiDelta >= 0 ? "pos" : "neg") : "mute"}
        />
        <Card
          title="Funding (8h)"
          value={funding != null ? `${funding.toFixed(4)}%` : "n/a"}
          sub={funding != null ? (funding >= 0 ? "longs pay" : "shorts pay") : null}
          subTone={funding != null ? (funding >= 0 ? "neg" : "pos") : "mute"}
        />
        <Card
          title="BTC ETF Flow 7d"
          value={fmtMoney(etf7)}
          sub={etf7 != null ? (etf7 >= 0 ? "net inflow" : "net outflow") : null}
          subTone={etf7 != null ? (etf7 >= 0 ? "pos" : "neg") : "mute"}
          small
        />
      </div>
      {signals.length > 0 && (
        <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          {signals.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const reportComponents = {
  ReportHeader,
  Scoreboard,
  QoQGrid,
  OwnershipGrid,
  InsiderTransactions,
  SevenMetrics,
  PeerTable,
  BusinessFlash,
  RateScenario,
  SWOTGrid,
  CatalystsTimeline,
  PriceChart,
  DataNote,
  SectorBriefHeader,
  MacroSplit,
  SectorRankings,
  RiskList,
  EarningsHistory,
  AnalystRatings,
  CryptoMarketContext,
  YouTube: YouTubeEmbed,
};
