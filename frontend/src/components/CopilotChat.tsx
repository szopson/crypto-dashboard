"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function CopilotChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          include_market_data: true,
        }),
      });

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
      const response = await fetch("/api/analysis");
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
      const response = await fetch("/api/briefing");
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Trading Copilot</CardTitle>
          <Badge variant="outline" className="text-xs">
            Claude AI
          </Badge>
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={getAnalysis}
            disabled={loading}
          >
            Market Analysis
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={getBriefing}
            disabled={loading}
          >
            Daily Briefing
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0">
        {/* Messages */}
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p>Ask questions about the market or request analysis.</p>
                <p className="text-xs mt-2">
                  Try: "What's the current market bias?" or "Should I go long here?"
                </p>
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
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
