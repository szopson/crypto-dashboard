"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Use direct backend URL for long-running requests to avoid Next.js proxy timeout
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ANALYSIS_STEPS = [
  { id: 1, label: "Fetching token data", description: "Getting market data from CoinGecko..." },
  { id: 2, label: "Researching team", description: "Analyzing founders and team members..." },
  { id: 3, label: "Analyzing product", description: "Evaluating technology and development..." },
  { id: 4, label: "Competition analysis", description: "Mapping competitive landscape..." },
  { id: 5, label: "Community sentiment", description: "Analyzing social media and community..." },
  { id: 6, label: "Recent news", description: "Checking latest news and developments..." },
  { id: 7, label: "Generating report", description: "AI synthesizing investment thesis..." },
];

interface TeamAnalysis {
  founders_known: boolean;
  founders_doxxed: boolean;
  team_size: string | null;
  key_members: string[];
  previous_projects: string[];
  linkedin_profiles: boolean;
  experience_score: number;
  notes: string;
}

interface ProductAnalysis {
  status: string;
  has_working_product: boolean;
  github_activity: string;
  tech_stack: string[];
  unique_features: string[];
  audited: boolean;
  audit_firms: string[];
  product_score: number;
  notes: string;
}

interface MarketAnalysis {
  niche: string;
  niche_description: string;
  market_size: string;
  growth_potential: string;
  timing: string;
  target_audience: string;
  use_cases: string[];
  market_score: number;
  notes: string;
}

interface CompetitionAnalysis {
  main_competitors: { name: string; comparison: string }[];
  competitive_advantages: string[];
  competitive_disadvantages: string[];
  market_position: string;
  moat: string;
  competition_score: number;
  notes: string;
}

interface SentimentAnalysis {
  twitter_followers: number | null;
  twitter_engagement: string;
  discord_members: number | null;
  telegram_members: number | null;
  community_activity: string;
  recent_news_sentiment: string;
  influencer_mentions: string;
  controversy: boolean;
  controversy_details: string;
  sentiment_score: number;
  notes: string;
}

interface TokenomicsAnalysis {
  total_supply: string | null;
  circulating_supply: string | null;
  market_cap: string | null;
  fdv: string | null;
  token_utility: string[];
  vesting_schedule: string;
  team_allocation: string | null;
  investor_allocation: string | null;
  unlock_schedule: string;
  inflation_rate: string | null;
  tokenomics_score: number;
  notes: string;
}

interface RiskAnalysis {
  regulatory_risk: string;
  technical_risk: string;
  market_risk: string;
  team_risk: string;
  competition_risk: string;
  liquidity_risk: string;
  smart_contract_risk: string;
  key_risks: string[];
  risk_mitigations: string[];
  overall_risk: string;
  notes: string;
}

interface InvestmentRecommendation {
  recommendation: string;
  confidence: number;
  time_horizon: string;
  entry_strategy: string;
  position_size_suggestion: string;
  key_catalysts: string[];
  key_concerns: string[];
  price_targets: Record<string, string>;
  summary: string;
}

interface ProjectReport {
  ticker: string;
  name: string;
  website: string | null;
  analyzed_at: string;
  description: string;
  category: string;
  blockchain: string;
  launch_date: string | null;
  team: TeamAnalysis;
  product: ProductAnalysis;
  market: MarketAnalysis;
  competition: CompetitionAnalysis;
  sentiment: SentimentAnalysis;
  tokenomics: TokenomicsAnalysis;
  risk: RiskAnalysis;
  recommendation: InvestmentRecommendation;
  overall_score: number;
  research_sources: string[];
}

export function ProjectAnalyzer() {
  const [ticker, setTicker] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

  const analyzeProject = async () => {
    if (!ticker && !website) {
      setError("Please enter a ticker symbol or website URL");
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);
    setCurrentStep(1);
    setElapsedTime(0);

    // Start elapsed time counter
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    // Simulate step progression (backend takes 30-60 seconds)
    stepTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < ANALYSIS_STEPS.length) return prev + 1;
        return prev;
      });
    }, 7000); // Move to next step every ~7 seconds

    try {
      // Use direct backend URL to avoid Next.js proxy timeout (analysis takes 30-60s)
      const response = await fetch(`${API_BASE}/api/project/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker || null,
          website: website || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Analysis failed");
      }

      const data = await response.json();
      setReport(data);
      setCurrentStep(ANALYSIS_STEPS.length + 1); // Completed
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error analyzing project");
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "STRONG_BUY":
        return "bg-green-500 text-white";
      case "BUY":
        return "bg-lime-500 text-white";
      case "NEUTRAL":
        return "bg-yellow-500 text-black";
      case "AVOID":
        return "bg-orange-500 text-white";
      case "STRONG_AVOID":
        return "bg-red-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 30) return "text-orange-500";
    return "text-red-500";
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case "low":
        return "text-green-500";
      case "medium":
        return "text-yellow-500";
      case "high":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  const ScoreBar = ({ score, label }: { score: number; label: string }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={getScoreColor(score * 10)}>{score}/10</span>
      </div>
      <Progress value={score * 10} className="h-2" />
    </div>
  );

  const downloadPDF = async () => {
    if (!report) return;

    try {
      const response = await fetch(`${API_BASE}/api/project/report/${report.ticker}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${report.ticker}_analysis_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Failed to download PDF. Please try again.");
    }
  };

  const exportReport = () => {
    if (!report) return;

    const reportText = `
================================================================================
                    CRYPTO PROJECT INVESTMENT REPORT
================================================================================

PROJECT: ${report.name} (${report.ticker})
ANALYZED: ${new Date(report.analyzed_at).toLocaleString()}
CATEGORY: ${report.category || "N/A"}
BLOCKCHAIN: ${report.blockchain || "N/A"}

================================================================================
                           EXECUTIVE SUMMARY
================================================================================

RECOMMENDATION: ${report.recommendation.recommendation.replace("_", " ")}
OVERALL SCORE: ${report.overall_score}/100
CONFIDENCE: ${report.recommendation.confidence}%
RISK LEVEL: ${report.risk.overall_risk.toUpperCase()}
TIME HORIZON: ${report.recommendation.time_horizon || "N/A"}

${report.recommendation.summary}

================================================================================
                              SCORES
================================================================================

Team Experience:      ${report.team.experience_score}/10
Product Development:  ${report.product.product_score}/10
Market Opportunity:   ${report.market.market_score}/10
Competitive Position: ${report.competition.competition_score}/10
Community Sentiment:  ${report.sentiment.sentiment_score}/10
Tokenomics:          ${report.tokenomics.tokenomics_score}/10

================================================================================
                          TEAM ANALYSIS
================================================================================

Founders Known: ${report.team.founders_known ? "Yes" : "No"}
Founders Doxxed: ${report.team.founders_doxxed ? "Yes" : "No"}
Team Size: ${report.team.team_size || "Unknown"}
LinkedIn Profiles: ${report.team.linkedin_profiles ? "Yes" : "No"}

Key Members:
${report.team.key_members.length > 0 ? report.team.key_members.map(m => `  - ${m}`).join("\n") : "  N/A"}

Previous Projects:
${report.team.previous_projects.length > 0 ? report.team.previous_projects.map(p => `  - ${p}`).join("\n") : "  N/A"}

Notes: ${report.team.notes || "N/A"}

================================================================================
                         PRODUCT ANALYSIS
================================================================================

Status: ${report.product.status}
Working Product: ${report.product.has_working_product ? "Yes" : "No"}
GitHub Activity: ${report.product.github_activity}
Audited: ${report.product.audited ? "Yes" : "No"}
${report.product.audit_firms.length > 0 ? `Audit Firms: ${report.product.audit_firms.join(", ")}` : ""}

Unique Features:
${report.product.unique_features.length > 0 ? report.product.unique_features.map(f => `  - ${f}`).join("\n") : "  N/A"}

Tech Stack: ${report.product.tech_stack.join(", ") || "N/A"}

Notes: ${report.product.notes || "N/A"}

================================================================================
                         MARKET ANALYSIS
================================================================================

Niche: ${report.market.niche || "N/A"}
Market Size: ${report.market.market_size || "N/A"}
Growth Potential: ${report.market.growth_potential || "N/A"}
Market Timing: ${report.market.timing || "N/A"}

Use Cases:
${report.market.use_cases.length > 0 ? report.market.use_cases.map(u => `  - ${u}`).join("\n") : "  N/A"}

Notes: ${report.market.notes || "N/A"}

================================================================================
                       COMPETITION ANALYSIS
================================================================================

Market Position: ${report.competition.market_position || "N/A"}
Moat: ${report.competition.moat || "N/A"}

Main Competitors:
${report.competition.main_competitors.length > 0 ? report.competition.main_competitors.map(c => `  - ${c.name}: ${c.comparison}`).join("\n") : "  N/A"}

Competitive Advantages:
${report.competition.competitive_advantages.length > 0 ? report.competition.competitive_advantages.map(a => `  + ${a}`).join("\n") : "  N/A"}

Competitive Disadvantages:
${report.competition.competitive_disadvantages.length > 0 ? report.competition.competitive_disadvantages.map(d => `  - ${d}`).join("\n") : "  N/A"}

================================================================================
                          TOKENOMICS
================================================================================

Market Cap: ${report.tokenomics.market_cap || "N/A"}
FDV: ${report.tokenomics.fdv || "N/A"}
Circulating Supply: ${report.tokenomics.circulating_supply || "N/A"}
Total Supply: ${report.tokenomics.total_supply || "N/A"}
Team Allocation: ${report.tokenomics.team_allocation || "N/A"}
Investor Allocation: ${report.tokenomics.investor_allocation || "N/A"}

Token Utility:
${report.tokenomics.token_utility.length > 0 ? report.tokenomics.token_utility.map(u => `  - ${u}`).join("\n") : "  N/A"}

================================================================================
                         RISK ASSESSMENT
================================================================================

Overall Risk: ${report.risk.overall_risk.toUpperCase()}

Risk Breakdown:
  - Regulatory Risk: ${report.risk.regulatory_risk}
  - Technical Risk: ${report.risk.technical_risk}
  - Market Risk: ${report.risk.market_risk}
  - Team Risk: ${report.risk.team_risk}
  - Competition Risk: ${report.risk.competition_risk}
  - Liquidity Risk: ${report.risk.liquidity_risk}
  - Smart Contract Risk: ${report.risk.smart_contract_risk}

Key Risks:
${report.risk.key_risks.length > 0 ? report.risk.key_risks.map(r => `  ! ${r}`).join("\n") : "  None identified"}

Risk Mitigations:
${report.risk.risk_mitigations.length > 0 ? report.risk.risk_mitigations.map(m => `  + ${m}`).join("\n") : "  None identified"}

================================================================================
                       INVESTMENT SIGNALS
================================================================================

KEY CATALYSTS (BULLISH):
${report.recommendation.key_catalysts.length > 0 ? report.recommendation.key_catalysts.map(c => `  + ${c}`).join("\n") : "  None identified"}

KEY CONCERNS (BEARISH):
${report.recommendation.key_concerns.length > 0 ? report.recommendation.key_concerns.map(c => `  - ${c}`).join("\n") : "  None identified"}

================================================================================
                         COMMUNITY DATA
================================================================================

Twitter Followers: ${report.sentiment.twitter_followers?.toLocaleString() || "N/A"}
Telegram Members: ${report.sentiment.telegram_members?.toLocaleString() || "N/A"}
Discord Members: ${report.sentiment.discord_members?.toLocaleString() || "N/A"}
Community Activity: ${report.sentiment.community_activity}
Recent News Sentiment: ${report.sentiment.recent_news_sentiment}
${report.sentiment.controversy ? `CONTROVERSY ALERT: ${report.sentiment.controversy_details}` : ""}

================================================================================

Report generated by Follio
${new Date().toISOString()}

================================================================================
`.trim();

    // Create blob and download
    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.ticker}_analysis_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyReportToClipboard = () => {
    if (!report) return;

    const summary = `
📊 ${report.name} (${report.ticker}) Analysis

🎯 Recommendation: ${report.recommendation.recommendation.replace("_", " ")}
📈 Score: ${report.overall_score}/100
🔒 Confidence: ${report.recommendation.confidence}%
⚠️ Risk: ${report.risk.overall_risk}

${report.recommendation.summary}

✅ Catalysts:
${report.recommendation.key_catalysts.map(c => `• ${c}`).join("\n")}

❌ Concerns:
${report.recommendation.key_concerns.map(c => `• ${c}`).join("\n")}

Generated by Follio
`.trim();

    navigator.clipboard.writeText(summary);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crypto Project Analyzer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ticker">Ticker Symbol</Label>
                <Input
                  id="ticker"
                  placeholder="e.g., SOL, ETH, AVAX"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website URL (optional)</Label>
                <Input
                  id="website"
                  placeholder="e.g., https://solana.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={analyzeProject}
              disabled={loading || (!ticker && !website)}
              className="mt-4 w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">&#9696;</span>
                  Analyzing... ({formatTime(elapsedTime)})
                </span>
              ) : (
                "Analyze Project"
              )}
            </Button>

            {error && (
              <div className="mt-2 text-sm text-red-500">{error}</div>
            )}
          </CardContent>
        </Card>

        {/* Progress Indicator */}
        {loading && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Analysis Progress</span>
                  <span className="text-muted-foreground">
                    Step {Math.min(currentStep, ANALYSIS_STEPS.length)} of {ANALYSIS_STEPS.length}
                  </span>
                </div>
                <Progress
                  value={(currentStep / ANALYSIS_STEPS.length) * 100}
                  className="h-2"
                />
                <div className="space-y-2">
                  {ANALYSIS_STEPS.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        currentStep === step.id
                          ? "bg-primary/10 text-primary"
                          : currentStep > step.id
                          ? "text-muted-foreground"
                          : "text-muted-foreground/50"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          currentStep > step.id
                            ? "bg-green-500 text-white"
                            : currentStep === step.id
                            ? "bg-primary text-primary-foreground animate-pulse"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {currentStep > step.id ? "✓" : step.id}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{step.label}</div>
                        {currentStep === step.id && (
                          <div className="text-xs text-muted-foreground">
                            {step.description}
                          </div>
                        )}
                      </div>
                      {currentStep === step.id && (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Deep analysis requires multiple API calls. Please wait...
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report */}
        {report && (
          <>
            {/* Overview Card */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">
                      {report.name} ({report.ticker})
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {report.category || "Cryptocurrency"} • {report.blockchain || "N/A"}
                    </p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <Badge
                      className={`text-lg px-3 py-1 ${getRecommendationColor(
                        report.recommendation.recommendation
                      )}`}
                    >
                      {report.recommendation.recommendation.replace("_", " ")}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Confidence: {report.recommendation.confidence}%
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyReportToClipboard}
                        className="text-xs"
                      >
                        Copy Summary
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportReport}
                        className="text-xs"
                      >
                        Export TXT
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={downloadPDF}
                        className="text-xs"
                      >
                        Download PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div
                      className={`text-3xl font-bold ${getScoreColor(
                        report.overall_score
                      )}`}
                    >
                      {report.overall_score}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Overall Score
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-semibold ${getRiskColor(report.risk.overall_risk)}`}>
                      {report.risk.overall_risk.toUpperCase()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Risk Level
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold">
                      {report.tokenomics.market_cap || "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Market Cap
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold">
                      {report.recommendation.time_horizon || "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Time Horizon
                    </div>
                  </div>
                </div>

                {/* Summary */}
                {report.recommendation.summary && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm">{report.recommendation.summary}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detailed Analysis Tabs */}
            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue="scores" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
                    <TabsTrigger value="scores">Scores</TabsTrigger>
                    <TabsTrigger value="team">Team</TabsTrigger>
                    <TabsTrigger value="product">Product</TabsTrigger>
                    <TabsTrigger value="market">Market</TabsTrigger>
                    <TabsTrigger value="tokenomics">Tokenomics</TabsTrigger>
                    <TabsTrigger value="risks">Risks</TabsTrigger>
                    <TabsTrigger value="signals">Signals</TabsTrigger>
                  </TabsList>

                  {/* Scores Tab */}
                  <TabsContent value="scores" className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ScoreBar score={report.team.experience_score} label="Team Experience" />
                      <ScoreBar score={report.product.product_score} label="Product Development" />
                      <ScoreBar score={report.market.market_score} label="Market Opportunity" />
                      <ScoreBar score={report.competition.competition_score} label="Competitive Position" />
                      <ScoreBar score={report.sentiment.sentiment_score} label="Community Sentiment" />
                      <ScoreBar score={report.tokenomics.tokenomics_score} label="Tokenomics" />
                    </div>
                  </TabsContent>

                  {/* Team Tab */}
                  <TabsContent value="team" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="p-3 bg-muted/50 rounded-lg text-center">
                            <div className={report.team.founders_doxxed ? "text-green-500" : "text-red-500"}>
                              {report.team.founders_doxxed ? "Yes" : "No"}
                            </div>
                            <div className="text-xs text-muted-foreground">Founders Doxxed</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Public identities verified</TooltipContent>
                      </Tooltip>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div>{report.team.team_size || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">Team Size</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className={report.team.linkedin_profiles ? "text-green-500" : "text-muted-foreground"}>
                          {report.team.linkedin_profiles ? "Yes" : "No"}
                        </div>
                        <div className="text-xs text-muted-foreground">LinkedIn</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className={getScoreColor(report.team.experience_score * 10)}>
                          {report.team.experience_score}/10
                        </div>
                        <div className="text-xs text-muted-foreground">Experience</div>
                      </div>
                    </div>

                    {report.team.key_members.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Key Members</h4>
                        <div className="flex flex-wrap gap-2">
                          {report.team.key_members.map((member, i) => (
                            <Badge key={i} variant="secondary">{member}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {report.team.previous_projects.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Previous Projects</h4>
                        <div className="flex flex-wrap gap-2">
                          {report.team.previous_projects.map((project, i) => (
                            <Badge key={i} variant="outline">{project}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {report.team.notes && (
                      <p className="text-sm text-muted-foreground">{report.team.notes}</p>
                    )}
                  </TabsContent>

                  {/* Product Tab */}
                  <TabsContent value="product" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className="capitalize">{report.product.status}</div>
                        <div className="text-xs text-muted-foreground">Status</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className={report.product.has_working_product ? "text-green-500" : "text-red-500"}>
                          {report.product.has_working_product ? "Yes" : "No"}
                        </div>
                        <div className="text-xs text-muted-foreground">Working Product</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className="capitalize">{report.product.github_activity}</div>
                        <div className="text-xs text-muted-foreground">GitHub Activity</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className={report.product.audited ? "text-green-500" : "text-orange-500"}>
                          {report.product.audited ? "Yes" : "No"}
                        </div>
                        <div className="text-xs text-muted-foreground">Audited</div>
                      </div>
                    </div>

                    {report.product.unique_features.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Unique Features</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {report.product.unique_features.map((feature, i) => (
                            <li key={i}>{feature}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {report.product.tech_stack.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Tech Stack</h4>
                        <div className="flex flex-wrap gap-2">
                          {report.product.tech_stack.map((tech, i) => (
                            <Badge key={i} variant="outline">{tech}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {report.product.notes && (
                      <p className="text-sm text-muted-foreground">{report.product.notes}</p>
                    )}
                  </TabsContent>

                  {/* Market Tab */}
                  <TabsContent value="market" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="font-medium">{report.market.niche || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">Niche</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="capitalize">{report.market.growth_potential || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">Growth Potential</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="capitalize">{report.market.timing || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">Market Timing</div>
                      </div>
                    </div>

                    {report.market.use_cases.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Use Cases</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {report.market.use_cases.map((useCase, i) => (
                            <li key={i}>{useCase}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Competition */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-medium mb-2">Competition</h4>
                      <div className="text-sm text-muted-foreground mb-2">
                        Position: <span className="capitalize">{report.competition.market_position || "N/A"}</span>
                      </div>

                      {report.competition.competitive_advantages.length > 0 && (
                        <div className="mb-2">
                          <span className="text-green-500 text-sm font-medium">Advantages:</span>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {report.competition.competitive_advantages.map((adv, i) => (
                              <li key={i}>{adv}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {report.competition.competitive_disadvantages.length > 0 && (
                        <div>
                          <span className="text-red-500 text-sm font-medium">Disadvantages:</span>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {report.competition.competitive_disadvantages.map((dis, i) => (
                              <li key={i}>{dis}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Tokenomics Tab */}
                  <TabsContent value="tokenomics" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="font-medium">{report.tokenomics.market_cap || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">Market Cap</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="font-medium">{report.tokenomics.fdv || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">FDV</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="font-medium">{report.tokenomics.circulating_supply || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">Circulating</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="font-medium">{report.tokenomics.total_supply || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">Total Supply</div>
                      </div>
                    </div>

                    {(report.tokenomics.team_allocation || report.tokenomics.investor_allocation) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div>{report.tokenomics.team_allocation || "N/A"}</div>
                          <div className="text-xs text-muted-foreground">Team Allocation</div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div>{report.tokenomics.investor_allocation || "N/A"}</div>
                          <div className="text-xs text-muted-foreground">Investor Allocation</div>
                        </div>
                      </div>
                    )}

                    {report.tokenomics.token_utility.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Token Utility</h4>
                        <div className="flex flex-wrap gap-2">
                          {report.tokenomics.token_utility.map((util, i) => (
                            <Badge key={i} variant="secondary">{util}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {report.tokenomics.notes && (
                      <p className="text-sm text-muted-foreground">{report.tokenomics.notes}</p>
                    )}
                  </TabsContent>

                  {/* Risks Tab */}
                  <TabsContent value="risks" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className={getRiskColor(report.risk.regulatory_risk)}>
                          {report.risk.regulatory_risk.toUpperCase()}
                        </div>
                        <div className="text-xs text-muted-foreground">Regulatory</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className={getRiskColor(report.risk.technical_risk)}>
                          {report.risk.technical_risk.toUpperCase()}
                        </div>
                        <div className="text-xs text-muted-foreground">Technical</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className={getRiskColor(report.risk.team_risk)}>
                          {report.risk.team_risk.toUpperCase()}
                        </div>
                        <div className="text-xs text-muted-foreground">Team</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className={getRiskColor(report.risk.smart_contract_risk)}>
                          {report.risk.smart_contract_risk.toUpperCase()}
                        </div>
                        <div className="text-xs text-muted-foreground">Smart Contract</div>
                      </div>
                    </div>

                    {report.risk.key_risks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-500 mb-2">Key Risks</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {report.risk.key_risks.map((risk, i) => (
                            <li key={i}>{risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {report.risk.risk_mitigations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-500 mb-2">Risk Mitigations</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {report.risk.risk_mitigations.map((mit, i) => (
                            <li key={i}>{mit}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </TabsContent>

                  {/* Signals Tab */}
                  <TabsContent value="signals" className="space-y-4 mt-4">
                    {report.recommendation.key_catalysts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-500 mb-2">Key Catalysts (Bullish)</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {report.recommendation.key_catalysts.map((catalyst, i) => (
                            <li key={i}>{catalyst}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {report.recommendation.key_concerns.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-500 mb-2">Key Concerns (Bearish)</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {report.recommendation.key_concerns.map((concern, i) => (
                            <li key={i}>{concern}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Community Stats */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-2">Community</h4>
                      <div className="grid grid-cols-3 gap-4">
                        {report.sentiment.twitter_followers && (
                          <div className="p-3 bg-muted/50 rounded-lg text-center">
                            <div className="font-medium">
                              {(report.sentiment.twitter_followers / 1000).toFixed(1)}K
                            </div>
                            <div className="text-xs text-muted-foreground">Twitter</div>
                          </div>
                        )}
                        {report.sentiment.telegram_members && (
                          <div className="p-3 bg-muted/50 rounded-lg text-center">
                            <div className="font-medium">
                              {(report.sentiment.telegram_members / 1000).toFixed(1)}K
                            </div>
                            <div className="text-xs text-muted-foreground">Telegram</div>
                          </div>
                        )}
                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                          <div className="capitalize">{report.sentiment.community_activity}</div>
                          <div className="text-xs text-muted-foreground">Activity</div>
                        </div>
                      </div>
                    </div>

                    {report.sentiment.controversy && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <div className="text-sm font-medium text-red-500 mb-1">Controversy Alert</div>
                        <div className="text-sm text-muted-foreground">
                          {report.sentiment.controversy_details || "Issues detected"}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Sources */}
            {report.research_sources.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Research Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {report.research_sources.slice(0, 10).map((source, i) => (
                      <a
                        key={i}
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline truncate max-w-[200px]"
                      >
                        {source}
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
