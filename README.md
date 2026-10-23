# GradedCalls FinTwit

Brand rules: read BRAND.md before any UI change; deviations are an automatic MUST-FIX.

GradedCalls FinTwit is the FinTwit vertical under GradedCalls. It is a public scoreboard for FinTwit-style bullish and bearish calls. It grades **one cohort per week**, then watches that same book age against the market.

GradedCalls Analysts and GradedCalls Sports are sibling verticals. They are not this board. Grades describe a past post against a recorded print. They are not trade signals, and they are not for sale.

The npm package and the SQLite file stay named `fintwittruth`. That is the technical package name, not the public brand.

Production shows sourced public posts only. Each graded card links its source. The latest board is the week of October 19, 2026. Monday noon and the Wednesday, October 21 official close are graded. Friday, October 23 stays ungraded until that close is in. The app does not scrape X or any ranking site, and it does not invent a price when a session is missing. Fictional posts used to exercise the scorer stay in `src/lib/demo-data.ts` for unit tests. They are not seeded and they are not served.

## Evaluation calendar

The calendar is fixed.

**Collect window:** Wednesday 12:00 PM America/New_York → Sunday 5:00 PM America/New_York.

That window is one cohort. The calls do not change for the rest of the week. One call per handle per cohort; a handle can appear in later weeks. The first forward-looking post covering the week that names a direction on a graded print (SPY, QQQ, DIA, SPX, NDX, ES, NQ, the S&P 500, the Nasdaq 100, or the Dow) counts. An ambiguous direction is excluded.

The weeks of September 28, October 5, and October 12 are Substack only. For the week of October 19, Substack covers the whole Wednesday noon to Sunday 5:00 PM ET window. X was checked only from Friday, October 16 at 10:22 AM ET through Sunday, October 18 at 5:00 PM ET. X posts from Wednesday noon through Friday 10:22 AM ET were out of scope and were not searched. For this week, first means the first forward-looking post inside that searched range. Posts that were read and left out are in `data/calls/exclusions.csv`. A closed week with no qualifying call is listed in `data/calls/checked-weeks.csv`, with a coverage value for the sources that were searched, so the freshness check can see it. The 7-day limit is unchanged.

**Four readouts on that same cohort:**

| Readout | When | What it is |
| --- | --- | --- |
| Monday gap | Monday 9:30 AM ET | Friday regular-session close to the regular-session open |
| Weekend-noise grade | Monday 12:00 PM ET | Primary score against the noon print |
| Mid-week update | Wednesday official close | Same calls, rescored at the cash close (4:00 PM ET) |
| Final grade | Friday official close | Last score on that cohort, at the cash close (4:00 PM ET) |

Wednesday at 12:00 PM ET is still when the **next** collect window opens. That is a new cohort. The Wednesday grade is the official close, and it still belongs to the book that closed the previous Sunday. An early-close day (1:00 PM ET) uses that day's official close. There is no 4:00 PM bar on those days. A market holiday stays blank.

Each cohort has two inclusion buckets: a named watchlist and a viral doom / hype spike set. Both feed the weekly board. Leaderboards are ranked inside each bucket.

The weekend reference is the **prior Friday regular-session close** for SPY, QQQ, and DIA, plus Friday's VIX close. Yahoo `adjclose` is stored beside it for audit and is **not** used for gap, noon, or close grades, because the daily open and the 12:00 PM ET five-minute open are not dividend-adjusted. Comparing retrospectively rewritten adjclose to those prints invents a false gap. There is no invented Sunday cash print. Monday's gap uses the regular-session daily open. Monday noon uses the **open** of the 5-minute bar stamped 12:00 PM America/New_York. Wednesday and Friday use Yahoo's **daily close**, the official regular-session close. Settlement waits 45 minutes after that close so the equity auction and the 4:15 PM ET VIX print are posted. A daily bar before that buffer is the last trade, not the close. A closed session stays blank. Monday, September 7, 2026 was Labor Day, so that gap and noon stay ungraded. A Yahoo VIX daily bar on that holiday is ignored. A date that is not due yet stays null. The series is committed in `src/lib/market-history.json` (chart API `query1.finance.yahoo.com`). `src/lib/quotes.ts` throws if a required print is missing. `npm run settle` fills a due Wednesday or Friday close from Yahoo and refuses to invent one when the bar is missing.

The in-app methodology page states this again. The latest verified week publishes a checkpoint only after that print is recorded. Friday stays ungraded until its official close is in the price file.

## Boards

Founder choice: hide pending until settle. The home tape, weekly rankings, leaderboards, and account scorecards list only calls that already have a settled grade. A readout is settled when its status is `published` (Monday gap, Monday noon, Wednesday close, or Friday close). The scorer writes grade rows at that gate and leaves a scheduled horizon empty. The board layer drops those empty horizons from the primary rankings.

Hit rate, STRONG rate, and WEAK rate are computed from settled grades only. A handle with no settled grade is not ranked. Hit rate is the share of settled grades where the tape moved with the call by at least 0.08%.

Calls still waiting on a tape are listed at `/pending` and `/weeks/[slug]/pending`. Those pages are linked from the boards and the footer. They are not in the primary nav and they are not mixed into the rankings. A cohort with nothing graded yet shows a short empty state instead of a table of blanks.

## Scoring

Every published grade shows the full **0–100** score, built from:

- **Direction (up to 50)** — equal-weight move of SPY, QQQ, and DIA from Friday's regular-session close. Bearish calls use the inverse.
- **Levels (up to 20)** — targets, invalidation, support, and resistance on the call's own symbol. A busted invalidation caps this part at 2. No level keeps a floor of 4.
- **Specificity (up to 15)** — naming a ticker, a target, an invalidation, and a band.
- **VIX (15)** — panic and selloff calls want VIX higher. Melt-up calls want VIX lower. The move is Friday's VIX close to the VIX print at the same stamp.

**GC Scale.** The horizontal tube fill is the 0–100 score. **STRONG** is 70 or more. **WEAK** is under 40. **PROVISIONAL** is 40 or more and under 70. **EXIT LIQUIDITY** is a graded 0% fill: an empty glass when the score is 0. A horizon that has not been graded reads "Not graded yet". The same lines apply on every board. Rank orders the board. It does not decide the pill.

Monday noon is the primary weekend-noise grade. The Monday gap is the open. Wednesday and Friday age that same cohort.

The **Weekend Noise Index** is the share of the cohort tagged panic versus melt-up, shown next to the Monday equity return from Friday's close and the VIX change. It is descriptive. It is not a signal.

A **1–10 badge** sits beside the score. 0–9 maps to 1. 90–100 maps to 10.

Consensus is conviction-weighted (high 3, medium 2, low 1) and compared with the equal-weight equity tape.

## Run

Requires Node.js 22.

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev` runs `predev` first, which creates `prisma/fintwittruth.db` and seeds it when the file is missing. No API keys are required.

| Command | What it does |
| --- | --- |
| `npm test` | Calendar, scoring, GC Scale pills, and the graded-only board filter |
| `npm run db:seed` | Rebuild the sourced rows in place |
| `npm run db:reset` | Recreate the SQLite file and seed it |
| `npm run build` | Generate the client, seed SQLite, and build Next.js |
| `npm start` | Serve the production build |

`npm install && npm run build` is enough for a production build. npm runs `prebuild` before `build`: Prisma generates the client, creates `prisma/fintwittruth.db`, and seeds the sourced book. Then `next build` prerenders the pages. A schema change on an existing database file needs `npm run db:reset` first.

## Calls ledger

`data/calls/calls.csv` is the source of truth for the sourced book and for each call's Monday 12:00 PM ET, Wednesday close, and Friday close grade. `npm run calls:export` rewrites `src/lib/live-calls.json` in the shape the site already reads. An unchanged CSV exports byte-identical JSON. Checkpoint columns stay in the CSV. `data_source=demo` is rejected. Allowed values are `public` and `licensed`. The fictional book in `src/lib/demo-data.ts` is a unit-test fixture and is not written to the database.

Weekly flow:

1. Add or edit a row in `data/calls/calls.csv`. A new checkpoint stays `PENDING`. Keep the source URL and the post text.
2. Run `npm run calls:validate`. The run fails on a duplicate id, a missing source URL, a graded row without the price at the call and the price at the checkpoint, a ticker or index the post did not name, a checkpoint date outside that cohort's Monday, Wednesday, or Friday, or a value the scorer would not produce.
3. Run `npm run calls:export`.
4. On Wednesday and Friday the settle workflow writes the official Yahoo close into `src/lib/market-history.json`, then runs `npm run calls:settle -- --write`. That fills a due checkpoint only when the post names exactly one whitelist symbol and that symbol is the row's primary. `npm run calls:settle` with no flag is a dry-run and does not write the CSV.
5. Open a data pull request with the CSV and the exported JSON. If the call rows did not change, the JSON diff is empty.

The ledger does not scrape X and it does not add a market-data vendor. Prints come from the Yahoo history the site already records. A post that names two indexes, or names none, stays pending until someone records the grade by hand.

`DATABASE_URL` in `.env` is `file:./fintwittruth.db`. The Prisma CLI resolves that path next to `prisma/schema.prisma`. It is not a secret. Copy `.env.example` if you need a fresh env file.

## Seed sources

- `src/lib/market-history.json` — recorded Yahoo Finance Friday session closes, adjclose (audit), regular-session opens, Monday 12:00 PM ET prints, and Wednesday and Friday official closes
- `src/lib/quotes.ts` — reads that file and refuses a missing print
- `src/lib/live-calls.json` — sourced public posts, each with a source URL, exported from the CSV
- `src/lib/demo-data.ts` — fictional accounts used only by scorer tests. `productionBook` drops them before seed
- `src/lib/dataset.ts` — applies the locked calendar and the scorer
- `prisma/seed.ts` — writes the production book with Prisma

The seeded weeks are `2026-09-21`, `2026-09-28`, `2026-10-05`, `2026-10-12`, and `2026-10-19`. A call score is the mean of its graded Monday noon, Wednesday close, and Friday close. An account grade is the mean of those call scores. Conviction weights stay high 3, medium 2, low 1. Grades use the Yahoo regular-session close (Monday noon is the 12:00 PM ET print). `adjclose` is stored beside the close for audit. On the October 21, 2026 session the close and adjclose matched.

Cohort slugs are the readout Monday (`YYYY-MM-DD`).

## Licensed feed, later

The board already reads the CSV. A licensed feed can append rows. It does not replace the ledger.

1. Implement `fetchPosts` in `src/lib/feeds/x-api-feed.ts` using a **licensed** X API or approved firehose. Page only the collect window (Wednesday 12:00 PM ET through Sunday 5:00 PM ET). Do not scrape the website.
2. Implement `fetchPrints` in `src/lib/feeds/licensed-market-feed.ts` for the Friday reference, the Monday open and noon, and the Wednesday and Friday official closes.
3. Set `FEED_PROVIDER=x-api` and `MARKET_DATA_PROVIDER=licensed-bars`. `src/lib/feeds/index.ts` selects the adapters.
4. Append confirmed posts to `data/calls/calls.csv` with `data_source` `public` or `licensed`. Run `calls:validate` and `calls:export`. Ambiguous posts stay pending and are not graded.
5. Keep the disclaimer. Past scores are still not a forecast.
6. Postgres, when you outgrow the file: point `DATABASE_URL` at a `postgresql://` URL, change the Prisma datasource provider to `postgresql`, and run `prisma db push`. `src/lib/prisma.ts` already uses a Postgres URL when it sees one, and otherwise opens the SQLite file.

`X_BEARER_TOKEN` is unused until the X adapter is implemented.

## Deploy on Vercel

Import the GitHub repository. The sourced database is created during the build. No secrets are required.

Set `NEXT_PUBLIC_SITE_URL` to `https://fintwittruth.vercel.app` for Production and Preview. That origin is what absolute `og:image` and `twitter:image` URLs use. The app falls back to the same host when the variable is unset.

Use these settings. The defaults already match. Do not override the build command.

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root directory | repository root |
| Node.js version | 22.x (`engines` in `package.json`) |
| Install command | `npm install` (leave the default) |
| Build command | `npm run build` (leave the default) |
| Output directory | leave the Next.js default |
| Environment variables | `NEXT_PUBLIC_SITE_URL=https://fintwittruth.vercel.app` on Production and Preview |

`npm run build` runs `prebuild` first: Prisma generates the client (including the Vercel runtime engine), creates `prisma/fintwittruth.db`, and seeds it. That file is traced into the server bundle. Pages are prerendered from it. On Vercel the filesystem is read-only except `/tmp`, so a server instance copies the seed to `/tmp/fintwittruth.db` before reading it.

Do not change the build command to bare `next build`. That skips the seed and the routes have no database.

Do not set `DATABASE_URL` in the project settings for this SQLite build. Do not set `NODE_ENV` yourself. A `postgresql://` `DATABASE_URL` is only for a later hosted database, and it also requires changing the Prisma datasource provider to `postgresql`.

This deploy is read-only. New calls are appended to the CSV and shipped in a pull request. A writable live feed should use Postgres rather than SQLite on serverless disk.

## Real account intake

The watchlist in `src/lib/watchlist.json` is the list of public X accounts. Edit the handles there. Each profile links to `https://x.com/<handle>`. An account with no confirmed grade shows **Tracking — no graded calls yet**. The page does not invent a call or a score.

Paste intake lives at `/admin` and `POST /api/admin/intake`.

1. Set `ADMIN_TOKEN` to a long random string (16 characters or more).
2. On Vercel, create a Blob store for the project and connect it. That sets `BLOB_READ_WRITE_TOKEN`. The book is a private blob at `intake/book.json`. Until that token exists, the watchlist still renders and the admin page refuses to save a paste.
3. Locally, leave `BLOB_READ_WRITE_TOKEN` unset and do not set `VERCEL`. Pastes go to `data/intake-book.json`, which is gitignored.
4. Optional: set `XAI_API_KEY` (and `XAI_MODEL` if you do not want `grok-3`) to let an ambiguous paste ask the AI SDK for a suggestion. The suggestion stays in review. Unset means the rules parser runs alone.
5. Paste an `https://x.com/<handle>/status/<id>` URL. The server calls `https://publish.x.com/oembed` first, then `https://publish.twitter.com/oembed`, and follows redirects. If every host fails, the admin page asks for the post text. Empty text is refused. It stores the URL, handle, oEmbed date label when one exists, and the text. It does not scrape x.com and it does not invent a clock time when oEmbed only returned a date.
6. Confirm, edit, or reject the parsed call. Symbols in `market-history.json` (SPY, QQQ, DIA, VIX, and the other recorded names) can be graded. Anything else is stored as **Not gradable yet**.
7. A confirmed call is scored on Monday at the open of the 12:00 PM ET 5-minute bar, and on Wednesday and Friday at the 4:00 PM ET regular-session close. It skips the Monday gap. It appears on `/real` and on that account, labeled **Verified real call**, with the original post and **Dispute this grade**. That link opens `/dispute`. An unconfirmed or ambiguous call stays pending and shows **Not graded yet**.
8. Disputes live in the same intake book (`disputes` on `intake/book.json`, or the local file). `/admin` lists them as open or resolved. Optional `DISPUTE_EMAIL` adds a mailto link. No address is shipped when that variable is unset.

Scheduled X search is a disabled stub in `src/lib/x-search-job.ts`. It does not run, even if `XAI_API_KEY` is set.

## Legal

Draft pages, labeled “Draft for legal review” until counsel signs off:

- `/disclaimer` — not investment advice, not an adviser, grades not for sale
- `/terms` — public posts, the locked calendar, real prints, liability limitation
- `/donate` — donation-only; a gift is not a signal and is not tax-deductible unless a later notice says so

Not investment advice. Past accuracy is not a prediction of future results. Shipped cards quote public posts and link the source. The prints used to grade them are historical Yahoo Finance prices for the evaluation dates. GradedCalls FinTwit is not affiliated with X, Twitter, or Yahoo Finance. Corrections go through the on-site dispute form.
