/**
 * SetupCard — presentational renderer for a structured AI trade setup.
 *
 * Pure display: takes a TradeSetup (generated server-side against
 * TradeSetupSchema) and renders the TL;DR strip, signal table, catalysts,
 * story, key-levels table, bottom line and next-step chips. Used both for
 * live setups (SetupPanel) and the blurred logged-out demo (SetupDemo).
 */
import type { Bias, TradeSetup } from "@/lib/setup-schema";

const BIAS_BADGE: Record<Bias, string> = {
  bullish:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  bearish: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  neutral: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  elevated: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

function BiasBadge({ bias }: { bias: Bias }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BIAS_BADGE[bias]}`}
    >
      {bias}
    </span>
  );
}

interface SetupCardProps {
  setup: TradeSetup;
  /** Pre-fills the chat input with the corresponding next-step question. */
  onNextStepClick?: (question: string) => void;
}

export function SetupCard({ setup, onNextStepClick }: SetupCardProps) {
  const chips: { label: string; text: string }[] = [
    { label: "Derivatives", text: setup.nextSteps.derivatives },
    { label: "Technical", text: setup.nextSteps.technical },
    { label: "Setup", text: setup.nextSteps.setup },
  ];

  return (
    <div className="space-y-4">
      {/* TL;DR */}
      <div className="flex items-start gap-2">
        <BiasBadge bias={setup.bias} />
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{setup.tldr}</p>
      </div>
      <div className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
        <p>
          <span className="font-semibold">Price:</span> {setup.priceLine}
        </p>
        <p>
          <span className="font-semibold">Watch:</span> {setup.watchLine}
        </p>
      </div>

      {/* Signals */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <th className="px-3 py-2 font-semibold uppercase tracking-wide">Signal</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wide">Value</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wide">Read</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wide">Bias</th>
            </tr>
          </thead>
          <tbody>
            {setup.signals.map((s) => (
              <tr
                key={s.name}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
              >
                <td className="whitespace-nowrap px-3 py-2 align-top font-medium text-zinc-900 dark:text-zinc-100">
                  {s.name}
                </td>
                {/* No nowrap here: long values (e.g. liq-imbalance summaries)
                    otherwise blow the table out to thousands of px, pushing
                    Read/Bias off-screen and word-wrapping Read one word per
                    line (the "giant empty rows" bug). */}
                <td className="min-w-[12rem] px-3 py-2 align-top tabular-nums text-zinc-700 dark:text-zinc-300">
                  {s.value}
                </td>
                <td className="min-w-[14rem] px-3 py-2 align-top text-zinc-600 dark:text-zinc-400">{s.read}</td>
                <td className="px-3 py-2">
                  <BiasBadge bias={s.bias} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Catalysts */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Key catalysts
        </p>
        <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          {setup.catalysts.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-zinc-400">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Story */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Story</p>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{setup.story}</p>
      </div>

      {/* Key levels */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Key levels
        </p>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <th className="px-3 py-2 font-semibold uppercase tracking-wide">Level</th>
                <th className="px-3 py-2 font-semibold uppercase tracking-wide">Type</th>
                <th className="px-3 py-2 font-semibold uppercase tracking-wide">Note</th>
              </tr>
            </thead>
            <tbody>
              {setup.keyLevels.map((l, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {l.level}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    {l.type}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom line */}
      <div className="rounded-lg border-l-4 border-indigo-400 bg-indigo-50/60 p-3 dark:border-indigo-600 dark:bg-indigo-950/20">
        <p className="text-sm text-zinc-800 dark:text-zinc-200">
          <span className="font-semibold">Bottom line:</span> {setup.bottomLine}
        </p>
      </div>

      {/* Next steps */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Next steps
        </p>
        <div className="space-y-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onNextStepClick?.(chip.text)}
              disabled={!onNextStepClick}
              className="flex w-full items-start gap-2 rounded-lg border border-zinc-200 p-2.5 text-left transition-colors enabled:hover:border-indigo-300 enabled:hover:bg-indigo-50/50 dark:border-zinc-800 dark:enabled:hover:border-indigo-800 dark:enabled:hover:bg-indigo-950/20"
            >
              <span className="mt-0.5 shrink-0 rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                {chip.label}
              </span>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{chip.text}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
        Liquidation figures are estimates, not exchange-reported. Educational information, not
        financial advice.
      </p>
    </div>
  );
}
