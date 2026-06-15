# gambatte

A single-user, self-hosted **time-tracking calendar**. It pulls your assigned,
in-progress cards from one Trello board and lets you drag them onto a Gantt-style
two-day grid to record *when* and *how long* each task was actually worked on.
Trello is a **read-only** source; all plotting data lives in a local Postgres DB.

With one click you can also **export the recorded time to a Google Spreadsheet**
(see [Google Sheets export](#google-sheets-export)).

## Stack

- **Next.js 16** (App Router) · **React 19** · **Tailwind v4**
- **Postgres** via **Drizzle ORM** (migrations with `drizzle-kit`)
- **TanStack Query** on the client
- **Vitest** for the pure scheduling logic (`lib/resolve`, `lib/time`, `lib/lanes`)

## Prerequisites

- Node 20+ and npm (local dev), or Docker Desktop (containerized).
- A Trello account with a personal API key + token.
- *(Optional, for export)* a Google Cloud project + service account.

## Configuration

Copy `.env.example` to `.env` and fill it in. All secrets are read **server-side
only** and never reach the browser.

```bash
cp .env.example .env
```

### Login gate (optional)

The app has **no user system**. To keep a deployment from being wide open, set a
single username/password in `.env`; [proxy.ts](proxy.ts) then redirects anyone
without a valid session to a `/login` page. A successful login mints a **signed,
HttpOnly cookie that lasts 7 days** (no database — the token is an HMAC, so it
can't be forged). A **Sign out** button appears in the nav when the gate is on.

| Variable | Purpose |
|---|---|
| `BASIC_AUTH_USER` | Login username |
| `BASIC_AUTH_PASSWORD` | Login password |
| `AUTH_SECRET` | *(optional)* signs the session cookie; defaults to the password |

Set **both** credentials to enable the gate; leave either blank to disable it
(e.g. local dev). Changing the password (or `AUTH_SECRET`) invalidates all
existing sessions.

### Trello (required)

| Variable | Purpose |
|---|---|
| `TRELLO_KEY` / `TRELLO_TOKEN` | Personal API key + token from <https://trello.com/power-ups/admin> |
| `TRELLO_BOARD_ID` | The board to read cards from |
| `TRELLO_LIST_IDS` | Comma-separated source lists (e.g. In-progress + For Review) |
| `TRELLO_MEMBER_ID` | Only cards assigned to this member are shown |

Set `TRELLO_KEY` + `TRELLO_TOKEN` first, start the app, then open
`GET /api/trello/meta` to list the board's list + member IDs and fill in the rest.

### Google Sheets export (optional)

| Variable | Purpose |
|---|---|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | The target spreadsheet's ID (from its URL) |
| `GOOGLE_SHEETS_TEMPLATE_TITLE` | Name of the template tab to duplicate (default `Template`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The service account's email |
| `GOOGLE_PRIVATE_KEY` | The service account's private key, single-line with literal `\n` |

One-time setup:

1. In Google Cloud: create a project → **enable the Google Sheets API** → create a
   **service account** → generate a **JSON key**.
2. **Share the spreadsheet** with the service-account email as **Editor**.
3. Create a tab named to match `GOOGLE_SHEETS_TEMPLATE_TITLE` (default `Template`)
   with the header row and column formats you want; the export duplicates it.
4. Put the four variables above in `.env`. Paste the key on one line, keeping the
   `\n` escapes (the app converts them to real newlines).

> The Google Sheets API and service accounts are **free** — Google meters them with
> rate quotas, not billing. The JSON key file itself is **not** used by the app and
> should not be committed (it's git-/docker-ignored); delete it after copying the
> key into `.env`, and rotate the key if it was ever exposed.

## Running

### Local (with Docker Postgres)

```bash
npm install
docker compose up -d db          # Postgres on :5432
npm run db:migrate               # apply Drizzle migrations
npm run dev                      # http://localhost:7431
```

### Fully containerized

```bash
# Production image (builds the standalone server, runs migrations, then the app):
docker compose up --build

# Dev with live reload (bind-mounted source):
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

The app is served on <http://localhost:7431>.

## Usage

- **Tasks** sidebar lists your assigned in-progress cards. Drag a card onto a day to
  record a time bar; drag edges to resize, drag the body to move (snaps to 30 min).
- **◀ / ▶** slide the two-day window; **Today** jumps back to now.
- **Settings** sets the day start/end bounds and the night/day theme.
- **Submit** opens the export dialog (see below).

### Google Sheets export

Click **Submit**, pick a **date range**, and confirm. The app:

- aggregates one row per card with time plotted in that range,
- writes **Task**, **Start Date**, **End Date**, **Actual Hours**, and a **Variance**
  formula into a **new tab named after the range** (e.g. `Jun 8 – Jun 14, 2026`),
  leaving Description / Estimated Hours / Note blank for you to fill in,
- **replaces** the tab if you re-run the exact same range; a different (even
  overlapping) range creates a separate tab. The template tab and other tabs are
  never modified.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Run the Vitest suites |
| `npm run db:generate` | Generate a migration from `db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |

## Project layout

- `app/` — App Router pages + API route handlers (`app/api/**`)
- `components/` — client UI (Scheduler, DayGrid, TaskBar, dialogs, …)
- `lib/` — pure logic + server helpers (`resolve`, `time`, `lanes`, `trello`,
  `sheets`, `store`, `env`)
- `db/` — Drizzle schema, client, and migrations
