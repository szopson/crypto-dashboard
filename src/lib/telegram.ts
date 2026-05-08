/**
 * Telegram Bot API client — minimal, fetch-based.
 *
 * Requires env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (default DM target).
 * Per-chat overrides supported via the `chatId` arg of `sendMessage`.
 */

const API_BASE = 'https://api.telegram.org';

export interface SendMessageOptions {
  chatId?: string | number;
  parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
  disableWebPagePreview?: boolean;
}

export interface SendMessageResult {
  ok: boolean;
  errorCode?: number;
  description?: string;
  messageId?: number;
}

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
  return token;
}

function defaultChatId(): string {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID not set (and no chatId override given)');
  return chatId;
}

export async function sendMessage(text: string, opts: SendMessageOptions = {}): Promise<SendMessageResult> {
  const token = getToken();
  const chatId = opts.chatId ?? defaultChatId();

  const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts.parseMode ?? 'MarkdownV2',
      disable_web_page_preview: opts.disableWebPagePreview ?? false,
    }),
  });

  const data = await res.json() as {
    ok: boolean;
    error_code?: number;
    description?: string;
    result?: { message_id: number };
  };

  return {
    ok: data.ok,
    errorCode: data.error_code,
    description: data.description,
    messageId: data.result?.message_id,
  };
}

/**
 * Escape MarkdownV2 reserved chars per https://core.telegram.org/bots/api#markdownv2-style.
 * Apply to interpolated values (prices, tickers); leave structural markdown untouched.
 */
export function escapeMd(s: string | number): string {
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}
