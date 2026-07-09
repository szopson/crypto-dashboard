"use client";

/**
 * SetupChat — follow-up chat under a generated setup.
 *
 * Sends the whole conversation plus the client-held setup JSON to
 * /api/ai-setup/chat (Bearer auth) and streams the plain-text reply chunk by
 * chunk (the PortfolioChat reader pattern). The parent can pre-fill the input
 * via `prefill` (next-step chips).
 */
import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { SetupCoin, TradeSetup } from "@/lib/setup-schema";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SetupChatProps {
  coin: SetupCoin;
  setup: TradeSetup;
  /** Changing this pre-fills the input (next-step chip clicks). */
  prefill?: { text: string; nonce: number } | null;
}

export function SetupChat({ coin, setup, prefill }: SetupChatProps) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefill?.text) {
      setInput(prefill.text);
      inputRef.current?.focus();
    }
  }, [prefill]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const send = async () => {
    const question = input.trim();
    if (!question || streaming || !session?.access_token) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(history);
    setInput("");
    setStreaming(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-setup/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        // Server caps history depth; send the recent tail.
        body: JSON.stringify({ coin, setup, messages: history.slice(-12) }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setMessages(history.slice(0, -1));
        setInput(question);
        setError(data?.error ?? "Chat failed. Try again.");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const text = acc;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: text };
          return next;
        });
      }
    } catch {
      setError("Chat failed. Try again.");
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      {messages.length > 0 && (
        <div className="mb-3 max-h-80 space-y-3 overflow-y-auto pr-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-indigo-500/10 text-zinc-900 dark:text-zinc-100"
                    : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200"
                }`}
              >
                {msg.content}
                {streaming && i === messages.length - 1 && msg.role === "assistant" && (
                  <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {error && <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Ask about the ${coin} setup — "funding flipped?", "what changed?"`}
          disabled={streaming}
          maxLength={2000}
          className="flex-1 rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-600"
        />
        <button
          type="button"
          onClick={send}
          disabled={streaming || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors enabled:hover:bg-indigo-500 disabled:opacity-50"
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
