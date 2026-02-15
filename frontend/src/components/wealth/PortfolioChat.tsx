"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { analytics } from "@/components/PostHogProvider";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface QuickAnalysis {
  available: boolean;
  overall_assessment?: string;
  risk_level?: string;
  risk_factors?: string[];
  strengths?: string[];
  concerns?: string[];
  suggestions?: string[];
  diversification_score?: number;
  message?: string;
}

interface PortfolioChatProps {
  portfolioId?: string;
}

export function PortfolioChat({ portfolioId }: PortfolioChatProps) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [quickAnalysis, setQuickAnalysis] = useState<QuickAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch quick analysis on mount
  useEffect(() => {
    if (session?.access_token) {
      fetchQuickAnalysis();
    }
  }, [session?.access_token, portfolioId]);

  const fetchQuickAnalysis = async () => {
    if (!session?.access_token) return;

    setAnalysisLoading(true);
    try {
      const url = portfolioId
        ? `/api/wealth/chat/quick-analysis?portfolio_id=${portfolioId}`
        : "/api/wealth/chat/quick-analysis";

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setQuickAnalysis(data);
      }
    } catch (error) {
      console.error("Failed to fetch quick analysis:", error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !session?.access_token) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    setStreaming(true);

    // Track AI chat message in PostHog
    analytics.trackAIChatSent(userMessage.length);

    try {
      const response = await fetch("/api/wealth/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          portfolio_id: portfolioId,
          conversation_history: messages.slice(-10),
          include_market_context: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      let assistantMessage = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage += parsed.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: "assistant",
                    content: assistantMessage,
                  };
                  return newMessages;
                });
              }
              if (parsed.error) {
                assistantMessage = parsed.error;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: "assistant",
                    content: assistantMessage,
                  };
                  return newMessages;
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "Is my portfolio well-diversified?",
    "What are the main risks in my portfolio?",
    "How can I reduce risk?",
    "What's the outlook for my holdings?",
  ];

  const getRiskLevelColor = (level?: string) => {
    switch (level) {
      case "LOW":
        return "text-green-500";
      case "MODERATE":
        return "text-yellow-500";
      case "HIGH":
        return "text-orange-500";
      case "VERY_HIGH":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Analysis Card */}
      {(quickAnalysis?.available || analysisLoading) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-xl">AI</span>
              Quick Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysisLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ) : quickAnalysis?.available ? (
              <div className="space-y-4">
                {/* Overall Assessment */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Assessment</p>
                  <p className="font-medium">{quickAnalysis.overall_assessment}</p>
                </div>

                {/* Risk Level */}
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Risk Level</p>
                    <p className={`font-bold ${getRiskLevelColor(quickAnalysis.risk_level)}`}>
                      {quickAnalysis.risk_level}
                    </p>
                  </div>
                  {quickAnalysis.diversification_score && (
                    <div>
                      <p className="text-sm text-muted-foreground">Diversification</p>
                      <p className="font-bold">{quickAnalysis.diversification_score}/10</p>
                    </div>
                  )}
                </div>

                {/* Strengths & Concerns */}
                <div className="grid grid-cols-2 gap-4">
                  {quickAnalysis.strengths && quickAnalysis.strengths.length > 0 && (
                    <div>
                      <p className="text-sm text-green-500 font-medium mb-1">Strengths</p>
                      <ul className="text-sm space-y-1">
                        {quickAnalysis.strengths.slice(0, 3).map((s, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-green-500">+</span>
                            <span className="text-muted-foreground">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {quickAnalysis.concerns && quickAnalysis.concerns.length > 0 && (
                    <div>
                      <p className="text-sm text-yellow-500 font-medium mb-1">Concerns</p>
                      <ul className="text-sm space-y-1">
                        {quickAnalysis.concerns.slice(0, 3).map((c, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-yellow-500">!</span>
                            <span className="text-muted-foreground">{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{quickAnalysis?.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chat Card */}
      <Card className="flex flex-col h-[500px]">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-xl">AI</span>
            Portfolio Advisor
            <span className="text-xs text-muted-foreground font-normal">(Powered by Llama 3.3)</span>
          </CardTitle>
        </CardHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-muted-foreground mb-4">
                Ask me anything about your portfolio!
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedQuestions.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {streaming && i === messages.length - 1 && msg.role === "assistant" && (
                      <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your portfolio..."
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()}>
              {loading ? "..." : "Send"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            This is educational information, not financial advice. Consult a professional for investment decisions.
          </p>
        </div>
      </Card>
    </div>
  );
}
