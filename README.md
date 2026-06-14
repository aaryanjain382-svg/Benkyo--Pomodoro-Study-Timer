# Benkyo-Pomodoro Study Timer — Vercel edition

A focus timer deployed as **Vercel serverless functions + Turso** (libSQL, a
SQLite-compatible hosted database). The frontend is a single static file; the
API lives in `/api`; your settings and session history are stored in Turso, so
everything works on Vercel's serverless, read-only filesystem and syncs across
devices via a profile name.

## Project layout

```
.
├── index.html            Frontend (served at /). Calls /api/* and uses localStorage for the profile name.
├── api/
│   ├── state.js          GET    /api/state?user=NAME      -> { user, settings, stats }
│   ├── settings.js       PUT    /api/settings             -> { settings }
│   ├── sessions.js       POST   /api/sessions             -> { stats }
│   └── stats/reset.js    POST   /api/stats/reset          -> { stats }
├── lib/db.js             Turso/libSQL client + queries (async). Creates tables on first use.
├── package.json          Dependency: @libsql/client
└── .env.example          Required environment variables
```

`stats` has the shape `{ days: { "YYYY-MM-DD": { sessions, focus } }, totalSessions, totalFocus }`
(`focus` in seconds). The browser derives "today" and the 7-day chart from `days`
using its own local dates, so the display is correct regardless of server region.

## 1. Create a Turso database

Using the Turso CLI:

```bash
curl -sSfL https://get.tur.so/install.sh | bash   # install the CLI
turso auth signup                                  # or: turso auth login
turso db create benkyo
turso db show benkyo --url                          # -> your TURSO_DATABASE_URL
turso db tokens create benkyo                       # -> your TURSO_AUTH_TOKEN
```

(Or do the same from the Turso dashboard at turso.tech: create a database, copy
its URL, and create a token.) You don't need to create any tables — the app
creates them automatically on first request.

## 2. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New → Project → Import** the repo. Framework preset: **Other**
   (there's no build step). Vercel turns `/api/*.js` into functions and serves
   `index.html` at `/` automatically.
3. Before (or right after) the first deploy, add two **Environment Variables**
   under Project Settings → Environment Variables, for all environments:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. Deploy (or redeploy so the env vars take effect). You'll get a URL like
   `benkyo.vercel.app`.

CLI alternative:

```bash
npm i -g vercel
vercel link
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel --prod
```

## Running locally

```bash
npm install
npm i -g vercel
vercel dev          # serves index.html + /api together at http://localhost:3000
```

`vercel dev` reads env vars from a local `.env` (copy `.env.example` to `.env`
and fill it in, or run `vercel env pull`).

Quick data-layer check without Turso: set `TURSO_DATABASE_URL=file:dev.db` and
the libSQL client will use a local SQLite file instead.

## Notes

- **No login.** The profile name just identifies whose data is whose (default
  `me`, changeable in the settings panel). Use the same name on another device
  to sync. Turso auth tokens are scoped to the database, so keep them secret.
- If the timer shows **"Offline — changes won't save"**, the functions can't
  reach the database — almost always because `TURSO_DATABASE_URL` /
  `TURSO_AUTH_TOKEN` aren't set in Vercel (or you haven't redeployed since adding
  them). The timer itself keeps working regardless.
- Free-tier serverless functions can cold-start; the first request after idle is
  slightly slower, then fast.
