'use client';

import { useState } from 'react';
import Header from '@/components/Header';

type PriceDirection = 'above' | 'below';
type MarketBelief = 'bullish' | 'bearish' | 'range_bound' | 'uncertain';
type TimeHorizon = 'weeks' | 'months' | 'years';
type ExtraCapital = 'yes' | 'no';

interface Answers {
  priceDirection: PriceDirection | null;
  marketBelief: MarketBelief | null;
  timeHorizon: TimeHorizon | null;
  extraCapital: ExtraCapital | null;
}

interface Recommendation {
  move: string;
  why: string;
  watchOut: string;
  ilImplication: string;
  alsoConsider: string;
  askYourself: string;
  borderColor: string;
}

function getRecommendation(answers: Required<Answers>): Recommendation {
  const { priceDirection, marketBelief, timeHorizon, extraCapital } = answers;

  // Bearish + short horizon → Exit & wait
  if (marketBelief === 'bearish' && timeHorizon === 'weeks') {
    return {
      move: 'Exit & Wait',
      why: 'With a bearish outlook and short time horizon, staying out of the position preserves capital while the market finds its footing. Re-entry at a better price often outweighs fees earned from a struggling position.',
      watchOut: 'Exit costs (gas + swap fees) can be significant. Ensure the expected downside exceeds the cost to exit.',
      ilImplication: 'Exiting locks in any impermanent loss already realized — but prevents further IL if the price continues against you.',
      alsoConsider: 'If bearish on only one asset, a single-sided hedge (e.g. short via perp) may be cheaper than a full exit.',
      askYourself: 'Is your bearish view token-specific or macro? A macro bear affects both assets in the pair.',
      borderColor: 'border-red-500',
    };
  }

  // Bullish + price out above + extra capital → Hedge / Delta Neutral
  if (marketBelief === 'bullish' && priceDirection === 'above' && extraCapital === 'yes') {
    return {
      move: 'Hedge / Delta Neutral',
      why: 'The price is above your range so you hold mostly the base asset. A bullish view with extra capital lets you go delta-neutral — borrow or short the quote to offset directional exposure and capture fees without taking a full directional bet.',
      watchOut: 'Delta-neutral positions require active rebalancing. Funding rates on perpetuals and borrowing costs can erode profits.',
      ilImplication: 'Hedging reduces the P&L impact of IL by offsetting the directional move, though it does not eliminate IL entirely.',
      alsoConsider: 'Rebalancing into a new in-range position is simpler; use hedging only if you have the infrastructure to monitor it.',
      askYourself: 'Do you have the time and tools to actively manage a hedge? If not, consider a simpler move.',
      borderColor: 'border-purple-500',
    };
  }

  // Uncertain / range-bound + no extra capital → Wait it out
  if ((marketBelief === 'uncertain' || marketBelief === 'range_bound') && extraCapital === 'no') {
    return {
      move: 'Wait It Out',
      why: 'When direction is unclear and you have no additional capital to deploy, the cost to move may not be worth it. Your position is still earning any available fees from the current tick, and patience is free.',
      watchOut: 'An out-of-range position earns zero fees. If price stays out-of-range for a long time, you are effectively holding a static token bag with no yield.',
      ilImplication: 'IL is frozen at the current level while price remains out of range. It will only change again if price re-enters your range.',
      alsoConsider: 'Set a price alert at your range boundaries so you can act quickly when the market moves back in.',
      askYourself: 'How long are you willing to hold an idle, non-earning position before you act?',
      borderColor: 'border-zinc-400',
    };
  }

  // Strong directional belief + extra capital → Rebalance
  if ((marketBelief === 'bullish' || marketBelief === 'bearish') && extraCapital === 'yes') {
    return {
      move: 'Rebalance',
      why: 'With a clear directional view and extra capital available, repositioning into a new in-range concentrated LP is the highest-conviction move. You earn fees again immediately and align your range with your market outlook.',
      watchOut: 'Frequent rebalancing costs gas and swap fees. Ensure the expected fee income from the new position outweighs rebalancing costs.',
      ilImplication: 'Rebalancing resets your cost basis, but any IL from the old position is realized on exit. The new position starts with fresh IL exposure.',
      alsoConsider: 'Consider a slightly wider range in the new position to reduce the frequency of future rebalances.',
      askYourself: 'Are you confident enough in your directional view to pay rebalancing costs now, or would a wider range be more prudent?',
      borderColor: 'border-blue-500',
    };
  }

  // Mild directional belief → Snuggle
  if ((marketBelief === 'bullish' || marketBelief === 'bearish') && extraCapital === 'no') {
    return {
      move: 'Snuggle',
      why: 'You have a directional view but no fresh capital. "Snuggling" means withdrawing your position and re-entering it just inside the current price, using only your existing assets. You stay close to the market to capture fees without needing extra funds.',
      watchOut: 'Re-entering near the current price means a narrow range, which exposes you to going out of range again quickly if price moves.',
      ilImplication: 'Snuggling near the current price maximizes IL sensitivity — any price move will be amplified compared to a wider range.',
      alsoConsider: 'If you are near a key support/resistance level, it may be worth waiting for a clearer breakout before snuggling in.',
      askYourself: 'Is the fee APR from a tight range worth the risk of quickly going out of range again?',
      borderColor: 'border-yellow-500',
    };
  }

  // Uncertain + long horizon + prefer passive → Widen the range
  if ((marketBelief === 'uncertain' || marketBelief === 'range_bound') && (timeHorizon === 'months' || timeHorizon === 'years')) {
    return {
      move: 'Widen the Range',
      why: 'With an uncertain outlook and a long time horizon, a wider range keeps you in-range more of the time with less maintenance. Lower fee concentration is a fair trade for staying passive and avoiding constant rebalancing.',
      watchOut: 'Wider ranges earn lower fee APR per dollar of liquidity. You are trading yield optimization for position longevity.',
      ilImplication: 'A wider range reduces the rate of IL accumulation per unit of price movement, making the position more resilient to volatility.',
      alsoConsider: 'For very long horizons, a full-range (v2-style) position or even a simple hold may be more appropriate.',
      askYourself: 'How much time do you realistically want to spend managing this position each month?',
      borderColor: 'border-green-500',
    };
  }

  // Default fallback → Widen the range
  return {
    move: 'Widen the Range',
    why: 'Given your inputs, a wider range is the most resilient approach. It keeps you earning fees across a broader price band with less need for active management.',
    watchOut: 'Wider ranges earn lower fee APR per dollar of liquidity compared to tight concentrated positions.',
    ilImplication: 'A wider range reduces the rate of IL accumulation per unit of price movement.',
    alsoConsider: 'Review your answers if this does not feel right — the recommendation changes significantly with market belief and capital availability.',
    askYourself: 'Does this recommendation match your current risk tolerance and time available?',
    borderColor: 'border-green-500',
  };
}

const STEPS = [
  {
    number: 1,
    question: 'Where is the price relative to your range?',
    field: 'priceDirection' as const,
    options: [
      { value: 'above' as PriceDirection, label: 'Out Above', sublabel: 'Price went up past range' },
      { value: 'below' as PriceDirection, label: 'Out Below', sublabel: 'Price dropped below range' },
    ],
  },
  {
    number: 2,
    question: 'What is your current market outlook?',
    field: 'marketBelief' as const,
    options: [
      { value: 'bullish' as MarketBelief, label: 'Bullish', sublabel: 'Expecting price to rise' },
      { value: 'bearish' as MarketBelief, label: 'Bearish', sublabel: 'Expecting price to fall' },
      { value: 'range_bound' as MarketBelief, label: 'Range-Bound', sublabel: 'Expecting sideways action' },
      { value: 'uncertain' as MarketBelief, label: 'Uncertain', sublabel: 'Not sure which way' },
    ],
  },
  {
    number: 3,
    question: 'What is your investment horizon?',
    field: 'timeHorizon' as const,
    options: [
      { value: 'weeks' as TimeHorizon, label: 'Weeks', sublabel: 'Short-term' },
      { value: 'months' as TimeHorizon, label: 'Months', sublabel: 'Medium-term' },
      { value: 'years' as TimeHorizon, label: 'Years', sublabel: 'Long-term' },
    ],
  },
  {
    number: 4,
    question: 'Do you have additional capital available to deploy?',
    field: 'extraCapital' as const,
    options: [
      { value: 'yes' as ExtraCapital, label: 'Yes', sublabel: 'I have more to put in' },
      { value: 'no' as ExtraCapital, label: 'No', sublabel: 'Working with existing assets only' },
    ],
  },
];

export default function LPPlaybookPage() {
  const [answers, setAnswers] = useState<Answers>({
    priceDirection: null,
    marketBelief: null,
    timeHorizon: null,
    extraCapital: null,
  });
  const [currentStep, setCurrentStep] = useState(0); // 0-indexed; 4 = result
  const [showResult, setShowResult] = useState(false);

  const step = STEPS[currentStep];
  const currentAnswer = step ? answers[step.field] : null;

  function selectOption(value: string) {
    if (!step) return;
    setAnswers((prev) => ({ ...prev, [step.field]: value }));
  }

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setShowResult(true);
    }
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  function handleStartOver() {
    setAnswers({ priceDirection: null, marketBelief: null, timeHorizon: null, extraCapital: null });
    setCurrentStep(0);
    setShowResult(false);
  }

  const recommendation =
    showResult && answers.priceDirection && answers.marketBelief && answers.timeHorizon && answers.extraCapital
      ? getRecommendation(answers as Required<Answers>)
      : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Header />

      <main className="flex-1 max-w-screen-md mx-auto w-full px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-white mb-3">LP Out-of-Range Playbook</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            When a Uniswap V3 concentrated liquidity position goes out of range, it stops earning fees
            and becomes fully composed of the underperforming asset. This wizard helps you decide on the
            best next move based on your market outlook, time horizon, and available capital.
          </p>
        </div>

        {!showResult ? (
          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-2">
              {STEPS.map((s, i) => (
                <div key={s.number} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                      i < currentStep
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : i === currentStep
                        ? 'border-blue-500 text-blue-400'
                        : 'border-zinc-700 text-zinc-600'
                    }`}
                  >
                    {i < currentStep ? '✓' : s.number}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px w-8 ${i < currentStep ? 'bg-blue-600' : 'bg-zinc-700'}`} />
                  )}
                </div>
              ))}
              <span className="ml-2 text-zinc-500 text-xs">Step {currentStep + 1} of {STEPS.length}</span>
            </div>

            {/* Question card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <p className="text-lg font-semibold text-white mb-5">{step.question}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {step.options.map((opt) => {
                  const selected = currentAnswer === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => selectOption(opt.value)}
                      className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                        selected
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'
                      }`}
                    >
                      <span className="font-medium block">{opt.label}</span>
                      <span className={`text-xs ${selected ? 'text-blue-200' : 'text-zinc-500'}`}>{opt.sublabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={!currentAnswer}
                className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {currentStep === STEPS.length - 1 ? 'See Recommendation' : 'Next'}
              </button>
            </div>
          </div>
        ) : recommendation ? (
          <div className="space-y-6">
            {/* Recommendation card */}
            <div className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden border-l-4 ${recommendation.borderColor}`}>
              <div className="p-6">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Recommended Move</p>
                <h3 className="text-3xl font-bold text-white mb-5">{recommendation.move}</h3>

                <dl className="space-y-4">
                  <div>
                    <dt className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Why this move</dt>
                    <dd className="text-sm text-zinc-300 leading-relaxed">{recommendation.why}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Watch out for</dt>
                    <dd className="text-sm text-zinc-300 leading-relaxed">{recommendation.watchOut}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">IL Implication</dt>
                    <dd className="text-sm text-zinc-300 leading-relaxed">{recommendation.ilImplication}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Also consider</dt>
                    <dd className="text-sm text-zinc-300 leading-relaxed">{recommendation.alsoConsider}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Ask yourself before executing</dt>
                    <dd className="text-sm text-zinc-300 leading-relaxed italic">&ldquo;{recommendation.askYourself}&rdquo;</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Your answers summary */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Your answers</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500">Price direction: </span>
                  <span className="text-zinc-300 capitalize">{answers.priceDirection === 'above' ? 'Out above' : 'Out below'}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Market belief: </span>
                  <span className="text-zinc-300 capitalize">{answers.marketBelief?.replace('_', '-')}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Time horizon: </span>
                  <span className="text-zinc-300 capitalize">{answers.timeHorizon}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Extra capital: </span>
                  <span className="text-zinc-300 capitalize">{answers.extraCapital}</span>
                </div>
              </div>
            </div>

            {/* IL calculator link */}
            <p className="text-xs text-zinc-500">
              Calculate your impermanent loss:{' '}
              <a
                href="https://www.defibuddy.io/il-calculator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                DeFi Buddy IL Calculator
              </a>
            </p>

            {/* Disclaimer */}
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
              <p className="text-xs text-zinc-500 leading-relaxed">
                <span className="font-semibold text-zinc-400">Educational only.</span> LP positions carry significant
                risks including impermanent loss, smart contract risk, and price volatility. Start with small amounts.
              </p>
            </div>

            {/* Start over */}
            <div className="flex justify-center">
              <button
                onClick={handleStartOver}
                className="px-5 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
