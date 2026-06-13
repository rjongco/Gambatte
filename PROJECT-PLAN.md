# Trello Time-Plotting Calendar — Implementation Plan (Canonical)

## Context

A single-user, self-hosted web app that turns Trello "in-progress" cards into a
**time-tracking calendar**. The user fetches their assigned, in-progress cards from one
Trello board and drags them onto a Gantt-style day grid to record *when* and *how long*
each task was actually worked on. The strict invariant is **only one task may occupy any
given instant**; dropping a task over another cuts/splits the existing one to make room.
Multi-day work is recorded by re-dragging the same card onto later days (linked segments).
A per-day **Out** time defines when work ended that day. Trello is a **read-only** source;
all plotting data lives in our own Postgres DB.

Fresh Next.js 16.2.9 (App Router, React 19, Tailwind v4) project; currently only
boilerplate (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`). Path alias `@/*` → root.
AGENTS.md warns this Next.js has breaking changes vs. training data — read the bundled
guides under `node_modules/next/dist/docs/01-app/...` (route-handlers,
server-and-client-components, mutating-data, project-structure, async `params`) before
writing handlers/config.

## Canonical decisions (these are the rules — build to them exactly)

1. **Card source ("Tasks").** Show cards from one or more configured lists
   (`TRELLO_LIST_IDS`, comma-separated — currently In-progress + For Review) that have the
   configured member (`TRELLO_MEMBER_ID`) assigned. The sidebar is titled **"Tasks"**.
   Trello is read-only; never written to. (`TRELLO_LIST_ID` still accepted as a fallback.)
2. **Auth / scope.** Single-user. Personal Trello API key + token + board/list/member IDs
   in `.env`, used **server-side only**. Credentials never reach the browser.
3. **Persistence.** All scheduling data in Postgres (Docker Compose). Local/self-hosted.
4. **Day bounds (global, configurable).** `dayStartMinute` default 480 (08:00),
   `dayEndMinute` default 1440 (24:00). These are the absolute left edge and the maximum
   possible Out. Editable in Settings.
5. **Out (per day).** Defaults to `dayEndMinute` (24:00). Range `[dayStart+30, dayEnd]`.
   Out is the **right edge** of that day's cell content.
6. **Orientation (Gantt).** Within a day cell, time runs **left→right**: bar `left` = start,
   `right` = end. 30-min anchors are **vertical** gridlines. Resize handles are **left/right**.
7. **Per-day scale (resolves Out-vs-alignment).** Both day cells have **equal physical
   width** (each = half the grid area; fit-to-window, no horizontal scroll). Each day has
   its **own** time scale: `pxPerMinute[day] = cellWidth / (out[day] − dayStart)`, so the
   span `dayStart→Out` fills the whole cell. Each cell renders its **own ruler** and its own
   30-min gridline spacing. Lowering Out rescales (zooms) that day only.
8. **Snap.** All times snap to **30-minute** marks. Minimum bar duration = 30 min.
9. **Overlap = split & shrink.** A newly placed/edited bar always wins its full span; any
   conflicting bar (any card) is split / truncated / deleted to yield the overlap. Split
   tasks show a **visible gap**; the conflicting time is filled by the new bar on its own
   lane, preserving "one task per instant".
10. **Lanes = one row per card.** A card is **spanning** if it has segments on *both*
    visible days, else **single-day**. Spanning cards take the **top** rows (ordered by
    earliest start across the window), each pinned to the **same row in both cells** so
    continuations align. Single-day cards fill the rows below, **per day independently**,
    ordered earliest-start. A bar's vertical position is purely `top = rowIndex*rowHeight`;
    its lane is **always derived**, never chosen by where the user drops vertically.
11. **Continuation.** Multi-day work = drag the **same card** onto another day → a new
    placement. All placements of a card are linked (same `cardId`). A placement **never
    changes day**; to "move" across days, delete and re-drag.
12. **Color.** Deterministic per-card HSL hashed from `cardId`. **Hue is
    mode-independent** (same card = same hue in both themes, preserving identity), but
    **lightness/saturation flip per theme**: night = deep fill + light text; day =
    **pastel** fill (high lightness) + dark text — each reads well on its background.
    `colorForCard(id, theme)`; components read `theme` from a `ThemeProvider` context.
13. **Day window.** Exactly **2 days** visible; ◀/▶ slide by **1 day**. Lanes are recomputed
    for the current window (not persisted); row positions may shift when sliding — accepted.
14. **Totals.** `cards.totalMinutesWorked` = sum of all segment durations across all days,
    recomputed on every placement mutation. Persisted; **not surfaced in UI** yet.
15. **Theme (night/day).** Two modes — **night (default)** and **day** — chosen via a
    radio in Settings, applied **live** and persisted in `localStorage` (per-browser, not
    DB). Implemented as `html[data-theme]` flipping CSS custom properties. Palette lives in
    a plain `:root` (NOT Tailwind `@theme`, whose layer would outrank the day override).
16. **Time format.** **12-hour** everywhere (`8:00 AM`, `2:30 PM`; 1440 → `12:00 AM`).
    Rulers use a compact hour form (`8 AM`, `12 PM`) to stay legible when days are dense.

## Architecture overview

```
Browser (client components)                    Server (Next route handlers)        Postgres
─────────────────────────                      ─────────────────────────────      ────────
Scheduler ─ TanStack Query ──fetch/mutate──▶  /api/trello/cards   ─Trello REST─▶  (read-only)
  ├ DateNavBar                                 /api/trello/meta    (setup helper)
  ├ CardList (draggable cards)                 /api/placements      GET/POST        cards
  └ DayGrid (computes lanes via assignLanes)   /api/placements/:id  PATCH/DELETE    placements
      └ DayColumn × 2 (own scale + own ruler)  /api/days/:date/out  PUT             day_settings
          ├ OutControl                         /api/settings        GET/PUT         app_settings
          └ Lane × n → TaskBar (custom pointer drag/resize)
```

Every placement mutation runs **`resolve()`** inside a DB transaction and returns the
**full placement set for the affected day** (with card names), so the client reconciles
after the server may have split/trimmed/deleted *other* bars.

## Data model (Drizzle / Postgres) — `db/schema.ts`

- **cards** — Trello cache + totals. `id` text PK (Trello card id), `name` text,
  `shortUrl` text, `idList` text, `idMembers` jsonb, `totalMinutesWorked` int default 0,
  `lastSyncedAt` timestamptz.
- **placements** — one bar = one segment on one day. `id` uuid PK, `cardId` text FK→cards,
  `day` date, `startMinute` int, `endMinute` int, `createdAt`/`updatedAt` timestamptz.
  Index on `(day)`. Minutes = offset 0–1440 within the calendar day.
- **day_settings** — `day` date PK, `outMinute` int null (null ⇒ defaults to dayEnd).
- **app_settings** — singleton row id=1: `dayStartMinute` int default 480,
  `dayEndMinute` int default 1440. Ensured/seeded on first read.

Trello board/list/member IDs + key/token live in `.env`, **not** the DB.

## Core logic (pure, unit-tested — build FIRST with TDD)

`lib/resolve.ts` — `resolve(incoming, existing, { dayStart, out })`:
1. Snap `incoming.start/end` to 30; reject if `end ≤ start` or `start ≥ out`; clamp
   `incoming.end = min(end, out)` and `incoming.start = max(start, dayStart)`.
2. For each `q` in `existing` (excluding incoming's own id on edit):
   - `q` fully inside incoming → **delete** `q`.
   - incoming fully inside `q` → **split** `q` into `[q.start, incoming.start)` + `[incoming.end, q.end)`.
   - left overlap → set `q.end = incoming.start`. Right overlap → set `q.start = incoming.end`.
   - drop any zero/negative-length result.
3. Clamp every surviving `q` to `out`: set `q.end = min(q.end, out)`; **delete** `q` if
   `q.start ≥ out`.
4. **Merge** touching/adjacent (`end == start`) segments of the **same card** into one.
   (Never merge across a gap — gaps left by deleting a neighbor stay; no auto-extend.)
Returns `{ toInsert, toUpdate, toDelete }`.

`lib/time.ts` (pure) — `snapTo30(min)`; `computeScale(cellWidth, dayStart, out) → pxPerMinute`;
`minuteToX(min, {dayStart, pxPerMinute})`; `xToMinute(x, {dayStart, pxPerMinute})` (then snap);
`formatMinute(min)` → **12-hour** `h:mm AM/PM` (1440 ⇒ `12:00 AM`); `formatHour12(min)` →
compact `h AM/PM` for rulers.

`lib/lanes.ts` (pure) — `assignLanes(visibleDays, placementsByDay)`:
1. Card = **spanning** if it has segments on ≥2 of the visible days, else single-day.
   (For the 2-day window, spanning ⇒ present on both days ⇒ always filled in both cells.)
2. Spanning cards → rows `0..k-1`, sorted by earliest start across the window; same row in
   every cell.
3. Single-day cards → rows `k..`, assigned **per day**, sorted by earliest start that day.
Returns `{ [day]: { [cardId]: rowIndex } }` + `laneCount`.

`lib/color.ts` — `colorForCard(id, theme)` → deterministic HSL (hue from hashed id, shared
across themes) + a brighter edge shade. Night: deep fill (L≈26%) + light text. Day:
**pastel** fill (L≈88%) + dark text. Computed client-side; nothing stored.

`lib/trello.ts` (server-only) — `fetchInProgressCards()`: GET board cards via REST, filter
`TRELLO_LIST_IDS.includes(idList) && idMembers.includes(TRELLO_MEMBER_ID)`, **upsert** into
`cards` (**never delete** a card row that still has placements). `fetchBoardMeta()`: list the
board's lists + members with IDs for one-time `.env` setup. `lib/env.ts` parses
`TRELLO_LIST_IDS` (comma-separated; fallback `TRELLO_LIST_ID`) into `listIds[]`.

`lib/types.ts` — shared `Card`, `Placement` (+ `cardName`), `Settings`, `LaneMap` types.

## API (route handlers under `app/api`; validate bodies with zod; async `params`)

- `GET /api/trello/cards` → sync from Trello, return current in-progress assigned cards.
- `GET /api/trello/meta` → board lists + members with IDs (setup helper).
- `GET /api/placements?from&to` → placements in range **joined with `cards.name`** (so bars
  render even if a card left the in-progress list) + each day's `outMinute` + `plottedCardIds`
  (distinct cardIds with **any** placement on any date, for the CardList plotted-marker).
- `POST /api/placements` `{cardId, day, startMinute, endMinute}` → resolve + persist; return
  full day's placements; recompute affected cards' totals.
- `PATCH /api/placements/:id` `{startMinute, endMinute}` (move/resize **within the same
  day only**) → resolve.
- `DELETE /api/placements/:id` → remove; recompute totals (gaps are **not** auto-filled).
- `PUT /api/days/:date/out` `{outMinute|null}` → set/clear Out, clamp that day via resolve
  rules (end→out, delete bars with start≥out). Raising/clearing Out **never auto-extends**.
- `GET|PUT /api/settings` → day start/end bounds.

Totals recompute = `SUM(endMinute−startMinute)` grouped by cardId for touched cards.

## UI components (client) + theme

Root `page.tsx` (server shell) renders `<Scheduler>`. `app/layout.tsx` wraps children in
`<Providers>` (client) holding the TanStack Query `QueryClientProvider`.

- **Scheduler** — owns the visible 2-day window + Query caches (cards, placements, settings).
  Layout: left `CardList`, top `DateNavBar`, main `DayGrid`.
- **DateNavBar** — ◀/▶ shift window by 1 day; shows both dates; opens `SettingsDialog`.
- **CardList** — sidebar titled **"Tasks"**; assigned cards from the configured lists as
  draggable chips (name + color dot), in Trello board order. Starts a custom pointer-drag
  carrying `cardId`. Cards remain listed after plotting. Names **wrap** to as many lines as
  needed (chip grows vertically from a fixed minimum, never clipped). A chip whose card has
  **any placement on any date** (from `WindowData.plottedCardIds`) shows a thick **left
  border in the card's color** — a "already plotted" marker that updates live as bars are
  added/removed.
- **DayGrid** — measures available width (ResizeObserver), splits into 2 equal `DayColumn`s,
  computes lanes via `assignLanes()`, sets grid height = `laneCount*rowHeight`.
- **DayColumn** — receives its own `out` and computes its own `pxPerMinute` via
  `computeScale(cellWidth, dayStart, out)`. Renders its **own ruler** (hour ticks
  dayStart→out), 30-min vertical gridlines, lane bands, `OutControl`, and its `TaskBar`s.
  Drop handler: `start = snap(xToMinute(dropX))` **clamped to `[dayStart, out−60]`** so a
  default **1-hour** bar fits even when dropping near the end; `endMinute = min(start+60, out)`;
  only if the day has `< 30` min of room before Out is it rejected with a toast. Vertical drop
  position is ignored (lane derived).
- **TaskBar** — `left=minuteToX(start)`, `width=(end−start)*pxPerMinute`, `top=rowIndex*rowHeight`.
  Shows color + **truncated** title; **hover/click reveals full title + 12-hour time range**.
  Body drag = move along x (preserve duration, clamp to `[dayStart,out]`, re-resolve via PATCH;
  row stays tied to the card). Left/right handles = resize (min 30; overrunning neighbors
  triggers split/shrink). Optimistic during drag; reconcile with server's returned day set on
  release. Small × to delete. While a move/resize gesture is live, a cursor-following
  **tooltip** (fixed-position sibling so the bar's `overflow-hidden` can't clip it) shows the
  prospective `start – end` (12-hour) the bar will commit to on release.
- **OutControl** — compact time input in each day header → `PUT /api/days/:date/out`.
- **SettingsDialog** — **Appearance** night/day radio (applied live, persisted to
  `localStorage`); edit `dayStart`/`dayEnd`; button to trigger Trello re-sync.

**Theme — night (default) + day** (`app/globals.css`): palette in a plain `:root`, flipped by
`html[data-theme="day"]`; `Scheduler` reads/writes `localStorage["theme"]` and sets
`document.documentElement.dataset.theme`. Night: bg `#0f1113`, surfaces `#16181c`/`#1d2024`,
lines `#282c32`, text `#e6e8ea`, accent `#7c9cff`. Day: bg `#f4f6f9`, surface `#fff`, text
`#1a1d21`, accent `#3b5bdb`. Per-card bar **hues** are mode-independent; their fill/text
flip per theme (night = deep fill/light text, day = **pastel** fill/dark text) via
`colorForCard(id, theme)`, theme supplied by a `ThemeProvider` context. Minimalist, no heavy chrome.

## Drag/resize interaction model

One shared coordinate primitive (`xToMinute`/`minuteToX`, parameterized by the day's own
scale) powers all three gestures — drop-from-list, move-bar (horizontal), resize-edge
(left/right) — via pointer events on the `DayColumn`: `pointerdown` captures the gesture +
grabbed bar/handle; `pointermove` updates local optimistic geometry (snapped to 30, clamped
to `dayStart…out`; row fixed by card); `pointerup` commits via POST/PATCH and replaces local
state with the server-resolved day set (which may have split/trimmed other bars and
added/removed lanes). No DnD library — avoids fighting the precise 30-min anchoring.

All three gestures surface a **live time tooltip** of the prospective `start – end` so the
user sees exactly where the bar will land before releasing: the list-drag ghost appends the
range while hovering a column (computed by the shared `plannedDrop(relX, ctx)` helper that
the actual drop also uses, so preview and result never diverge), and move/resize show a
cursor-following tooltip driven by the same optimistic `preview` geometry.

## Build order

1. **Scaffold infra** — deps: `drizzle-orm`, `drizzle-kit`, `pg`, `@tanstack/react-query`,
   `zod`, `date-fns`, `vitest`. `docker-compose.yml` (Postgres). `.env.example`
   (DATABASE_URL, TRELLO_KEY/TOKEN/BOARD_ID/LIST_ID/MEMBER_ID). `drizzle.config.ts`;
   `db/schema.ts` + `db/index.ts`; npm scripts `db:generate` / `db:migrate`; first migration.
2. **TDD pure logic** — write Vitest cases, then implement green: `resolve.ts` (split,
   truncate-left/right, full-cover delete, Out clamp + delete-past-out, same-card merge,
   no-overlap, reject end≤start); `time.ts` (snap, scale, minute↔x, 24:00 format);
   `lanes.ts` (single-day vs spanning, spanning-on-top, earliest-start within tier).
3. **Trello layer** — `lib/trello.ts` + `GET /api/trello/cards` + `/meta`; verify real cards.
4. **Placement API** — POST/PATCH/DELETE/GET (+ card-name join) wired to `resolve()` in
   transactions + totals recompute; `days/:date/out`; `settings` (seed singleton).
5. **UI** — theme + Providers + `Scheduler`/`DateNavBar`/`CardList`/`DayGrid`/`DayColumn`/
   `TaskBar`/`OutControl`/`SettingsDialog`; per-day scale; Query wiring + optimistic drag.
6. **Polish** — empty/loading/error/toast states, settings dialog, color tuning.

## Files to create (representative)

- `docker-compose.yml`, `drizzle.config.ts`, `.env.example`
- `db/schema.ts`, `db/index.ts`, `db/migrate.ts`, `db/migrations/*`
- `lib/resolve.ts` (+`.test`), `lib/time.ts` (+`.test`), `lib/lanes.ts` (+`.test`),
  `lib/color.ts`, `lib/trello.ts`, `lib/types.ts`, `lib/env.ts`
- `app/api/trello/cards/route.ts`, `app/api/trello/meta/route.ts`,
  `app/api/placements/route.ts`, `app/api/placements/[id]/route.ts`,
  `app/api/days/[date]/out/route.ts`, `app/api/settings/route.ts`
- `app/page.tsx` (replace boilerplate), `app/providers.tsx`, edit `app/layout.tsx`,
  `app/globals.css` (theme)
- `components/Scheduler.tsx`, `DateNavBar.tsx`, `CardList.tsx`, `DayGrid.tsx`,
  `DayColumn.tsx`, `TaskBar.tsx`, `OutControl.tsx`, `SettingsDialog.tsx`

## Prerequisites / controls

- **Docker Desktop** present (confirmed) — used for Postgres via `docker compose up -d`.
- **Trello credentials**: to verify the *live* fetch end-to-end I'll need real
  `TRELLO_KEY/TOKEN/BOARD_ID/LIST_ID/MEMBER_ID` in `.env`. Everything else (resolve/lanes/
  time logic, placement API against the DB, UI) is buildable and testable without them; the
  `/api/trello/meta` route makes obtaining the IDs easy once key+token are set.
- At execution time I'll need to run `npm install`, `docker compose`, drizzle migrations,
  `npm run dev`, and `vitest`.

## Trello setup (one-time)

1. Create a Power-Up at `https://trello.com/power-ups/admin` to get an **API key**; from
   that page manually generate a **token** (read scope).
2. Put `TRELLO_KEY` / `TRELLO_TOKEN` in `.env`; run the app and call `GET /api/trello/meta`
   to read the board's list + member IDs; copy the source list ids (In-progress + For Review)
   comma-separated into `TRELLO_LIST_IDS`, plus `TRELLO_BOARD_ID` / `TRELLO_MEMBER_ID`. (Or
   append `.json` to the board URL.) All Trello calls are server-side, read-only.

## Verification

- **Unit:** `npx vitest run` — `resolve`, `time`, `lanes` suites green (riskiest logic).
- **Integration:** `docker compose up -d`, migrate, `npm run dev`; `GET /api/trello/cards`
  returns real assigned in-progress cards; exercise placement POST/PATCH/DELETE and confirm
  DB rows + recomputed totals; `PUT /days/:date/out` clamps + deletes bars past Out.
- **E2E (manual / Playwright MCP):**
  1. Drag a card onto Mon → horizontal bar on its own lane, snapped to 30-min.
  2. Drag left/right edges → start/end change + DB update; can't shrink below 30 min.
  3. Drop a 2nd card inside the 1st's range → 1st splits with a **visible gap**; 2nd fills
     that time on its **own lane below**.
  4. Set Mon Out to 17:00 → bars clip, Mon **rescales to fill its cell up to 17:00** with its
     own ruler while Tue keeps its scale; both cells stay equal width; can't drop past Out.
  5. Drag the same card onto Tue → linked continuation; its lane **aligns across both days**;
     `cards.totalMinutesWorked` sums across both days in DB.
  6. ◀/▶ → window slides by one day; placements persist on reload.
  7. Settings → **Day** flips background/text live; bars keep their hues but shift to
     **pastel** fills with dark text, and persists across reload; switching back to
     **Night** restores the deep fills (the default).
  8. All times read in **12-hour** format (rulers `8 AM`/`12 PM`; bars & Out `8:00 AM` etc.).
  9. Sidebar **"Tasks"** lists cards from both In-progress and For Review lists.
  10. Long task names **wrap** to multiple lines (chip grows; nothing clipped).
  11. Dropping a card yields a **1-hour** bar even near the end of the day (start pulled back
      to fit the hour), and the matching Tasks chip gains a **colored left border** live;
      the border reflects placements on **any** date, not just the visible window.
  12. While dragging a card over a column, the ghost shows the prospective `start – end`;
      while moving/resizing a bar, a cursor-following tooltip shows the live `start – end` —
      both in 12-hour format, matching what commits on release.
