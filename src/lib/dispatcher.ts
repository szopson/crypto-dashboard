/**
 * Alert dispatcher — polls `alerts` for pending rows, sends to Telegram, marks sent.
 *
 * Run as a cron (every 30s):
 *   npm run alerts:dispatch
 *
 * Behavior per blueprint section 12.6:
 *   - Pulls up to 100 pending rows ordered by created_at ASC.
 *   - Skips rows whose channel has `enabled = 0` in alert_subscriptions.
 *   - Honors ticker_filter (JSON array stored as TEXT) on the subscription row.
 *   - Debounces 1h per (channel, ticker) — skip if the previous matching row
 *     was sent within the last hour. (The blueprint says per (user, channel,
 *     ticker); single-user MVP collapses user out.)
 *   - Marks `sent_at = unixepoch()` on success; leaves sent_at NULL on failure
 *     so the next run retries.
 */

import { getDb } from './db/migrate';
import { sendMessage, escapeMd } from './telegram';

interface AlertRow {
  id: number;
  channel: string;
  ticker: string | null;
  severity: string | null;
  payload: string;
  created_at: number;
}

interface SubscriptionRow {
  enabled: number;
  ticker_filter: string | null;
  min_severity: string | null;
}

const SEVERITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, VERY_HIGH: 4 };
const ONE_HOUR_SECONDS = 60 * 60;

function tickerAllowed(filter: string | null, ticker: string | null): boolean {
  if (!filter) return true;
  let parsed: unknown;
  try { parsed = JSON.parse(filter); } catch { return true; }
  if (!Array.isArray(parsed) || parsed.length === 0) return true;
  if (!ticker) return false;
  return (parsed as unknown[]).some(t => typeof t === 'string' && t.toUpperCase() === ticker.toUpperCase());
}

function severityAllowed(min: string | null, sev: string | null): boolean {
  if (!min) return true;
  const minRank = SEVERITY_RANK[min] ?? 0;
  const sevRank = sev ? (SEVERITY_RANK[sev] ?? 0) : 0;
  return sevRank >= minRank;
}

function formatAlert(alert: AlertRow): string {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(alert.payload) as Record<string, unknown>; } catch { /* ignore */ }

  const lines: string[] = [];
  const sev = alert.severity ?? 'MEDIUM';
  const ticker = alert.ticker ?? '—';
  const channel = alert.channel.replace(/_/g, ' ').toUpperCase();

  lines.push(`🚨 *${escapeMd(channel)} — ${escapeMd(ticker)}*`);
  lines.push(`Severity: *${escapeMd(sev)}*`);
  lines.push('─────────────');
  for (const [k, v] of Object.entries(payload)) {
    const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
    lines.push(`${escapeMd(k)}: \`${escapeMd(val)}\``);
  }
  return lines.join('\n');
}

export interface DispatchResult {
  scanned: number;
  sent: number;
  skipped_disabled: number;
  skipped_filter: number;
  skipped_debounce: number;
  failed: number;
}

export async function dispatchPendingAlerts(): Promise<DispatchResult> {
  const db = getDb();
  const result: DispatchResult = {
    scanned: 0, sent: 0, skipped_disabled: 0, skipped_filter: 0, skipped_debounce: 0, failed: 0,
  };

  const pending = db.prepare(`
    SELECT id, channel, ticker, severity, payload, created_at
    FROM alerts
    WHERE sent_at IS NULL
    ORDER BY created_at ASC
    LIMIT 100
  `).all() as AlertRow[];

  result.scanned = pending.length;
  if (pending.length === 0) return result;

  const subStmt = db.prepare(`
    SELECT enabled, ticker_filter, min_severity
    FROM alert_subscriptions
    WHERE channel = ?
  `);

  const debounceStmt = db.prepare(`
    SELECT 1
    FROM alerts
    WHERE channel = ?
      AND COALESCE(ticker, '') = COALESCE(?, '')
      AND sent_at IS NOT NULL
      AND sent_at >= ?
    LIMIT 1
  `);

  const markSent = db.prepare('UPDATE alerts SET sent_at = unixepoch() WHERE id = ?');

  for (const alert of pending) {
    const sub = subStmt.get(alert.channel) as SubscriptionRow | undefined;
    // No subscription row → treat as enabled with no filter (default-on for MVP).
    if (sub && !sub.enabled) { result.skipped_disabled++; continue; }
    if (sub && !tickerAllowed(sub.ticker_filter, alert.ticker)) { result.skipped_filter++; continue; }
    if (sub && !severityAllowed(sub.min_severity, alert.severity)) { result.skipped_filter++; continue; }

    const since = Math.floor(Date.now() / 1000) - ONE_HOUR_SECONDS;
    const debounced = debounceStmt.get(alert.channel, alert.ticker, since);
    if (debounced) { result.skipped_debounce++; continue; }

    try {
      const send = await sendMessage(formatAlert(alert));
      if (send.ok) {
        markSent.run(alert.id);
        result.sent++;
      } else {
        result.failed++;
        console.error(`[dispatcher] Telegram error for alert #${alert.id}: ${send.errorCode} ${send.description}`);
      }
    } catch (err) {
      result.failed++;
      console.error(`[dispatcher] send threw for alert #${alert.id}:`, err);
    }
  }

  return result;
}

// Allow `npx tsx src/lib/dispatcher.ts`
if (require.main === module) {
  dispatchPendingAlerts()
    .then(r => {
      console.log(JSON.stringify(r));
      process.exit(0);
    })
    .catch(err => {
      console.error('[dispatcher] fatal:', err);
      process.exit(1);
    });
}
