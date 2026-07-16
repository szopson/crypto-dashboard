"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const SUGGESTED_PROMPTS = [
  { label: "Market Bias", prompt: "What's the current market bias for BTC?" },
  { label: "Entry Setup", prompt: "Is there a good entry setup right now?" },
  { label: "Risk Analysis", prompt: "What are the key risks to watch?" },
  { label: "RADAR Explain", prompt: "Explain the current RADAR score" },
  { label: "Support/Resistance", prompt: "What are the key support and resistance levels?" },
  { label: "Trade Idea", prompt: "Generate a trade idea based on current conditions" },
];

export function CopilotChat() {
  const { session } = useAuth();
  const authHeaders = (): Record<string, string> =>
    session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          message: userMessage.content,
          include_market_data: true,
        }),
      });

      if (response.status === 401) {
        setError("Sign in to use the copilot.");
        return;
      }
      const data = await response.json();

      if (data.success && data.response) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setError(data.error || "Failed to get response");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analysis", { headers: authHeaders() });
      if (response.status === 401) {
        setError("Sign in to use the copilot.");
        return;
      }
      const data = await response.json();

      if (data.success && data.analysis) {
        const systemMessage: Message = {
          role: "assistant",
          content: data.analysis,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMessage]);
      } else {
        setError(data.error || "Failed to get analysis");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getBriefing = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/briefing", { headers: authHeaders() });
      if (response.status === 401) {
        setError("Sign in to use the copilot.");
        return;
      }
      const data = await response.json();

      if (data.success && data.briefing) {
        const systemMessage: Message = {
          role: "assistant",
          content: data.briefing,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMessage]);
      } else {
        setError(data.error || "Failed to get briefing");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    setShowSuggestions(false);
  };

  const clearChat = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Trading Copilot</CardTitle>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              Claude AI
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={getAnalysis}
            disabled={loading || !session}
          >
            Market Analysis
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={getBriefing}
            disabled={loading || !session}
          >
            Daily Briefing
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0">
        {/* Messages */}
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            {messages.length === 0 && showSuggestions && (
              <div className="py-4 space-y-4">
                <div className="text-center text-muted-foreground">
                  <p className="font-medium">Ask questions about the market</p>
                  <p className="text-xs mt-1">
                    Or try one of these quick prompts:
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTED_PROMPTS.map((item, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="h-auto py-2 px-3 text-left justify-start"
                      onClick={() => handleSuggestedPrompt(item.prompt)}
                    >
                      <span className="text-xs">{item.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  <div className="text-xs opacity-50 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce delay-100">.</span>
                    <span className="animate-bounce delay-200">.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Error */}
        {error && (
          <div className="text-sm text-destructive mb-2 p-2 bg-destructive/10 rounded">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 mt-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the market..."
            disabled={loading || !session}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
