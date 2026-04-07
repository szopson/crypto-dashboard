import path from 'path';
import Database from 'better-sqlite3';
import {
  CREATE_CANDLES,
  CREATE_CANDLES_INDEX,
  CREATE_RADAR_SCORES,
  CREATE_RADAR_SCORES_INDEX,
  CREATE_TRADE_JOURNAL,
  CREATE_SESSIONS,
  CREATE_BRIEFINGS,
  CREATE_SETUPS,
  CREATE_SENTIMENT,
  CREATE_EVENTS,
  CREATE_TRADE_JOURNAL_V2,
} from './schema';

const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.resolve(process.cwd(), 'data', 'trading.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  // Ensure the data directory exists
  const dir = path.dirname(DB_PATH);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('fs').mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  runMigrations(_db);
  return _db;
}

function runMigrations(db: Database.Database): void {
  for (const stmt of [
    CREATE_CANDLES,
    CREATE_CANDLES_INDEX,
    CREATE_RADAR_SCORES,
    CREATE_RADAR_SCORES_INDEX,
    CREATE_TRADE_JOURNAL,
    CREATE_SESSIONS,
    CREATE_BRIEFINGS,
    CREATE_SETUPS,
    CREATE_SENTIMENT,
    CREATE_EVENTS,
    CREATE_TRADE_JOURNAL_V2,
  ]) {
    db.exec(stmt);
  }
}

// Allow running directly: npx tsx src/lib/db/migrate.ts
if (require.main === module) {
  const db = getDb();
  console.log(`Migration complete. Database at: ${DB_PATH}`);
  db.close();
}
