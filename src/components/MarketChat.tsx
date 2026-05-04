'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import PromptLibrary from './PromptLibrary';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
}

interface ImageData {
  data: string;
  mediaType: string;
}

function extractImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      const mediaType = header.match(/data:([^;]+)/)?.[1] ?? 'image/png';
      resolve({ data, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MarketChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your market analysis assistant. I have access to current RADAR scores, swing structure, order blocks, and S/R levels. Ask me anything about current market conditions or paste a chart for analysis.",
    },
  ]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<ImageData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertPrompt = useCallback((text: string) => {
    setInput(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const imgData = await extractImageData(file);
    setPendingImage(imgData);
    setImagePreview(`data:${imgData.mediaType};base64,${imgData.data}`);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) processImageFile(file);
      }
    },
    [processImageFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) processImageFile(file);
    },
    [processImageFile]
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && !pendingImage) return;
    if (isStreaming) return;

    const userMessage: Message = {
      role: 'user',
      content: text || 'Analyze this chart.',
      imagePreview: imagePreview ?? undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    const img = pendingImage;
    setPendingImage(null);
    setImagePreview(null);
    setIsStreaming(true);

    // Add placeholder for streaming response
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          ...(img && { image: img }),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Request failed';
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Error: ${errorMsg}`,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, messages, pendingImage, imagePreview, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col gap-3">
    <PromptLibrary onSelect={insertPrompt} />
    <div className="flex flex-col h-[600px] rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-700 text-zinc-300'
              }`}
            >
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-900/50 text-zinc-100'
                  : 'bg-zinc-800 text-zinc-200'
              }`}
            >
              {msg.imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={msg.imagePreview}
                  alt="chart"
                  className="rounded-lg mb-2 max-h-48 object-contain"
                />
              )}
              {msg.content ? (
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              ) : (
                <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="pending" className="h-12 rounded-lg object-contain" />
          <button
            onClick={() => { setPendingImage(null); setImagePreview(null); }}
            className="text-zinc-500 hover:text-zinc-300 text-xs"
          >
            ✕ Remove
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        className="border-t border-zinc-800 p-3 flex gap-2 items-end"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processImageFile(f);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
          title="Upload chart image"
        >
          📎
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask about market conditions… or paste a chart screenshot"
          rows={1}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
          style={{ maxHeight: 120, overflowY: 'auto' }}
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || (!input.trim() && !pendingImage)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex-shrink-0"
        >
          {isStreaming ? '…' : 'Send'}
        </button>
      </div>
    </div>
    </div>
  );
}
