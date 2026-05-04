export interface ResearchPrompt {
  id: string;
  title: string;
  category: 'risk' | 'positioning' | 'macro' | 'income' | 'speculation' | 'sentiment';
  summary: string;
  prompt: string;
}

export const RESEARCH_PROMPTS: ResearchPrompt[] = [
  {
    id: 'portfolio-hedging',
    title: 'Portfolio Hedging Strategy',
    category: 'risk',
    summary: 'Design an efficient hedge for a sector/market exposure.',
    prompt:
      'My portfolio is exposed to [SECTOR/MARKET]. Using current options data and available inverse ETFs, design an efficient hedge: recommended instrument, hedge size (% of portfolio), annualized cost, scenario to activate it, and sources for volatility data.',
  },
  {
    id: 'institutional-positioning',
    title: 'Institutional Positioning Analysis',
    category: 'positioning',
    summary: 'Top 10 hedge funds — accumulation vs. distribution this quarter.',
    prompt:
      'Using recent 13F data (WhaleWisdom, Dataroma) and news, tell me which sectors/stocks the top 10 hedge funds are accumulating this quarter vs. the previous quarter. Present new entries, full exits, and increased positions, including the fund name and sources.',
  },
  {
    id: 'crisis-correlation',
    title: 'Crisis Correlation Map',
    category: 'macro',
    summary: 'Find unusual cross-asset correlations and trades to exploit them.',
    prompt:
      'In the current macro environment, search for assets showing unusual correlations (e.g., gold and equities rising together, or bonds and stocks falling simultaneously). Explain what each anomaly has historically signaled, include 3 trades that would benefit from normalization, and provide sources.',
  },
  {
    id: 'dividend-danger',
    title: 'Dividend Danger Radar',
    category: 'income',
    summary: 'High-yield names with cut risk + safer alternatives.',
    prompt:
      'Search for 5 companies with an apparently attractive dividend yield (>5%) but with warning signs (high payout ratio, negative free cash flow, rising debt). For each one include: ticker, current yield, probability of a cut, safer alternatives in the same sector, and sources.',
  },
  {
    id: 'short-squeeze',
    title: 'Short Squeeze Screener',
    category: 'speculation',
    summary: 'High short interest + catalyst + entry plan.',
    prompt:
      'Using web data (Finviz, Shortquote, news), find 5 stocks with high short interest (>20% of float), elevated borrow rate, and an upcoming catalyst. For each ticker include: % short float, days to cover, catalyst, entry strategy, risk of a failed squeeze, and sources.',
  },
  {
    id: 'top-down-macro',
    title: 'Top-Down Macro Analysis',
    category: 'macro',
    summary: 'Current macro regime → sectors that historically outperform.',
    prompt:
      'Search the web (Fed, ECB, latest macro data) for the current macroeconomic context: inflation, interest rates, GDP, employment. Tell me which sectors/assets historically outperform in this exact environment, with 3 comparable historical examples, expected timeframe, and 3 sources.',
  },
  {
    id: 'sentiment-arbitrage',
    title: 'Sentiment vs. Fundamentals Arbitrage',
    category: 'sentiment',
    summary: 'Bearish narrative meets strong fundamentals — 6 ideas.',
    prompt:
      'Search for stocks where market sentiment (negative news, bearish social media tone) clearly diverges from strong underlying fundamentals. Return 6 ideas including: ticker, reason for negative sentiment, why the fundamentals contradict that narrative, technical entry level, and sources.',
  },
];

export const PROMPT_CATEGORY_LABEL: Record<ResearchPrompt['category'], string> = {
  risk: 'Risk',
  positioning: 'Positioning',
  macro: 'Macro',
  income: 'Income',
  speculation: 'Speculation',
  sentiment: 'Sentiment',
};
