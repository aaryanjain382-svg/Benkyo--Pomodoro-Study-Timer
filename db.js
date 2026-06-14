// lib/db.js — data layer backed by Turso (libSQL, SQLite-compatible).
// Works on Vercel serverless because the database lives remotely, not on disk.
// Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN as environment variables.
// (For local testing you can point TURSO_DATABASE_URL at a file, e.g. file:dev.db.)

import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const LIMITS = { focus: [1, 180], short: [1, 60], long: [1, 90], longEvery: [2, 8] };
const clampInt = (v, [lo, hi]) => Math.max(lo, Math.min(hi, parseInt(v, 10) || lo));
const bool = v => (v ? 1 : 0);

// Create tables on first use. CREATE ... IF NOT EXISTS is idempotent, and the
// promise is cached so it only runs once per cold start.
let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS settings (
          user       TEXT PRIMARY KEY,
          focus      INTEGER NOT NULL DEFAULT 25,
          short      INTEGER NOT NULL DEFAULT 5,
          long       INTEGER NOT NULL DEFAULT 15,
          longEvery  INTEGER NOT NULL DEFAULT 4,
          autoBreaks INTEGER NOT NULL DEFAULT 0,
          autoFocus  INTEGER NOT NULL DEFAULT 0,
          sound      INTEGER NOT NULL DEFAULT 1
        )`);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user       TEXT NOT NULL,
          mode       TEXT NOT NULL,
          seconds    INTEGER NOT NULL,
          day        TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`);
      await client.execute(
        `CREATE INDEX IF NOT EXISTS idx_sessions_user_day ON sessions(user, day)`);
    })();
  }
  return schemaReady;
}

function rowToSettings(r) {
  return {
    focus: Number(r.focus), short: Number(r.short), long: Number(r.long),
    longEvery: Number(r.longEvery),
    autoBreaks: !!Number(r.autoBreaks), autoFocus: !!Number(r.autoFocus), sound: !!Number(r.sound)
  };
}

export async function getSettings(user) {
  await ensureSchema();
  let r = await client.execute({ sql: 'SELECT * FROM settings WHERE user = ?', args: [user] });
  if (r.rows.length === 0) {
    await client.execute({ sql: 'INSERT INTO settings (user) VALUES (?)', args: [user] });
    r = await client.execute({ sql: 'SELECT * FROM settings WHERE user = ?', args: [user] });
  }
  return rowToSettings(r.rows[0]);
}

export async function saveSettings(user, s = {}) {
  await ensureSchema();
  const rows = (await client.execute({ sql: 'SELECT * FROM settings WHERE user = ?', args: [user] })).rows;
  const cur = rows[0] || {};
  const v = {
    focus:      clampInt(s.focus     ?? cur.focus     ?? 25, LIMITS.focus),
    short:      clampInt(s.short     ?? cur.short     ?? 5,  LIMITS.short),
    long:       clampInt(s.long      ?? cur.long      ?? 15, LIMITS.long),
    longEvery:  clampInt(s.longEvery ?? cur.longEvery ?? 4,  LIMITS.longEvery),
    autoBreaks: bool(s.autoBreaks ?? cur.autoBreaks),
    autoFocus:  bool(s.autoFocus  ?? cur.autoFocus),
    sound:      bool(s.sound      ?? cur.sound ?? 1),
  };
  await client.execute({
    sql: `INSERT INTO settings (user, focus, short, long, longEvery, autoBreaks, autoFocus, sound)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user) DO UPDATE SET
            focus=excluded.focus, short=excluded.short, long=excluded.long,
            longEvery=excluded.longEvery, autoBreaks=excluded.autoBreaks,
            autoFocus=excluded.autoFocus, sound=excluded.sound`,
    args: [user, v.focus, v.short, v.long, v.longEvery, v.autoBreaks, v.autoFocus, v.sound]
  });
  return rowToSettings(v);
}

export async function addSession(user, mode, seconds, day) {
  await ensureSchema();
  const d = (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))
    ? day : new Date().toISOString().slice(0, 10);
  await client.execute({
    sql: 'INSERT INTO sessions (user, mode, seconds, day, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [user, mode, Math.max(0, Math.round(seconds)), d, new Date().toISOString()]
  });
}

// { days: { 'YYYY-MM-DD': {sessions, focus} }, totalSessions, totalFocus }
export async function getStats(user) {
  await ensureSchema();
  const r = await client.execute({
    sql: `SELECT day, COUNT(*) AS c, COALESCE(SUM(seconds),0) AS s
          FROM sessions WHERE user = ? AND mode = ? GROUP BY day`,
    args: [user, 'focus']
  });
  const days = {};
  let totalSessions = 0, totalFocus = 0;
  for (const row of r.rows) {
    const c = Number(row.c), s = Number(row.s);
    days[row.day] = { sessions: c, focus: s };
    totalSessions += c;
    totalFocus += s;
  }
  return { days, totalSessions, totalFocus };
}

export async function resetStats(user) {
  await ensureSchema();
  await client.execute({ sql: 'DELETE FROM sessions WHERE user = ?', args: [user] });
}

// A profile name stands in for auth — it just identifies whose data is whose.
export const cleanUser = u =>
  (typeof u === 'string' && u.trim()) ? u.trim().slice(0, 40) : 'me';
